'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import {
  Building2, Shield, CreditCard, Wrench, BarChart3,
  Users, ArrowRight, Sun, Moon, ChevronRight, Zap,
  Clock, Bell, FileText
} from 'lucide-react';

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Building2 size={24} />,
      title: 'Multi-Property Management',
      desc: 'Manage unlimited properties, flats, and units from a single intuitive dashboard with real-time status tracking.',
    },
    {
      icon: <Users size={24} />,
      title: 'Tenant Onboarding',
      desc: 'Streamlined tenant registration with secure credential generation, ID verification, and automated lease management.',
    },
    {
      icon: <CreditCard size={24} />,
      title: 'Rent Collection',
      desc: 'Automated rent scheduling, payment tracking, overdue alerts, and comprehensive financial reporting.',
    },
    {
      icon: <Wrench size={24} />,
      title: 'Maintenance Tracking',
      desc: 'End-to-end request management with priority levels, status workflows, and resolution tracking.',
    },
    {
      icon: <BarChart3 size={24} />,
      title: 'Analytics Dashboard',
      desc: 'Real-time occupancy rates, revenue analytics, collection efficiency metrics, and trend visualization.',
    },
    {
      icon: <Shield size={24} />,
      title: 'Role-Based Access',
      desc: 'Granular permissions with secure JWT authentication, ensuring data isolation between admin and tenant views.',
    },
  ];

  return (
    <div style={{ background: 'var(--bg-primary)' }}>
      {/* Navigation */}
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-brand">
          <div className="sidebar-brand-icon">P</div>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            PropManager
          </span>
        </div>
        <ul className="landing-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#stats">Why Us</a></li>
          <li><a href="#cta">Get Started</a></li>
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/login" className="btn btn-primary" style={{ gap: 6 }}>
            Sign In <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content animate-fadeIn">
          <div className="landing-badge">
            <Zap size={14} />
            Built for modern property managers
          </div>
          <h1>
            Property Management<br />
            <span className="gradient-text">Made Effortless</span>
          </h1>
          <p className="landing-hero-desc">
            Stop juggling spreadsheets and manual processes. PropManager gives you intelligent tools
            to manage properties, tenants, rent collection, and maintenance — all in one place.
          </p>
          <div className="landing-hero-buttons">
            <Link href="/login" className="btn btn-primary btn-lg" style={{ gap: 8 }}>
              Get Started Free <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <div className="landing-section-header">
          <h2>Everything you need to<br />manage properties</h2>
          <p>
            A complete toolkit designed to eliminate the complexity of property management,
            so you can focus on growth.
          </p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="landing-section landing-stats">
        <div className="landing-stats-grid">
          {[
            { value: '99.9%', label: 'Uptime Guarantee' },
            { value: '50k+', label: 'Properties Managed' },
            { value: '< 2min', label: 'Tenant Onboarding' },
            { value: '4.9/5', label: 'User Satisfaction' },
          ].map((s, i) => (
            <div key={i} className="landing-stat-item">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <div className="landing-section-header">
          <h2>Simple. Fast. Powerful.</h2>
          <p>Get started in minutes with our streamlined setup process.</p>
        </div>
        <div className="features-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { icon: <Building2 size={24} />, title: 'Add Properties', desc: 'Register your properties with addresses and unit details.' },
            { icon: <Users size={24} />, title: 'Onboard Tenants', desc: 'Register tenants with ID verification and auto-credentials.' },
            { icon: <FileText size={24} />, title: 'Assign & Track', desc: 'Link tenants to units, auto-generate rent schedules.' },
            { icon: <Bell size={24} />, title: 'Stay Informed', desc: 'Get notified about payments, maintenance, and updates.' },
          ].map((step, i) => (
            <div key={i} className="feature-card" style={{ textAlign: 'center' }}>
              <div className="feature-icon" style={{ margin: '0 auto 18px' }}>{step.icon}</div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--primary-500)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700, margin: '0 auto 12px'
              }}>
                {i + 1}
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="landing-section" style={{ textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Ready to streamline your<br />
            <span className="gradient-text">property management?</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: 32, lineHeight: 1.7 }}>
            Join thousands of property managers who&apos;ve already simplified their workflow with PropManager.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg" style={{ gap: 8 }}>
            Get Started Now <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <div className="sidebar-brand-icon" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>P</div>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>PropManager</span>
        </div>
        <p>&copy; {new Date().getFullYear()} PropManager. All rights reserved.</p>
      </footer>
    </div>
  );
}
