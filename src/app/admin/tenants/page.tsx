'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Search, Eye, X, Copy, CheckCircle } from 'lucide-react';
import Toast from '@/components/Toast';

interface Tenant {
  id: string; credentialId: string; firstName: string; lastName: string; phone: string;
  emergencyContact: string | null; idProofType: string | null; idProofNumber: string | null; idProofUrl: string | null;
  user: { email: string; isActive: boolean };
  assignments: Array<{ flat: { flatNumber: string; property: { name: string } }; rentAmount: number; startDate: string }>;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState<{ credentialId: string; email: string; temporaryPassword: string } | null>(null);
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');

  const loadData = useCallback(async () => {
    const res = await fetch('/api/tenants');
    const d = await res.json();
    if (d.success) setTenants(d.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);

    const res = await fetch('/api/tenants', { method: 'POST', body: formData });
    const d = await res.json();
    setSubmitting(false);

    if (d.success) {
      setShowModal(false);
      setShowCredentials(d.data.credentials);
      loadData();
    } else {
      setToast({ message: d.error, type: 'error' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const filtered = tenants.filter(t =>
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    t.credentialId.toLowerCase().includes(search.toLowerCase()) ||
    t.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header"><h1>Tenants</h1><p>Manage tenant registrations and credentials</p></div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input">
              <Search size={18} />
              <input className="form-input" placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Register Tenant</button>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Users /><h3>No tenants found</h3><p>Register your first tenant</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Tenant</th><th>Credential ID</th><th>Contact</th><th>Assignment</th><th>ID Proof</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg, var(--primary-400), var(--primary-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                          {t.firstName[0]}{t.lastName[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.firstName} {t.lastName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{t.credentialId}</code></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.phone}</td>
                    <td>
                      {t.assignments.length > 0 ? (
                        <div style={{ fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 500 }}>Flat {t.assignments[0].flat.flatNumber}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{t.assignments[0].flat.property.name}</div>
                        </div>
                      ) : <span className="badge badge-gray">Unassigned</span>}
                    </td>
                    <td>
                      {t.idProofType ? (
                        <span className="badge badge-blue">{t.idProofType}</span>
                      ) : <span className="badge badge-gray">None</span>}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewTenant(t)} aria-label="View details"><Eye size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Register New Tenant</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name <span className="required">*</span></label>
                    <input name="firstName" className="form-input" required placeholder="First name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name <span className="required">*</span></label>
                    <input name="lastName" className="form-input" required placeholder="Last name" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email <span className="required">*</span></label>
                    <input name="email" type="email" className="form-input" required placeholder="tenant@email.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone <span className="required">*</span></label>
                    <input name="phone" className="form-input" required placeholder="+91 9876543210" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Contact</label>
                  <input name="emergencyContact" className="form-input" placeholder="Emergency contact number" />
                </div>

                <div style={{ borderTop: '1px solid var(--border-secondary)', margin: '20px 0', paddingTop: 20 }}>
                  <h4 style={{ marginBottom: 16, fontSize: '0.95rem' }}>Government ID Proof <span className="required">*</span></h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ID Type <span className="required">*</span></label>
                      <select name="idProofType" className="form-select" required>
                        <option value="">Select ID Type</option>
                        <option value="AADHAAR">Aadhaar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVING_LICENSE">Driving License</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ID Number <span className="required">*</span></label>
                      <input name="idProofNumber" className="form-input" required placeholder="ID number" />
                    </div>
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><span className="spinner" /> Registering...</> : 'Register Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="modal-overlay" onClick={() => setShowCredentials(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={20} style={{ color: 'var(--success-500)' }} />
                Tenant Registered
              </h2>
              <button className="modal-close" onClick={() => setShowCredentials(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Save these credentials securely. The temporary password must be changed on first login.
              </p>
              {[
                { label: 'Credential ID', value: showCredentials.credentialId },
                { label: 'Email', value: showCredentials.email },
                { label: 'Temporary Password', value: showCredentials.temporaryPassword },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px',
                  background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 8,
                  border: '1px solid var(--border-primary)'
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'monospace' }}>{item.value}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => copyToClipboard(item.value, item.label)}>
                    {copied === item.label ? <CheckCircle size={16} style={{ color: 'var(--success-500)' }} /> : <Copy size={16} />}
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowCredentials(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* View Tenant Modal */}
      {viewTenant && (
        <div className="modal-overlay" onClick={() => setViewTenant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tenant Details</h2>
              <button className="modal-close" onClick={() => setViewTenant(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg, var(--primary-400), var(--primary-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
                  {viewTenant.firstName[0]}{viewTenant.lastName[0]}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>{viewTenant.firstName} {viewTenant.lastName}</h3>
                  <code style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{viewTenant.credentialId}</code>
                </div>
              </div>
              {[
                { label: 'Email', value: viewTenant.user.email },
                { label: 'Phone', value: viewTenant.phone },
                { label: 'Emergency Contact', value: viewTenant.emergencyContact || '—' },
                { label: 'ID Type', value: viewTenant.idProofType || '—' },
                { label: 'ID Number', value: viewTenant.idProofNumber || '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-secondary)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
              {viewTenant.idProofUrl && (
                <div style={{ marginTop: 16 }}>
                  <span className="form-label">ID Proof Document</span>
                  <a href={viewTenant.idProofUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
                    <Eye size={14} /> View Document
                  </a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewTenant(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
