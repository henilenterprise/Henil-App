import { useRef, useState } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Alert from '../components/ui/Alert.jsx';
import Badge from '../components/ui/Badge.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  downloadTemplate,
  downloadFullExport,
  downloadErrorReport,
  parseWorkbookFile,
  validateImportData,
  executeImport,
} from '../services/dataManagementService.js';
import { IMPORT_ORDER, IMPORT_TABLES } from '../utils/dataManagement/importSchema.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './DataManagement.css';

const RESOLUTION_OPTIONS = [
  { value: 'skip', label: 'Skip (safest \u2014 leave existing record unchanged)' },
  { value: 'update', label: 'Update the existing record' },
  { value: 'create_new', label: 'Import as a new, separate record' },
];

function DataManagement() {
  const toast = useToast();
  const fileInputRef = useRef(null);

  // 'idle' | 'parsing' | 'preview' | 'importing' | 'done'
  const [stage, setStage] = useState('idle');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [resolutions, setResolutions] = useState({}); // tableKey -> 'skip'|'update'|'create_new'
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  function resetImport() {
    setStage('idle');
    setFileName('');
    setParseError(null);
    setValidation(null);
    setResolutions({});
    setImportProgress(null);
    setImportResult(null);
  }

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setStage('parsing');
    setParseError(null);
    try {
      const { sheets } = await parseWorkbookFile(file);
      const result = await validateImportData(sheets);
      setValidation(result);
      const defaultResolutions = {};
      for (const key of IMPORT_ORDER) defaultResolutions[key] = 'skip';
      setResolutions(defaultResolutions);
      setStage('preview');
    } catch (err) {
      setParseError(getErrorMessage(err));
      setStage('idle');
    }
  }

  async function handleConfirmImport() {
    setStage('importing');
    setImportProgress({ tableLabel: '', done: 0, total: 0 });
    try {
      // Apply the chosen per-table resolution to every duplicate row before running.
      const applied = {
        ...validation,
        tables: Object.fromEntries(
          Object.entries(validation.tables).map(([key, t]) => [
            key,
            { ...t, rows: t.rows.map((r) => (r.status === 'duplicate' ? { ...r, resolution: resolutions[key] || 'skip' } : r)) },
          ])
        ),
      };
      const result = await executeImport(applied, (p) => setImportProgress(p));
      setImportResult(result);
      setStage('done');
      const totalCreated = Object.values(result.summary).reduce((s, v) => s + v.created, 0);
      toast.success('Import complete', `${totalCreated} record(s) created across ${IMPORT_ORDER.length} sheets.`);
    } catch (err) {
      toast.error('Import failed', getErrorMessage(err));
      setStage('preview');
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFullExport();
      toast.success('Export ready', 'Your data has been downloaded as an Excel workbook.');
    } catch (err) {
      toast.error("Couldn't export data", getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const totals = validation
    ? Object.values(validation.tables).reduce(
        (acc, t) => ({
          valid: acc.valid + t.counts.valid,
          warnings: acc.warnings + t.counts.warnings,
          errors: acc.errors + t.counts.errors,
          duplicates: acc.duplicates + t.counts.duplicates,
        }),
        { valid: 0, warnings: 0, errors: 0, duplicates: 0 }
      )
    : null;

  return (
    <>
      <PageHeader
        title="Data Management"
        description="Import, export, and back up your business data as Excel workbooks."
      />

      <div className="data-mgmt-grid">
        <Card title="Download Template" className="data-mgmt-card">
          <p className="data-mgmt-card__text">
            Get a ready-to-use Excel workbook with one sheet per data type, matching this application's real fields exactly.
          </p>
          <Button variant="outline" icon={FileSpreadsheet} onClick={downloadTemplate}>
            Download Excel Template
          </Button>
        </Card>

        <Card title="Export Data" className="data-mgmt-card">
          <p className="data-mgmt-card__text">
            Download all of your current business data as a single Excel workbook — useful for backup, migration, or offline analysis. Never includes passwords, API keys, or other credentials.
          </p>
          <Button variant="outline" icon={Download} onClick={handleExport} loading={exporting}>
            Export All Data
          </Button>
        </Card>

        <Card title="Backup" className="data-mgmt-card">
          <p className="data-mgmt-card__text">
            The Export above <em>is</em> your on-demand backup — download it any time and store it safely. For automatic, ongoing database-level backups, enable them in your Supabase project (Settings &rsaquo; Database &rsaquo; Backups).
          </p>
          <Button variant="outline" icon={Download} onClick={handleExport} loading={exporting}>
            Download Backup Now
          </Button>
        </Card>
      </div>

      <Card title="Import Data" className="data-mgmt-section">
        {stage === 'idle' && (
          <>
            {parseError && (
              <Alert tone="danger" title="Couldn't read that file" onDismiss={() => setParseError(null)}>
                {parseError}
              </Alert>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelected}
              className="data-mgmt-hidden-input"
            />
            <div className="data-mgmt-upload">
              <Upload size={28} strokeWidth={1.5} />
              <p className="data-mgmt-upload__title">Upload an Excel or CSV file</p>
              <p className="data-mgmt-upload__hint">
                Use the template above, or your own file — sheet names are matched automatically.
              </p>
              <Button icon={Upload} onClick={handleChooseFile}>
                Select File
              </Button>
            </div>
          </>
        )}

        {stage === 'parsing' && <Spinner size="lg" label={`Reading ${fileName}\u2026`} />}

        {stage === 'preview' && validation && (
          <div className="data-mgmt-preview">
            <div className="data-mgmt-preview__header">
              <div>
                <p className="data-mgmt-preview__title">Import Preview — {fileName}</p>
                <p className="data-mgmt-card__text">Review each sheet below before anything is saved.</p>
              </div>
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetImport}>
                Choose a different file
              </Button>
            </div>

            {validation.unmatchedSheets.length > 0 && (
              <Alert tone="warning" title="Some sheets weren't recognized and will be skipped">
                {validation.unmatchedSheets.join(', ')}
              </Alert>
            )}

            <div className="data-mgmt-summary-row">
              <span className="data-mgmt-summary-chip data-mgmt-summary-chip--valid">
                <CheckCircle2 size={14} /> {totals.valid} valid
              </span>
              <span className="data-mgmt-summary-chip data-mgmt-summary-chip--warn">
                <AlertTriangle size={14} /> {totals.duplicates} duplicate{totals.duplicates === 1 ? '' : 's'}
              </span>
              <span className="data-mgmt-summary-chip data-mgmt-summary-chip--error">
                <XCircle size={14} /> {totals.errors} error{totals.errors === 1 ? '' : 's'}
              </span>
            </div>

            <div className="data-mgmt-table-list">
              {IMPORT_ORDER.filter((key) => validation.tables[key]?.sheetFound).map((key) => {
                const t = validation.tables[key];
                const table = IMPORT_TABLES[key];
                return (
                  <div key={key} className="data-mgmt-table-row">
                    <div className="data-mgmt-table-row__name">
                      <ArrowRight size={13} />
                      {table.sheetName}
                    </div>
                    <div className="data-mgmt-table-row__counts">
                      {t.counts.valid > 0 && <Badge tone="success">{t.counts.valid} valid</Badge>}
                      {t.counts.duplicates > 0 && <Badge tone="warning">{t.counts.duplicates} duplicate</Badge>}
                      {t.counts.errors > 0 && <Badge tone="danger">{t.counts.errors} error</Badge>}
                      {t.counts.valid + t.counts.duplicates + t.counts.errors === 0 && (
                        <Badge tone="neutral">no rows</Badge>
                      )}
                    </div>
                    {t.counts.duplicates > 0 && (
                      <div className="data-mgmt-table-row__resolution">
                        <Select
                          aria-label={`How to handle duplicates in ${table.sheetName}`}
                          value={resolutions[key] || 'skip'}
                          onChange={(e) => setResolutions((r) => ({ ...r, [key]: e.target.value }))}
                          options={RESOLUTION_OPTIONS}
                        />
                      </div>
                    )}
                    {t.rows.some((r) => r.status === 'error') && (
                      <details className="data-mgmt-error-detail">
                        <summary>View error details</summary>
                        <ul>
                          {t.rows
                            .filter((r) => r.status === 'error')
                            .slice(0, 50)
                            .map((r) => (
                              <li key={r.rowNumber}>
                                Row {r.rowNumber}: {r.messages.map((m) => m.text).join(' ')}
                              </li>
                            ))}
                        </ul>
                        {t.rows.filter((r) => r.status === 'error').length > 50 && (
                          <p className="data-mgmt-card__text">
                            + {t.rows.filter((r) => r.status === 'error').length - 50} more — download the error report below for the full list.
                          </p>
                        )}
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="data-mgmt-actions">
              <Button variant="outline" icon={Download} onClick={() => downloadErrorReport(validation)}>
                Download Report
              </Button>
              <div className="data-mgmt-actions__right">
                <Button variant="outline" onClick={resetImport}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmImport} disabled={totals.valid + totals.duplicates === 0}>
                  Import Data
                </Button>
              </div>
            </div>
          </div>
        )}

        {stage === 'importing' && importProgress && (
          <div className="data-mgmt-progress">
            <Spinner size="lg" label={`Importing ${importProgress.tableLabel || '\u2026'}`} />
            {importProgress.total > 0 && (
              <p className="data-mgmt-card__text">
                {importProgress.done} of {importProgress.total} rows in this sheet
              </p>
            )}
          </div>
        )}

        {stage === 'done' && importResult && (
          <div className="data-mgmt-result">
            <Alert tone="success" title="Import complete">
              Your data has been imported. See the breakdown below.
            </Alert>
            <div className="data-mgmt-table-list">
              {IMPORT_ORDER.filter((key) => importResult.summary[key] && Object.values(importResult.summary[key]).some((n) => n > 0)).map(
                (key) => {
                  const s = importResult.summary[key];
                  return (
                    <div key={key} className="data-mgmt-table-row">
                      <div className="data-mgmt-table-row__name">
                        <ArrowRight size={13} />
                        {IMPORT_TABLES[key].sheetName}
                      </div>
                      <div className="data-mgmt-table-row__counts">
                        {s.created > 0 && <Badge tone="success">{s.created} created</Badge>}
                        {s.updated > 0 && <Badge tone="success">{s.updated} updated</Badge>}
                        {s.skipped > 0 && <Badge tone="neutral">{s.skipped} skipped</Badge>}
                        {s.failed > 0 && <Badge tone="danger">{s.failed} failed</Badge>}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
            {importResult.errors.length > 0 && (
              <Alert tone="danger" title={`${importResult.errors.length} row(s) failed during import`}>
                <ul className="data-mgmt-run-errors">
                  {importResult.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      {e.table}, row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
            <Button icon={Upload} onClick={resetImport}>
              Import Another File
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}

export default DataManagement;
