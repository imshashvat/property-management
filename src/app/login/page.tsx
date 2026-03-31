'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      if (!res.ok) {
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

        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your account to continue</p>

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
              placeholder="admin@propmanager.com"
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

        <div className="login-footer">
          <p style={{ marginBottom: 12 }}>Demo credentials:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              fontSize: '0.78rem'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' }}>Admin</div>
              <div style={{ color: 'var(--text-secondary)' }}>admin@propmanager.com</div>
              <div style={{ color: 'var(--text-secondary)' }}>Admin@123</div>
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              fontSize: '0.78rem'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' }}>Tenant</div>
              <div style={{ color: 'var(--text-secondary)' }}>rahul@email.com</div>
              <div style={{ color: 'var(--text-secondary)' }}>Tenant@123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
