import { useState } from 'react';
import {
  Plus, Download, Trash2, Search as SearchIcon, Mail, MoreVertical,
  Pencil, Copy, FileText, Users, PackageSearch,
} from 'lucide-react';
import {
  Button, Input, Select, Textarea, Modal, ConfirmDialog, Dropdown,
  Card, Badge, Table, Pagination, SearchBar, DatePicker, Alert,
  Spinner, EmptyState,
} from '../components/ui';
import { useToast } from '../context/ToastContext.jsx';
import './UIShowcase.css';

const SAMPLE_ROWS = [
  { id: 1, name: 'Acrylic Sheet — 6mm Clear', category: 'Sheet Stock', stock: 240, status: 'In Stock' },
  { id: 2, name: 'Polycarbonate — 4mm Frosted', category: 'Sheet Stock', stock: 12, status: 'Low Stock' },
  { id: 3, name: 'Custom Acrylic Display Case', category: 'Fabrication', stock: 0, status: 'Out of Stock' },
  { id: 4, name: 'Laser-Cut Signage Panel', category: 'Fabrication', stock: 58, status: 'In Stock' },
  { id: 5, name: 'Polycarbonate — 10mm Twin Wall', category: 'Sheet Stock', stock: 34, status: 'In Stock' },
];

const STATUS_TONE = {
  'In Stock': 'success',
  'Low Stock': 'warning',
  'Out of Stock': 'danger',
};

function Section({ eyebrow, title, description, children }) {
  return (
    <section className="showcase-section">
      <div className="showcase-section__intro">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="text-muted">{description}</p>}
      </div>
      <div className="showcase-section__body">{children}</div>
    </section>
  );
}

