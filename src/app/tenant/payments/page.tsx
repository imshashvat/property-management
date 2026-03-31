'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Clock, IndianRupee } from 'lucide-react';

interface Payment {
  id: string; amount: number; month: number; year: number; status: string;
  dueDate: string; paidDate: string | null; paymentMethod: string | null; lateFee: number;
  flat: { flatNumber: string; property: { name: string } };
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TenantPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rent').then(r => r.json()).then(d => { if (d.success) setPayments(d.data); setLoading(false); });
  }, []);

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.amount, 0);
  const sBadge = (s: string) => ({ PAID: 'badge-green', PENDING: 'badge-yellow', OVERDUE: 'badge-red' }[s] || 'badge-gray');

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Payments</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Your rent payment history and schedule</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-content"><span className="stat-label">Total Paid</span><span className="stat-value" style={{ color: 'var(--success-500)' }}>₹{totalPaid.toLocaleString('en-IN')}</span></div>
          <div className="stat-icon green"><IndianRupee size={24} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content"><span className="stat-label">Outstanding</span><span className="stat-value" style={{ color: 'var(--danger-500)' }}>₹{totalPending.toLocaleString('en-IN')}</span></div>
          <div className="stat-icon red"><CreditCard size={24} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content"><span className="stat-label">Total Records</span><span className="stat-value">{payments.length}</span></div>
          <div className="stat-icon blue"><Clock size={24} /></div>
        </div>
      </div>

      {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} /> : payments.length === 0 ? (
        <div className="empty-state"><CreditCard /><h3>No payments yet</h3><p>Your rent schedule will appear here</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Period</th><th>Flat</th><th>Amount</th><th>Due Date</th><th>Paid Date</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{MONTHS[p.month - 1]} {p.year}</td>
                  <td style={{ fontSize: '0.85rem' }}>{p.flat.flatNumber}<div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{p.flat.property.name}</div></td>
                  <td style={{ fontWeight: 700 }}>₹{p.amount.toLocaleString('en-IN')}{p.lateFee > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--danger-500)' }}> +₹{p.lateFee}</span>}</td>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(p.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.paidDate ? new Date(p.paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{p.paymentMethod || '—'}</td>
                  <td><span className={`badge ${sBadge(p.status)}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
