import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Pencil, Trash2, ArrowLeft, Building2, Phone, Mail, FileText,
  Receipt, CreditCard, Landmark, MapPin, StickyNote, RotateCcw,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Alert from '../components/ui/Alert.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ClientFormModal from '../components/clients/ClientFormModal.jsx';
import FilesPanel from '../components/files/FilesPanel.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getClient, updateClient, deleteClient } from '../services/clientsService.js';
import { formatDate } from '../utils/formatDate.js';
import { getErrorMessage } from '../utils/getErrorMessage.js';
import './ClientDetails.css';

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="client-detail-row">
      <Icon size={15} className="client-detail-row__icon" />
      <div>
        <p className="client-detail-row__label">{label}</p>
        <p className="client-detail-row__value">{value || '—'}</p>
      </div>
    </div>
  );
}

function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClient(id);
      setClient(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  async function handleEditSubmit(payload) {
    const updated = await updateClient(id, payload);
    setClient(updated);
    toast.success('Client updated', `${updated.company_name} was updated successfully.`);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteClient(id);
      toast.success('Client deleted', `${client?.company_name ?? 'Client'} was removed.`);
      navigate('/clients');
    } catch (err) {
      toast.error('Couldn’t delete client', getErrorMessage(err));
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return <Spinner size="lg" label="Loading client…" />;
  }

  if (error) {
    return (
      <>
        <Link to="/clients" className="client-details__back">
          <ArrowLeft size={14} />
          Back to clients
        </Link>
        <Alert tone="danger" title="Couldn't load this client">
          {error}
        </Alert>
        <div className="client-details__retry">
          <Button variant="outline" icon={RotateCcw} onClick={fetchClient}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (!client) return null;

  const addressLines = [client.address, [client.city, client.state].filter(Boolean).join(', '), client.pincode]
    .filter(Boolean)
    .join('\n');

  return (
    <>
      <Link to="/clients" className="client-details__back">
        <ArrowLeft size={14} />
        Back to clients
      </Link>

      <PageHeader
        title={client.company_name}
        description={`Client since ${formatDate(client.created_at)}`}
        actions={
          <>
            <Button variant="outline" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </>
        }
      />

      <div className="client-details__grid">
        <Card title="Contact information">
          <div className="client-detail-rows">
            <DetailRow icon={Building2} label="Contact person" value={client.contact_person} />
            <DetailRow icon={Phone} label="Phone" value={client.phone} />
            <DetailRow icon={Mail} label="Email" value={client.email} />
            <DetailRow icon={Landmark} label="GST number" value={client.gst_number} />
            <DetailRow
              icon={MapPin}
              label="Address"
              value={addressLines ? addressLines.split('\n').join(', ') : null}
            />
            <DetailRow icon={StickyNote} label="Notes" value={client.notes} />
          </div>
        </Card>

        <Card title="Outstanding amount" subtitle="Across all unpaid invoices">
          <p className="client-outstanding-value">{'—'}</p>
          <p className="client-outstanding-hint">Available once the Invoices module is connected.</p>
        </Card>
      </div>

      <div className="client-details__grid">
        <Card title="Quotations" subtitle="Quotations issued to this client">
          <EmptyState
            icon={FileText}
            title="No quotations yet"
            description="The Quotations module hasn't been built yet."
          />
        </Card>

        <Card title="Invoices" subtitle="Invoices issued to this client">
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="The Invoices module hasn't been built yet."
          />
        </Card>
      </div>

      <Card title="Payments" subtitle="Payments received from this client" className="client-details__section">
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="The Payments module hasn't been built yet."
        />
      </Card>

      <FilesPanel clientId={client.id} title="Files" />

      <ClientFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        tone="danger"
        title="Delete this client?"
        description={`This will permanently remove ${client.company_name}. This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </>
  );
}

export default ClientDetails;
