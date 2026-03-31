'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, MapPin, X } from 'lucide-react';
import Toast from '@/components/Toast';

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  type: string;
  description: string | null;
  totalFlats: number;
  _count: { flats: number };
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Property | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zipCode: '', type: 'APARTMENT', description: '' });

  const loadData = useCallback(async () => {
    const res = await fetch('/api/properties');
    const d = await res.json();
    if (d.success) setProperties(d.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', address: '', city: '', state: '', zipCode: '', type: 'APARTMENT', description: '' });
    setShowModal(true);
  };

  const openEdit = (p: Property) => {
    setEditItem(p);
    setForm({ name: p.name, address: p.address, city: p.city, state: p.state, zipCode: p.zipCode, type: p.type, description: p.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editItem ? 'PUT' : 'POST';
    const body = editItem ? { id: editItem.id, ...form } : form;
    const res = await fetch('/api/properties', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) {
      setToast({ message: editItem ? 'Property updated!' : 'Property created!', type: 'success' });
      setShowModal(false);
      loadData();
    } else {
      setToast({ message: d.error, type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    const res = await fetch(`/api/properties?id=${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.success) {
      setToast({ message: 'Property deleted', type: 'success' });
      loadData();
    }
  };

  const filtered = properties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase())
  );

  const typeLabels: Record<string, string> = { APARTMENT: 'Apartment', VILLA: 'Villa', COMMERCIAL: 'Commercial', MIXED: 'Mixed Use' };

  return (
    <div>
      <div className="page-header">
        <h1>Properties</h1>
        <p>Manage your property portfolio</p>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-input">
              <Search size={18} />
              <input className="form-input" placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Add Property
          </button>
        </div>

        {loading ? (
          <div className="stat-grid">
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h3>No properties found</h3>
            <p>{search ? 'Try a different search term' : 'Start by adding your first property'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {filtered.map(p => (
              <div key={p.id} className="card" style={{ cursor: 'default' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: 4 }}>{p.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                        <MapPin size={14} />
                        {p.city}, {p.state}
                      </div>
                    </div>
                    <span className="badge badge-purple">{typeLabels[p.type] || p.type}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                    {p.address}, {p.zipCode}
                  </p>
                  {p.description && (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-secondary)', paddingTop: 14 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {p._count.flats} {p._count.flats === 1 ? 'flat' : 'flats'}
                    </span>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} aria-label="Edit"><Edit2 size={15} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)} aria-label="Delete" style={{ color: 'var(--danger-500)' }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Edit Property' : 'Add Property'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Property Name <span className="required">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g., Sunrise Apartments" />
                </div>
                <div className="form-group">
                  <label className="form-label">Address <span className="required">*</span></label>
                  <input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} required placeholder="Full street address" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City <span className="required">*</span></label>
                    <input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State <span className="required">*</span></label>
                    <input className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">ZIP Code <span className="required">*</span></label>
                    <input className="form-input" value={form.zipCode} onChange={e => setForm({...form, zipCode: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="APARTMENT">Apartment</option>
                      <option value="VILLA">Villa</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="MIXED">Mixed Use</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description of the property..." rows={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'} Property</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
