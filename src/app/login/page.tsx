'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Eye, EyeOff, LogIn, AlertCircle, UserPlus, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register' | 'checking'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [hasAdmin, setHasAdmin] = useState(true);

  // Check if database is initialized and admin exists
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // First, initialize the database schema
        await fetch('/api/init', { method: 'POST' });
        
        // Then check if admin exists
        const res = await fetch('/api/init');
        const data = await res.json();
        
        if (data.success) {
          setHasAdmin(data.data.hasAdmin);
          setMode(data.data.hasAdmin ? 'login' : 'register');
        } else {
          setMode('login');
        }
      } catch {
        setMode('login');
      }
    };
    checkSetup();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials');
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
      setError('Something went wrong. Please try again.');
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
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccessMsg('Admin account created! You can now sign in.');
      setHasAdmin(true);
      setMode('login');
      setEmail(email);
      setPassword('');
      setName('');
      setConfirmPassword('');
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (mode === 'checking') {
    return (
      <div className="login-wrapper">
        <div className="login-card animate-slideUp" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div className="login-logo">
            <div className="login-logo-icon">P</div>
            <span className="login-logo-text">PropManager</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Setting up...</p>
          <div className="spinner" style={{ margin: '20px auto' }} />
        </div>
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
        <div className="login-logo">
          <div className="login-logo-icon">P</div>
          <span className="login-logo-text">PropManager</span>
        </div>

        {mode === 'register' ? (
          <>
            <h1 className="login-title">
              {!hasAdmin ? 'Create Admin Account' : 'Register Admin'}
            </h1>
            <p className="login-subtitle">
              {!hasAdmin
                ? 'Set up your first admin account to get started'
                : 'Create a new admin account'}
            </p>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'var(--danger-50)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)', marginBottom: 20,
                fontSize: '0.85rem', color: 'var(--danger-600)'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reg-password"
                    type={showPwd ? 'text' : 'password'}
                    className="form-input"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ paddingRight: 42 }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                      padding: 4
                    }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  className="form-input"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary login-btn"
                disabled={loading}
                style={{ marginTop: 8 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" /> Creating Account...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserPlus size={18} /> Create Admin Account
                  </span>
                )}
              </button>
            </form>

            {hasAdmin && (
              <div className="login-footer" style={{ marginTop: 20 }}>
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--primary-500)', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto'
                  }}
                >
                  <ArrowLeft size={14} /> Back to login
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to your account to continue</p>

            {successMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 'var(--radius-md)', marginBottom: 20,
                fontSize: '0.85rem', color: 'var(--success-600)'
              }}>
                {successMsg}
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', background: 'var(--danger-50)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)', marginBottom: 20,
                fontSize: '0.85rem', color: 'var(--danger-600)'
              }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email or Credential ID</label>
                <input
                  id="login-email"
                  type="text"
                  className="form-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: 42 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                      padding: 4
                    }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary login-btn"
                disabled={loading}
                style={{ marginTop: 8 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" /> Signing in...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LogIn size={18} /> Sign In
                  </span>
                )}
              </button>
            </form>

            <div className="login-footer" style={{ marginTop: 20 }}>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                Admin users can sign in with their email. Tenants can use their credential ID or email.
              </p>
              
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', textAlign: 'left', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Default Admin Account:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Email:</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>admin@propmanager.com</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>Password:</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>Admin@123</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
