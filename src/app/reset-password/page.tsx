'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Eye, EyeOff, AlertCircle, KeyRound, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurPwd, setShowCurPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch current user details since we are logged in (session exists)
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.data) {
          setUserId(data.data.id);
          setRole(data.data.role);
          setLoading(false);
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    };
    fetchUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to update password');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(role === 'ADMIN' ? '/admin/dashboard' : '/tenant/dashboard');
      }, 2000);
    } catch {
      setError('Server connection failed. Try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 24, height: 24, border: '3px solid var(--primary-500)', borderRightColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="login-wrapper">
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="login-card animate-slideUp">
        <div className="login-logo" style={{ marginBottom: 20 }}>
          <div className="login-logo-icon">P</div>
          <span className="login-logo-text">PropManager</span>
        </div>

        <h1 className="login-title">Reset Password</h1>
        <p className="login-subtitle">
          For security reasons, you must change your temporary password before continuing.
        </p>

        {success ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 10px', textAlign: 'center' }}>
            <CheckCircle size={48} color="var(--success-500)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Password Updated Successfully!</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Redirecting to your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 30 }}>
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-50)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: '0.85rem', color: 'var(--danger-600)' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <div style={{ lineHeight: 1.4 }}>{error}</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="cur-password">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="cur-password" 
                  type={showCurPwd ? 'text' : 'password'} 
                  className="form-input" 
                  placeholder="Enter current password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  required 
                  style={{ paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowCurPwd(!showCurPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                  {showCurPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="new-password">New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  id="new-password" 
                  type={showNewPwd ? 'text' : 'password'} 
                  className="form-input" 
                  placeholder="At least 6 characters" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  minLength={6} 
                  style={{ paddingRight: 42 }}
                />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                  {showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label className="form-label" htmlFor="new-confirm">Confirm New Password</label>
              <input 
                id="new-confirm" 
                type="password" 
                className="form-input" 
                placeholder="Confirm your new password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={submitting} style={{ marginTop: 24 }}>
              {submitting ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Updating...</span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><KeyRound size={18} /> Update Password</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
