'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Phone, Shield, Key } from 'lucide-react';
import Toast from '@/components/Toast';

interface UserData {
  id: string; name: string; email: string; phone: string | null;
  tenant: { credentialId: string; firstName: string; lastName: string; phone: string; emergencyContact: string | null; idProofType: string | null; idProofNumber: string | null; };
}

export default function TenantProfile() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changingPwd, setChangingPwd] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { method: 'POST' }).then(r => r.json()).then(d => {
      if (d.success) setUser(d.data);
      setLoading(false);
    });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setToast({ message: 'Passwords do not match', type: 'error' }); return;
    }
    if (pwdForm.newPassword.length < 8) {
      setToast({ message: 'Password must be at least 8 characters', type: 'error' }); return;
    }
    setChangingPwd(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }),
    });
    const d = await res.json();
    setChangingPwd(false);
    if (d.success) {
      setToast({ message: 'Password changed successfully!', type: 'success' });
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
    } else {
      setToast({ message: d.error, type: 'error' });
    }
  };

  if (loading) return <div><div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} /></div>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Your account details and security settings</p>
      </div>

      <div className="grid-2">
        {/* Profile Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">Personal Information</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg, var(--primary-400), var(--primary-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.3rem' }}>
                {user?.tenant?.firstName?.[0]}{user?.tenant?.lastName?.[0]}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>{user?.name}</h3>
                <code style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>{user?.tenant?.credentialId}</code>
              </div>
            </div>
            {[
              { icon: Mail, label: 'Email', value: user?.email },
              { icon: Phone, label: 'Phone', value: user?.tenant?.phone },
              { icon: Phone, label: 'Emergency Contact', value: user?.tenant?.emergencyContact || '—' },
              { icon: Shield, label: 'ID Proof', value: user?.tenant?.idProofType ? `${user.tenant.idProofType}: ${user.tenant.idProofNumber}` : '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-secondary)' }}>
                <item.icon size={16} style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-header"><span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Key size={16} /> Change Password</span></div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={changingPwd} style={{ marginTop: 8 }}>
                {changingPwd ? <><span className="spinner" /> Updating...</> : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
