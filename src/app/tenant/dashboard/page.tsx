'use client';

import { useEffect, useState } from 'react';
import { Building2, CreditCard, Wrench, Calendar, IndianRupee, Clock } from 'lucide-react';

interface TenantData {
  name: string;
  email: string;
  tenant: {
    credentialId: string;
    firstName: string;
    lastName: string;
    assignments: Array<{
      flat: {
        flatNumber: string;
        bedrooms: number;
        bathrooms: number;
        area: number | null;
        furnishing: string;
        property: { name: string; address: string; city: string };
      };
      rentAmount: number;
      startDate: string;
      endDate: string | null;
      deposit: number;
    }>;
  };
}

interface Payment {
  id: string; amount: number; month: number; year: number; status: string; dueDate: string; paidDate: string | null;
}

interface MReq {
  id: string; title: string; status: string; priority: string; createdAt: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TenantDashboard() {
  const [data, setData] = useState<TenantData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MReq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/rent').then(r => r.json()),
      fetch('/api/maintenance').then(r => r.json()),
    ]).then(([userData, payData, maintData]) => {
      if (userData.success) setData(userData.data);
      if (payData.success) setPayments(payData.data);
      if (maintData.success) setMaintenance(maintData.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div style={{ marginBottom: 24 }}><div className="skeleton" style={{ height: 32, width: 250, borderRadius: 8 }} /></div>
      <div className="stat-grid">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}</div>
    </div>
  );

  const assignment = data?.tenant?.assignments?.[0];
  const flat = assignment?.flat;
  const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE');
  const openMaint = maintenance.filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS');

  const sBadge = (s: string) => ({ PAID: 'badge-green', PENDING: 'badge-yellow', OVERDUE: 'badge-red' }[s] || 'badge-gray');
  const mBadge = (s: string) => ({ OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', RESOLVED: 'badge-green', CLOSED: 'badge-gray' }[s] || 'badge-gray');

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Welcome back, {data?.tenant?.firstName}! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
          Here&apos;s an overview of your tenancy at a glance.
        </p>
      </div>

      {/* Flat Details Card */}
      {flat ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <Building2 size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Flat {flat.flatNumber}</h2>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{flat.property.name} — {flat.property.city}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Config', value: `${flat.bedrooms}BHK · ${flat.bathrooms}BA` },
                    { label: 'Area', value: flat.area ? `${flat.area} sq ft` : '—' },
                    { label: 'Furnishing', value: flat.furnishing.replace('_', ' ') },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 2 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Rent</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-500)', letterSpacing: '-0.03em' }}>
                  ₹{assignment!.rentAmount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <Calendar size={12} /> Since {new Date(assignment!.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <Building2 size={40} style={{ color: 'var(--text-tertiary)', opacity: 0.4, margin: '0 auto 12px' }} />
            <h3>No Active Assignment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You haven&apos;t been assigned to a flat yet.</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">Pending Payments</span>
            <span className="stat-value">{pendingPayments.length}</span>
          </div>
          <div className="stat-icon red"><CreditCard size={24} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">Open Requests</span>
            <span className="stat-value">{openMaint.length}</span>
          </div>
          <div className="stat-icon yellow"><Wrench size={24} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <span className="stat-label">Total Paid</span>
            <span className="stat-value">₹{payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-icon green"><IndianRupee size={24} /></div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Payments</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {payments.length === 0 ? (
              <div className="table-empty"><p>No payment history</p></div>
            ) : payments.slice(0, 5).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-secondary)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{MONTHS[p.month - 1]} {p.year}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} /> Due: {new Date(p.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>₹{p.amount.toLocaleString('en-IN')}</span>
                  <span className={`badge ${sBadge(p.status)}`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Maintenance Requests</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {maintenance.length === 0 ? (
              <div className="table-empty"><p>No requests submitted</p></div>
            ) : maintenance.slice(0, 5).map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-secondary)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className={`badge ${mBadge(m.status)}`}>{m.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
