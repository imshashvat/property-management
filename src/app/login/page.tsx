'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Eye, EyeOff, LogIn, AlertCircle, UserPlus, Shield, Users } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  
  // Three explicit modes: admin-login, tenant-login, admin-signup
  const [mode, setMode] = useState<'admin-login' | 'tenant-login' | 'admin-signup'>('admin-login');
  
  const [email, setEmail] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-init DB on first load silently
  useEffect(() => {
    fetch('/api/init', { method: 'POST' }).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const loginId = mode === 'admin-login' ? email : credentialId;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginId, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error?.includes('ENOTFOUND') || data.error?.includes('ECONNREFUSED') || data.error?.includes('Failed to connect')) {
          setError('Database connection failed. Please ensure DATABASE_URL in your .env file is correct and the database is running.');
        } else {
          setError(data.error || 'Invalid credentials');
        }
        setLoading(false);
        return;
      }

      if (data.data.mustResetPwd) {
        router.push('/reset-password');
      } else if (data.data.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/tenant/dashboard');
      }
    } catch {
      setError('Server connection failed. Is the database running?');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.error?.includes('ENOTFOUND') || data.error?.includes('ECONNREFUSED') || data.error?.includes('Failed to connect')) {
          setError('Database connection failed. Please ensure DATABASE_URL in your .env file is correct and the database is running.');
        } else {
          setError(data.error || 'Registration failed');
        }
        setLoading(false);
        return;
      }

      setSuccessMsg('Admin account created! You can now sign in.');
      setMode('admin-login');
      setEmail(email);
      setPassword('');
      setName('');
      setConfirmPassword('');
      setLoading(false);
    } catch {
      setError('Server connection failed. Is the database running?');
      setLoading(false);
    }
  };

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '12px 16px', textAlign: 'center' as const, fontSize: '0.85rem', fontWeight: 600,
    cursor: 'pointer', borderBottom: active ? '2px solid var(--primary-500)' : '2px solid transparent',
    color: active ? 'var(--primary-500)' : 'var(--text-secondary)',
    transition: 'all 0.2s ease', background: active ? 'var(--primary-50)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
  });

  return (
    <div className="login-wrapper">
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="login-card animate-slideUp" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-secondary)', background: 'var(--bg-secondary)' }}>
          <div style={tabStyle(mode === 'admin-login')} onClick={() => { setMode('admin-login'); setError(''); setSuccessMsg(''); }}>
            <Shield size={16} /> Admin
          </div>
          <div style={tabStyle(mode === 'tenant-login')} onClick={() => { setMode('tenant-login'); setError(''); setSuccessMsg(''); }}>
            <Users size={16} /> Tenant
          </div>
          <div style={tabStyle(mode === 'admin-signup')} onClick={() => { setMode('admin-signup'); setError(''); setSuccessMsg(''); }}>
            <UserPlus size={16} /> Signup
          </div>
        </div>

        <div style={{ padding: '40px' }}>
          <div className="login-logo">
            <div className="login-logo-icon">P</div>
            <span className="login-logo-text">PropManager</span>
          </div>

          <h1 className="login-title">
            {mode === 'admin-login' && 'Admin Login'}
            {mode === 'tenant-login' && 'Tenant Login'}
            {mode === 'admin-signup' && 'Create Admin'}
          </h1>
          <p className="login-subtitle">
            {mode === 'admin-login' && 'Sign in to management portal'}
            {mode === 'tenant-login' && 'Access your property portal'}
            {mode === 'admin-signup' && 'Create your property admin account'}
          </p>

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: '0.85rem', color: 'var(--success-600)' }}>
              {successMsg}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-50)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 20, fontSize: '0.85rem', color: 'var(--danger-600)' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div style={{ lineHeight: 1.4 }}>{error}</div>
            </div>
          )}

          {mode === 'admin-signup' ? (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input id="reg-name" type="text" className="form-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email</label>
                <input id="reg-email" type="email" className="form-input" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="reg-password" type={showPwd ? 'text' : 'password'} className="form-input" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ paddingRight: 42 }} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                <input id="reg-confirm" type="password" className="form-input" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-primary login-btn" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Creating Account...</span> : <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={18} /> Signup</span>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-id">
                  {mode === 'admin-login' ? 'Admin Email' : 'Credential ID or Email'}
                </label>
                <input 
                  id="login-id" 
                  type={mode === 'admin-login' ? 'email' : 'text'} 
                  className="form-input" 
                  placeholder={mode === 'admin-login' ? 'admin@propmanager.com' : 'T-12345678 or tenant@email.com'}
                  value={mode === 'admin-login' ? email : credentialId} 
                  onChange={(e) => mode === 'admin-login' ? setEmail(e.target.value) : setCredentialId(e.target.value)} 
                  required 
                  autoComplete="username" 
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="login-password" type={showPwd ? 'text' : 'password'} className="form-input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 42 }} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary login-btn" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="spinner" /> Signing in...</span> : <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LogIn size={18} /> Login</span>}
              </button>
            </form>
          )}

          <div className="login-footer" style={{ marginTop: 24 }}>
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', textAlign: 'left', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Testing Locally?</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                You must have a Postgres database running and <code style={{color:'var(--primary-500)'}}>DATABASE_URL</code> set in your <code style={{color:'var(--primary-500)'}}>.env</code> file. Without a real database connection, login and signup will timeout or fail.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
