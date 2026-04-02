'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { LayoutDashboard, CreditCard, Wrench, User, Sun, Moon, LogOut } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/tenant/dashboard', icon: LayoutDashboard },
  { label: 'Payments', href: '/tenant/payments', icon: CreditCard },
  { label: 'Maintenance', href: '/tenant/maintenance', icon: Wrench },
  { label: 'Profile', href: '/tenant/profile', icon: User },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.success || d.data.role !== 'TENANT') {
          router.push('/login');
        } else {
          setUser(d.data);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="tenant-layout">
      <header className="tenant-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-brand-icon" style={{ width: 32, height: 32, fontSize: '0.85rem' }}>P</div>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>PropManager</span>
          </div>
          <nav className="tenant-nav">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`tenant-nav-link ${pathname === item.href ? 'active' : ''}`}
              >
                <item.icon size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: 8 }}>
              Hi, <strong style={{ color: 'var(--text-primary)' }}>{user.name?.split(' ')[0]}</strong>
            </span>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 34, height: 34 }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ gap: 6 }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>
      <main className="tenant-body">
        {children}
      </main>
    </div>
  );
}
