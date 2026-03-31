'use client';

import { useEffect, useState, useCallback } from 'react';
import { DoorOpen, Plus, Search, Edit2, Trash2, X, Home } from 'lucide-react';
import Toast from '@/components/Toast';

interface Flat {
  id: string; flatNumber: string; floor: number; bedrooms: number; bathrooms: number;
  area: number | null; rentAmount: number; depositAmount: number | null; status: string;
  furnishing: string; property: { id: string; name: string };
  assignments: Array<{ tenant: { firstName: string; lastName: string; credentialId: string } }>;
}

interface Property { id: string; name: string; }

export default function FlatsPage() {
  const [flats, setFlats] = useState<Flat[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Flat | null>(null);
  const [search, setSearch] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({
    propertyId: '', flatNumber: '', floor: '0', bedrooms: '1', bathrooms: '1',
    area: '', rentAmount: '', depositAmount: '', furnishing: 'UNFURNISHED', description: ''
  });

  const loadData = useCallback(async () => {
    const [flatsRes, propsRes] = await Promise.all([fetch('/api/flats'), fetch('/api/properties')]);
    const [flatsData, propsData] = await Promise.all([flatsRes.json(), propsRes.json()]);
    if (flatsData.success) setFlats(flatsData.data);
    if (propsData.success) setProperties(propsData.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ propertyId: properties[0]?.id || '', flatNumber: '', floor: '0', bedrooms: '1', bathrooms: '1', area: '', rentAmount: '', depositAmount: '', furnishing: 'UNFURNISHED', description: '' });
    setShowModal(true);
  };

  const openEdit = (f: Flat) => {
    setEditItem(f);
    setForm({
      propertyId: f.property.id, flatNumber: f.flatNumber, floor: String(f.floor),
      bedrooms: String(f.bedrooms), bathrooms: String(f.bathrooms), area: f.area ? String(f.area) : '',
      rentAmount: String(f.rentAmount), depositAmount: f.depositAmount ? String(f.depositAmount) : '',
      furnishing: f.furnishing, description: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editItem ? 'PUT' : 'POST';
    const body = editItem ? { id: editItem.id, ...form } : form;
    const res = await fetch('/api/flats', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) {
      setToast({ message: editItem ? 'Flat updated!' : 'Flat created!', type: 'success' });
      setShowModal(false);
      loadData();
    } else {
      setToast({ message: d.error, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flat?')) return;
    const res = await fetch(`/api/flats?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) { setToast({ message: 'Flat deleted', type: 'success' }); loadData(); }
  };

  const filtered = flats.filter(f => {
    const matchSearch = f.flatNumber.toLowerCase().includes(search.toLowerCase()) || f.property.name.toLowerCase().includes(search.toLowerCase());
    const matchProp = !filterProperty || f.property.id === filterProperty;
    const matchStatus = !filterStatus || f.status === filterStatus;
    return matchSearch && matchProp && matchStatus;
  });

  const statusBadge = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      VACANT: { cls: 'badge-green', label: 'Vacant' },
      OCCUPIED: { cls: 'badge-blue', label: 'Occupied' },
      UNDER_MAINTENANCE: { cls: 'badge-yellow', label: 'Maintenance' },
    };
    return map[s] || { cls: 'badge-gray', label: s };
  };

  return (
    <div>
      <div className="page-header"><h1>Flats</h1><p>Manage units across your properties</p></div>
      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input">
              <Search size={18} />
              <input className="form-input" placeholder="Search flats..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
            </div>
            <select className="form-select filter-select" value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="form-select filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="VACANT">Vacant</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="UNDER_MAINTENANCE">Maintenance</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> Add Flat</button>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
        ) : filtered.length === 0 ? (
          <div className="empty-state"><DoorOpen /><h3>No flats found</h3><p>Add flats to your properties</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Flat</th><th>Property</th><th>Config</th><th>Rent</th><th>Status</th><th>Tenant</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const badge = statusBadge(f.status);
                  const tenant = f.assignments[0]?.tenant;
                  return (
                    <tr key={f.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-500)' }}>
                            <Home size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.flatNumber}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Floor {f.floor}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{f.property.name}</td>
                      <td>
                        <span style={{ fontSize: '0.825rem' }}>{f.bedrooms}BHK • {f.bathrooms}BA</span>
                        {f.area && <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{f.area} sq ft</div>}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{f.rentAmount.toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {tenant ? `${tenant.firstName} ${tenant.lastName}` : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(f)}><Edit2 size={15} /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(f.id)} style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Edit Flat' : 'Add Flat'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Property <span className="required">*</span></label>
                  <select className="form-select" value={form.propertyId} onChange={e => setForm({...form, propertyId: e.target.value})} required>
                    <option value="">Select Property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Flat Number <span className="required">*</span></label>
                    <input className="form-input" value={form.flatNumber} onChange={e => setForm({...form, flatNumber: e.target.value})} required placeholder="e.g., A-101" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Floor</label>
                    <input type="number" className="form-input" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bedrooms</label>
                    <input type="number" min="0" className="form-input" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bathrooms</label>
                    <input type="number" min="0" className="form-input" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Rent Amount <span className="required">*</span></label>
                    <input type="number" className="form-input" value={form.rentAmount} onChange={e => setForm({...form, rentAmount: e.target.value})} required placeholder="Monthly rent" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Security Deposit</label>
                    <input type="number" className="form-input" value={form.depositAmount} onChange={e => setForm({...form, depositAmount: e.target.value})} placeholder="Deposit amount" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Area (sq ft)</label>
                    <input type="number" className="form-input" value={form.area} onChange={e => setForm({...form, area: e.target.value})} placeholder="e.g., 1200" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Furnishing</label>
                    <select className="form-select" value={form.furnishing} onChange={e => setForm({...form, furnishing: e.target.value})}>
                      <option value="UNFURNISHED">Unfurnished</option>
                      <option value="SEMI_FURNISHED">Semi Furnished</option>
                      <option value="FULLY_FURNISHED">Fully Furnished</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'} Flat</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