function UIShowcase() {
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [date, setDate] = useState(null);
  const [page, setPage] = useState(1);
  const [showEmpty, setShowEmpty] = useState(false);

  function handleConfirmDelete() {
    setConfirmLoading(true);
    setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast.success('Item deleted', 'The record was removed successfully.');
    }, 900);
  }

  return (
    <div className="showcase">
      <header className="showcase__header">
        <div className="container showcase__header-inner">
          <div>
            <p className="eyebrow">Henil Enterprise</p>
            <h1>Design System &amp; UI Kit</h1>
            <p className="text-muted">
              Every reusable component, style, and state used across the Business
              Management System — built on one consistent token system.
            </p>
          </div>
          <Badge tone="gold">Foundation stage</Badge>
        </div>
      </header>

      <div className="container showcase__content">
        {/* ---------------- Typography ---------------- */}
        <Section eyebrow="Foundation" title="Typography" description="Heading scale, body copy, and micro-labels.">
          <Card>
            <div className="type-scale">
              <div className="type-row"><h1>Heading 1 — Aa</h1><span className="text-muted">32–36px · Georgia</span></div>
              <div className="type-row"><h2>Heading 2 — Aa</h2><span className="text-muted">28px · Georgia</span></div>
              <div className="type-row"><h3>Heading 3 — Aa</h3><span className="text-muted">22px · Georgia</span></div>
              <div className="type-row"><h4>Heading 4 — Aa</h4><span className="text-muted">18px · System sans</span></div>
              <div className="type-row"><p style={{ margin: 0 }}>Body text — the quick brown fox jumps over the lazy dog.</p><span className="text-muted">15px</span></div>
              <div className="type-row"><p className="eyebrow" style={{ margin: 0 }}>Eyebrow label</p><span className="text-muted">12px · uppercase</span></div>
            </div>
          </Card>
        </Section>

        {/* ---------------- Color ---------------- */}
        <Section eyebrow="Foundation" title="Color palette">
          <div className="swatch-grid">
            {[
              ['Black', '#0a0a0a'], ['Charcoal', '#1f1f1f'], ['Gold', '#c9a227'],
              ['Gold light', '#e2c463'], ['Neutral 700', '#4d4d4d'], ['Neutral 300', '#c2c2c2'],
              ['Success', '#2e7d4f'], ['Warning', '#b8860b'], ['Danger', '#a12f2f'], ['Info', '#2f5aa1'],
            ].map(([name, hex]) => (
              <div className="swatch" key={name}>
                <div className="swatch__color" style={{ backgroundColor: hex }} />
                <p className="swatch__name">{name}</p>
                <p className="swatch__hex text-muted">{hex}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- Buttons ---------------- */}
        <Section eyebrow="Components" title="Button" description="Variants, sizes, icons, and states.">
          <Card>
            <div className="showcase-row">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="showcase-row" style={{ marginTop: 'var(--space-4)' }}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="showcase-row" style={{ marginTop: 'var(--space-4)' }}>
              <Button icon={Plus}>New quotation</Button>
              <Button icon={Download} variant="outline" iconPosition="right">Export</Button>
              <Button loading>Saving…</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Card>
        </Section>

        {/* ---------------- Form controls ---------------- */}
        <Section eyebrow="Components" title="Form controls" description="Input, Select, Textarea, DatePicker — default, focus, error, and disabled states.">
          <Card>
            <div className="form-grid">
              <Input label="Client name" placeholder="e.g. Shree Fabricators" required />
              <Input label="Email address" type="email" placeholder="name@company.com" icon={Mail} helperText="Used for sending quotations." />
              <Input label="Contact number" placeholder="+91 " error="This field is required." />
              <Input label="Disabled field" placeholder="Not editable" disabled />

              <Select
                label="Material"
                placeholder="Choose material"
                options={[
                  { value: 'acrylic', label: 'Acrylic' },
                  { value: 'polycarbonate', label: 'Polycarbonate' },
                  { value: 'both', label: 'Acrylic + Polycarbonate' },
                ]}
                helperText="Primary raw material for this job."
              />
              <DatePicker label="Delivery date" value={date} onChange={setDate} helperText="Estimated dispatch date." />

              <Textarea
                label="Job description"
                placeholder="Describe cutting, engraving, or fabrication requirements…"
                className="form-grid__full"
              />
            </div>
          </Card>
        </Section>

        {/* ---------------- Search ---------------- */}
        <Section eyebrow="Components" title="Search bar">
          <Card>
            <div style={{ maxWidth: 360 }}>
              <SearchBar
                value={searchValue}
                onChange={setSearchValue}
                onClear={() => setSearchValue('')}
                placeholder="Search products, clients, invoices…"
              />
            </div>
          </Card>
        </Section>

        {/* ---------------- Badges ---------------- */}
        <Section eyebrow="Components" title="Badge" description="Status indicators used across tables and cards.">
          <Card>
            <div className="showcase-row">
              <Badge tone="neutral">Draft</Badge>
              <Badge tone="gold">Featured</Badge>
              <Badge tone="success" dot>In Stock</Badge>
              <Badge tone="warning" dot>Low Stock</Badge>
              <Badge tone="danger" dot>Out of Stock</Badge>
              <Badge tone="info">Processing</Badge>
            </div>
          </Card>
        </Section>

        {/* ---------------- Alerts ---------------- */}
        <Section eyebrow="Components" title="Alert">
          <div className="stack">
            <Alert tone="info" title="Heads up">
              Quotation #Q-1042 is awaiting client approval.
            </Alert>
            <Alert tone="success" title="Saved successfully">
              Product details were updated.
            </Alert>
            <Alert tone="warning" title="Low inventory" onDismiss={() => {}}>
              3 items have fallen below their reorder threshold.
            </Alert>
            <Alert tone="danger" title="Action failed">
              Could not generate the invoice PDF. Please try again.
            </Alert>
          </div>
        </Section>

        {/* ---------------- Card & Dropdown ---------------- */}
        <Section eyebrow="Components" title="Card &amp; Dropdown">
          <div className="card-grid">
            <Card
              title="Acrylic Sheet — 6mm Clear"
              subtitle="SKU: HE-AC-6C-001"
              actions={
                <Dropdown
                  align="right"
                  trigger={
                    <button type="button" className="icon-trigger" aria-label="More actions">
                      <MoreVertical size={16} />
                    </button>
                  }
                  items={[
                    { label: 'Edit', icon: Pencil, onClick: () => toast.info('Edit clicked') },
                    { label: 'Duplicate', icon: Copy, onClick: () => toast.info('Duplicate clicked') },
                    { divider: true },
                    { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => setConfirmOpen(true) },
                  ]}
                />
              }
            >
              <p style={{ margin: 0 }}>240 sheets in stock · Sheet Stock category</p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Badge tone="success" dot>In Stock</Badge>
              </div>
            </Card>

            <Card title="This month" subtitle="Quotations issued">
              <h2 style={{ margin: 0 }}>18</h2>
              <p className="text-muted" style={{ margin: 0 }}>+4 compared to last month</p>
            </Card>
          </div>
        </Section>

        {/* ---------------- Table & Pagination ---------------- */}
        <Section eyebrow="Components" title="Table &amp; Pagination">
          <Card padding="none">
            <div style={{ padding: 'var(--space-5)', paddingBottom: 0 }}>
              <div className="showcase-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <Button size="sm" variant="ghost" onClick={() => setShowEmpty((v) => !v)}>
                  Toggle empty state
                </Button>
                <Button size="sm" icon={Plus}>Add product</Button>
              </div>
            </div>
            <div style={{ padding: '0 var(--space-5) var(--space-5)' }}>
              {showEmpty ? (
                <EmptyState
                  icon={PackageSearch}
                  title="No products found"
                  description="Try adjusting your search, or add your first product to get started."
                  action={<Button size="sm" icon={Plus}>Add product</Button>}
                />
              ) : (
                <Table
                  columns={[
                    { key: 'name', header: 'Product' },
                    { key: 'category', header: 'Category' },
                    { key: 'stock', header: 'Stock', align: 'right' },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
                    },
                  ]}
                  rows={SAMPLE_ROWS}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-4) var(--space-5)' }}>
              <Pagination currentPage={page} totalPages={6} onPageChange={setPage} />
            </div>
          </Card>
        </Section>

        {/* ---------------- Loading ---------------- */}
        <Section eyebrow="Components" title="Loading spinner">
          <Card>
            <div className="showcase-row" style={{ alignItems: 'center' }}>
              <Spinner size="sm" inline label="Small" />
              <Spinner size="md" inline label="Medium" />
              <Spinner size="lg" inline label="Large" />
            </div>
          </Card>
        </Section>

        {/* ---------------- Modal / Confirm / Toast triggers ---------------- */}
        <Section eyebrow="Components" title="Modal, confirmation dialog &amp; toast notifications">
          <Card>
            <div className="showcase-row">
              <Button icon={FileText} onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
                Delete item
              </Button>
              <Button variant="outline" onClick={() => toast.success('Quotation sent', 'Q-1042 was emailed to the client.')}>
                Show success toast
              </Button>
              <Button variant="outline" onClick={() => toast.error('Upload failed', 'The drawing file exceeds 10MB.')}>
                Show error toast
              </Button>
              <Button variant="outline" onClick={() => toast.warning('Low stock', 'Polycarbonate 4mm is running low.')}>
                Show warning toast
              </Button>
              <Button variant="outline" icon={Users} onClick={() => toast.info('3 new clients this week')}>
                Show info toast
              </Button>
            </div>
          </Card>
        </Section>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Quotation"
        description="Create a quotation for acrylic or polycarbonate fabrication work."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success('Quotation created', 'Draft Q-1043 was saved.');
              }}
            >
              Create quotation
            </Button>
          </>
        }
      >
        <div className="stack">
          <Input label="Client name" placeholder="e.g. Shree Fabricators" required />
          <Select
            label="Material"
            placeholder="Choose material"
            options={[
              { value: 'acrylic', label: 'Acrylic' },
              { value: 'polycarbonate', label: 'Polycarbonate' },
            ]}
          />
          <Textarea label="Notes" placeholder="Additional details for this quotation…" rows={3} />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={confirmLoading}
        tone="danger"
        title="Delete this item?"
        description="This action cannot be undone. The record will be permanently removed."
        confirmLabel="Delete"
      />
    </div>
  );
}

export default UIShowcase;
