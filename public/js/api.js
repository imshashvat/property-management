// PMS API Helper
const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('pms_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
      // Try refresh
      const refreshed = await refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${localStorage.getItem('pms_token')}`;
        const retry = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (retry.ok) return await retry.json();
      }
      localStorage.clear();
      window.location.href = '/';
      return null;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

async function refreshToken() {
  try {
    const rt = localStorage.getItem('pms_refresh_token');
    if (!rt) return false;
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt })
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('pms_token', data.accessToken);
    localStorage.setItem('pms_refresh_token', data.refreshToken);
    return true;
  } catch { return false; }
}

function getUser() {
  return JSON.parse(localStorage.getItem('pms_user') || 'null');
}

function logout() {
  localStorage.clear();
  window.location.href = '/';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const cls = (status || '').toLowerCase().replace(/\s+/g, '-');
  return `<span class="badge-status ${cls}">${status}</span>`;
}

function priorityBadge(priority) {
  const cls = (priority || '').toLowerCase();
  return `<span class="badge-status ${cls}">${priority}</span>`;
}

function openModal(id) {
  document.getElementById(id)?.classList.add('show');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
}

function checkAuth(requiredRole) {
  const user = getUser();
  const token = localStorage.getItem('pms_token');
  if (!token || !user) { window.location.href = '/'; return false; }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = user.role === 'admin' ? '/admin' : '/tenant';
    return false;
  }
  if (user.darkMode) document.documentElement.setAttribute('data-theme', 'dark');
  return true;
}

async function toggleDarkMode() {
  try {
    const data = await apiRequest('/auth/toggle-dark-mode', { method: 'POST' });
    const user = getUser();
    user.darkMode = data.darkMode;
    localStorage.setItem('pms_user', JSON.stringify(user));
    document.documentElement.setAttribute('data-theme', data.darkMode ? 'dark' : 'light');
  } catch (err) {
    showToast('Failed to toggle dark mode', 'error');
  }
}
