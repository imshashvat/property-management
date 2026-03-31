'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wrench, Plus, X } from 'lucide-react';
import Toast from '@/components/Toast';

interface MReq {
  id: string; title: string; description: string; category: string; priority: string; status: string;
  resolution: string | null; createdAt: string; resolvedAt: string | null;
  flat: { flatNumber: string; property: { name: string } };
}

export default function TenantMaintenance() {
  const [requests, setRequests] = useState<MReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/maintenance');
    const d = await res.json();
    if (d.success) setRequests(d.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (d.success) {
      setToast({ message: 'Request submitted!', type: 'success' });
      setShowModal(false);
      setForm({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
      loadData();
    } else {
      setToast({ message: d.error, type: 'error' });
    }
  };

  const pBadge = (p: string) => ({ LOW: 'badge-gray', MEDIUM: 'badge-blue', HIGH: 'badge-yellow', URGENT: 'badge-red' }[p] || 'badge-gray');
  const sBadge = (s: string) => ({ OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', RESOLVED: 'badge-green', CLOSED: 'badge-gray', REJECTED: 'badge-red' }[s] || 'badge-gray');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Maintenance</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Submit and track your maintenance requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Request</button>
      </div>

      {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} /> : requests.length === 0 ? (
        <div className="empty-state"><Wrench /><h3>No maintenance requests</h3><p>Submit a request if something needs fixing</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map(r => (
            <div key={r.id} className="card">
              <div className="card-body" style={{ padding: '18px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{r.title}</h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge ${pBadge(r.priority)}`}>{r.priority}</span>
                    <span className={`badge ${sBadge(r.status)}`}>{r.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{r.description}</p>
                <div style={{ display: 'flex', gap: 20, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                  <span>Category: <strong>{r.category}</strong></span>
                  <span>Submitted: {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {r.resolvedAt && <span>Resolved: {new Date(r.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                </div>
                {r.resolution && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Resolution</div>
                    <p style={{ fontSize: '0.85rem' }}>{r.resolution}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">New Maintenance Request</h2><button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title <span className="required">*</span></label>
                  <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Brief description of the issue" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description <span className="required">*</span></label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4} placeholder="Provide details about the issue..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      <option value="GENERAL">General</option><option value="PLUMBING">Plumbing</option>
                      <option value="ELECTRICAL">Electrical</option><option value="STRUCTURAL">Structural</option>
                      <option value="APPLIANCE">Appliance</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                      <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option><option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
