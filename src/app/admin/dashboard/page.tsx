'use client';

import { useEffect, useState } from 'react';
import {
  Building2, DoorOpen, Users, CreditCard, Wrench,
  TrendingUp, TrendingDown, ArrowUpRight, Clock, IndianRupee
} from 'lucide-react';

interface DashboardData {
  properties: { total: number };
  flats: { total: number; occupied: number; vacant: number; maintenance: number };
  tenants: { total: number; active: number };
  payments: { total: number; paid: number; pending: number; overdue: number; revenue: number; outstanding: number };
  maintenance: { open: number; inProgress: number; resolved: number };
  rates: { occupancy: number; collection: number };
  recent: {
    payments: Array<{ id: string; amount: number; paidDate: string; tenant: { firstName: string; lastName: string }; flat: { flatNumber: string } }>;
    maintenance: Array<{ id: string; title: string; status: string; priority: string; createdAt: string; tenant: { firstName: string; lastName: string }; flat: { flatNumber: string } }>;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header"><h1>Dashboard</h1><p>Loading your insights...</p></div>
        <div className="page-body">
          <div className="stat-grid">
            {[1,2,3,4].map(i => <div key={i} className="stat-card"><div className="skeleton" style={{width:'100%',height:80}} /></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return <div className="page-body"><p>Failed to load dashboard data.</p></div>;

  const stats = [
    { label: 'Total Properties', value: data.properties.total, icon: Building2, color: 'purple' },
    { label: 'Occupancy Rate', value: `${data.rates.occupancy}%`, icon: DoorOpen, color: 'blue', change: data.rates.occupancy > 70 ? '+Healthy' : 'Low', positive: data.rates.occupancy > 70 },
    { label: 'Active Tenants', value: data.tenants.active, icon: Users, color: 'green' },
    { label: 'Total Revenue', value: `₹${(data.payments.revenue / 1000).toFixed(0)}K`, icon: IndianRupee, color: 'yellow', change: `${data.payments.paid} paid`, positive: true },
    { label: 'Pending Payments', value: data.payments.pending, icon: CreditCard, color: 'red', change: data.payments.overdue > 0 ? `${data.payments.overdue} overdue` : 'All clear', positive: data.payments.overdue === 0 },
    { label: 'Open Requests', value: data.maintenance.open + data.maintenance.inProgress, icon: Wrench, color: 'yellow', change: `${data.maintenance.inProgress} in progress`, positive: false },
  ];

  const priorityBadge = (p: string) => {
    const map: Record<string, string> = { LOW: 'badge-gray', MEDIUM: 'badge-blue', HIGH: 'badge-yellow', URGENT: 'badge-red' };
    return map[p] || 'badge-gray';
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', RESOLVED: 'badge-green', CLOSED: 'badge-gray', REJECTED: 'badge-red' };
    return map[s] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here&apos;s what&apos;s happening across your properties.</p>
      </div>

      <div className="page-body">
        {/* Stat Cards */}
        <div className="stat-grid">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card animate-fadeIn" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="stat-card-content">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{stat.value}</span>
                {stat.change && (
                  <span className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                    {stat.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {stat.change}
                  </span>
                )}
              </div>
              <div className={`stat-icon ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          ))}
        </div>

        {/* Occupancy Visual */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Flat Occupancy</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {data.flats.total} total units
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                {[
                  { label: 'Occupied', value: data.flats.occupied, color: 'var(--success-500)' },
                  { label: 'Vacant', value: data.flats.vacant, color: 'var(--info-500)' },
                  { label: 'Maintenance', value: data.flats.maintenance, color: 'var(--warning-500)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {item.label}: <strong style={{ color: 'var(--text-primary)' }}>{item.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex' }}>
                {data.flats.total > 0 && (
                  <>
                    <div style={{ width: `${(data.flats.occupied / data.flats.total) * 100}%`, background: 'var(--success-500)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(data.flats.vacant / data.flats.total) * 100}%`, background: 'var(--info-500)', transition: 'width 0.5s' }} />
                    <div style={{ width: `${(data.flats.maintenance / data.flats.total) * 100}%`, background: 'var(--warning-500)', transition: 'width 0.5s' }} />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Collection Summary</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {data.rates.collection}% collected
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Collected</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-500)' }}>₹{(data.payments.revenue).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Outstanding</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-500)' }}>₹{(data.payments.outstanding).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                <div style={{
                  width: `${data.rates.collection}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--success-500), var(--success-600))',
                  borderRadius: 5,
                  transition: 'width 0.5s',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Payments</span>
              <IndianRupee size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {data.recent.payments.length === 0 ? (
                <div className="table-empty"><p>No recent payments</p></div>
              ) : (
                data.recent.payments.map((p) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 24px', borderBottom: '1px solid var(--border-secondary)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {p.tenant.firstName} {p.tenant.lastName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Flat {p.flat.flatNumber}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success-600)' }}>
                        +₹{p.amount.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                        <Clock size={10} />
                        {new Date(p.paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Maintenance</span>
              <Wrench size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {data.recent.maintenance.length === 0 ? (
                <div className="table-empty"><p>No maintenance requests</p></div>
              ) : (
                data.recent.maintenance.map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 24px', borderBottom: '1px solid var(--border-secondary)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {m.tenant.firstName} {m.tenant.lastName} • Flat {m.flat.flatNumber}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className={`badge ${priorityBadge(m.priority)}`}>{m.priority}</span>
                      <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
