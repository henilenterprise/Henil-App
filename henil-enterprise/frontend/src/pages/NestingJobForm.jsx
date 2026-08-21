import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Calculator, Save, ArrowLeft, Download, RotateCcw } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import NestingVisualMap from '../components/nesting/NestingVisualMap.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  getNestingJobWithParts,
  createNestingJob,
  updateNestingJob,
  calculateNesting,
  saveNestingResult,
} from '../services/nestingService.js';
import { listClients } from '../services/clientsService.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './NestingJobForm.css';

const EMPTY_JOB = {
  job_name: '',
  client_id: '',
  material: '',
  thickness: '',
  sheet_width: '',
  sheet_height: '',
  kerf: '0',
  spacing: '0',
  edge_margin: '0',
  allow_rotation: 'true',
  notes: '',
};

function emptyPart() {
  return { tempId: `new-${Math.random().toString(36).slice(2)}`, part_name: '', width: '', height: '', quantity: '1', allow_rotation: null };
}

function NestingJobForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [clients, setClients] = useState([]);

  const [job, setJob] = useState(EMPTY_JOB);
  const [parts, setParts] = useState([emptyPart()]);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listClients({ pageSize: 500, sortBy: 'company_name', ascending: true }).then((res) => setClients(res.data)).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    getNestingJobWithParts(id)
      .then((data) => {
        setJob({
          job_name: data.job_name,
          client_id: data.client_id || '',
          material: data.material || '',
          thickness: data.thickness || '',
          sheet_width: String(data.sheet_width),
          sheet_height: String(data.sheet_height),
          kerf: String(data.kerf),
          spacing: String(data.spacing),
          edge_margin: String(data.edge_margin),
          allow_rotation: String(data.allow_rotation),
          notes: data.notes || '',
        });
        setParts(
          data.parts.length > 0
            ? data.parts.map((p) => ({
                id: p.id,
                part_name: p.part_name,
                width: String(p.width),
                height: String(p.height),
                quantity: String(p.quantity),
                allow_rotation: p.allow_rotation,
              }))
            : [emptyPart()]
        );
        if (data.result_computed_at) {
          setResult({
            sheetsRequired: data.result_sheets_required,
            totalRequested: data.result_total_requested,
            totalPlaced: data.result_total_placed,
            utilizationPct: Number(data.result_utilization_pct),
            wasteArea: Number(data.result_waste_area),
            sheetArea: Number(data.sheet_width) * Number(data.sheet_height),
            placements: data.result_placements || [],
            unplaced: data.result_unplaced || [],
          });
        }
      })
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function setJobField(field) {
    return (e) => {
      const value = typeof e === 'string' || typeof e === 'boolean' ? e : e.target.value;
      setJob((j) => ({ ...j, [field]: value }));
    };
  }

  function setPartField(index, field) {
    return (e) => {
      const value = typeof e === 'string' || typeof e === 'boolean' ? e : e.target.value;
      setParts((current) => current.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    };
  }

  function addPart() {
    setParts((current) => [...current, emptyPart()]);
  }

  function removePart(index) {
    setParts((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function validate() {
    const errs = {};
    if (!job.job_name.trim()) errs.job_name = 'Job name is required.';
    if (!job.sheet_width || Number(job.sheet_width) <= 0) errs.sheet_width = 'Enter a sheet width greater than 0.';
    if (!job.sheet_height || Number(job.sheet_height) <= 0) errs.sheet_height = 'Enter a sheet height greater than 0.';
    const validParts = parts.filter((p) => p.part_name.trim() && p.width && p.height && p.quantity);
    if (validParts.length === 0) errs.parts = 'Add at least one part with a name, width, height, and quantity.';
    return errs;
  }

  // The form keeps allow_rotation as the string 'true'/'false' (a
  // <select> value, matching how every other boolean field in this
  // app is handled) — normalize to a real boolean here, the one place
  // that matters, rather than at every call site individually.
  function jobForSubmit() {
    return { ...job, allow_rotation: job.allow_rotation === 'true' };
  }

  function handleOptimize() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setCalculating(true);
    try {
      const validParts = parts.filter((p) => p.part_name.trim() && p.width && p.height && p.quantity);
      const calcResult = calculateNesting(jobForSubmit(), validParts);
      setResult(calcResult);
      if (calcResult.unplaced.length > 0) {
        toast.error('Some parts could not be placed', `${calcResult.unplaced.length} part type(s) don't fit — see the details below.`);
      } else {
        toast.success('Nesting calculated', `${calcResult.sheetsRequired} sheet(s) required at ${calcResult.utilizationPct}% utilization.`);
      }
    } catch (err) {
      toast.error("Couldn't calculate nesting", getErrorMessage(err));
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      const validParts = parts.filter((p) => p.part_name.trim() && p.width && p.height && p.quantity);
      let jobId = id;
      if (isEdit) {
        await updateNestingJob(id, jobForSubmit(), validParts);
      } else {
        const created = await createNestingJob(jobForSubmit(), validParts);
        jobId = created.id;
      }
      if (result) {
        await saveNestingResult(jobId, result);
      }
      toast.success('Nesting job saved', '');
      navigate('/artwork-vault/nesting');
    } catch (err) {
      toast.error("Couldn't save nesting job", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleExportReport() {
    if (!result) return;
    const lines = [];
    lines.push(`Nesting Report \u2014 ${job.job_name}`);
    lines.push(`Material: ${job.material || '\u2014'}, Thickness: ${job.thickness || '\u2014'}`);
    lines.push(`Sheet: ${job.sheet_width} x ${job.sheet_height} mm, Kerf: ${job.kerf} mm, Spacing: ${job.spacing} mm, Edge margin: ${job.edge_margin} mm`);
    lines.push('');
    lines.push(`Sheets required: ${result.sheetsRequired}`);
    lines.push(`Parts placed: ${result.totalPlaced} / ${result.totalRequested}`);
    lines.push(`Utilization: ${result.utilizationPct}%`);
    lines.push(`Waste area: ${result.wasteArea} mm\u00b2`);
    lines.push('');
    lines.push('Cutting list:');
    lines.push('Sheet,Part,X,Y,Width,Height,Rotated');
    for (const p of result.placements) {
      lines.push(`${p.sheetIndex + 1},${p.name},${p.x},${p.y},${p.w},${p.h},${p.rotated ? 'Yes' : 'No'}`);
    }
    if (result.unplaced.length > 0) {
      lines.push('');
      lines.push('Unplaced parts:');
      for (const u of result.unplaced) {
        lines.push(`${u.name}: ${u.quantity} \u2014 ${u.reason}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nesting-report-${job.job_name.replace(/\s+/g, '-').toLowerCase() || 'job'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <Spinner size="lg" label="Loading nesting job…" />;
  }

  if (loadError) {
    return (
      <>
        <Alert tone="danger" title="Couldn't load this nesting job">
          {loadError}
        </Alert>
        <div className="nesting-form__retry">
          <Button variant="outline" icon={RotateCcw} onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <button type="button" className="nesting-form__back" onClick={() => navigate('/artwork-vault/nesting')}>
        <ArrowLeft size={14} /> Back to Nesting Jobs
      </button>

      <PageHeader title={isEdit ? 'Edit Nesting Job' : 'New Nesting Job'} description="Maximize material utilization, minimize waste." />

      <div className="nesting-form__grid">
        <div className="nesting-form__main">
          <Card title="Job & Sheet Information" className="nesting-form__section">
            <div className="nesting-form__fields">
              <Input label="Job name" required value={job.job_name} onChange={setJobField('job_name')} error={errors.job_name} className="nesting-form__full" />
              <Select
                label="Client"
                placeholder="No client"
                options={clients.map((c) => ({ value: c.id, label: c.company_name }))}
                value={job.client_id}
                onChange={setJobField('client_id')}
              />
              <Input label="Material" value={job.material} onChange={setJobField('material')} />
              <Input label="Thickness" value={job.thickness} onChange={setJobField('thickness')} helperText="e.g. 5mm" />
              <Input label="Sheet width (mm)" type="number" min="0" value={job.sheet_width} onChange={setJobField('sheet_width')} error={errors.sheet_width} />
              <Input label="Sheet height (mm)" type="number" min="0" value={job.sheet_height} onChange={setJobField('sheet_height')} error={errors.sheet_height} />
              <Input label="Kerf (mm)" type="number" min="0" step="0.1" value={job.kerf} onChange={setJobField('kerf')} />
              <Input label="Spacing (mm)" type="number" min="0" step="0.1" value={job.spacing} onChange={setJobField('spacing')} />
              <Input label="Edge margin (mm)" type="number" min="0" step="0.1" value={job.edge_margin} onChange={setJobField('edge_margin')} />
              <Select
                label="Allow part rotation (90°)"
                options={[
                  { value: 'true', label: 'Yes \u2014 rotate parts if it helps fit' },
                  { value: 'false', label: 'No \u2014 keep original orientation' },
                ]}
                value={job.allow_rotation}
                onChange={setJobField('allow_rotation')}
                className="nesting-form__full"
              />
            </div>
          </Card>

          <Card title="Parts" className="nesting-form__section">
            {errors.parts && (
              <Alert tone="danger" title="Add at least one part">
                {errors.parts}
              </Alert>
            )}
            <div className="nesting-parts__table-wrap">
              <table className="nesting-parts__table">
                <thead>
                  <tr>
                    <th>Part Name</th>
                    <th>Width (mm)</th>
                    <th>Height (mm)</th>
                    <th>Quantity</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part, index) => (
                    <tr key={part.id || part.tempId}>
                      <td>
                        <Input aria-label="Part name" value={part.part_name} onChange={setPartField(index, 'part_name')} />
                      </td>
                      <td>
                        <Input aria-label="Width" type="number" min="0" value={part.width} onChange={setPartField(index, 'width')} />
                      </td>
                      <td>
                        <Input aria-label="Height" type="number" min="0" value={part.height} onChange={setPartField(index, 'height')} />
                      </td>
                      <td>
                        <Input aria-label="Quantity" type="number" min="1" value={part.quantity} onChange={setPartField(index, 'quantity')} />
                      </td>
                      <td>
                        <button type="button" className="icon-trigger" aria-label="Remove part" onClick={() => removePart(index)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" icon={Plus} onClick={addPart}>
              Add Part
            </Button>
          </Card>
        </div>

        <div className="nesting-form__side">
          <Card title="Results">
            <Button icon={Calculator} onClick={handleOptimize} loading={calculating} className="nesting-form__optimize-btn">
              {result ? 'Recalculate' : 'Optimize'}
            </Button>

            {result && (
              <div className="nesting-results">
                <div className="nesting-results__stats">
                  <div>
                    <p className="nesting-results__stat-label">Sheets Required</p>
                    <p className="nesting-results__stat-value">{result.sheetsRequired}</p>
                  </div>
                  <div>
                    <p className="nesting-results__stat-label">Utilization</p>
                    <p className="nesting-results__stat-value">{result.utilizationPct}%</p>
                  </div>
                  <div>
                    <p className="nesting-results__stat-label">Parts Placed</p>
                    <p className="nesting-results__stat-value">
                      {result.totalPlaced} / {result.totalRequested}
                    </p>
                  </div>
                  <div>
                    <p className="nesting-results__stat-label">Waste Area</p>
                    <p className="nesting-results__stat-value">{Math.round(result.wasteArea).toLocaleString()} mm²</p>
                  </div>
                </div>

                {result.unplaced.length > 0 && (
                  <Alert tone="warning" title={`${result.unplaced.length} part type(s) could not be placed`}>
                    <ul className="nesting-results__unplaced">
                      {result.unplaced.map((u) => (
                        <li key={u.partId}>
                          {u.name}: {u.quantity} unplaced — {u.reason}
                        </li>
                      ))}
                    </ul>
                  </Alert>
                )}

                <NestingVisualMap
                  sheetWidth={Number(job.sheet_width)}
                  sheetHeight={Number(job.sheet_height)}
                  placements={result.placements}
                  sheetsRequired={result.sheetsRequired}
                />

                <Button variant="outline" icon={Download} onClick={handleExportReport} className="nesting-form__export-btn">
                  Export Nesting Report
                </Button>
              </div>
            )}
          </Card>

          <Button icon={Save} onClick={handleSave} loading={saving} className="nesting-form__save-btn">
            Save Nesting Job
          </Button>
        </div>
      </div>
    </>
  );
}

export default NestingJobForm;
