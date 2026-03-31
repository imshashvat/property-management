// PMS Tenant Portal - SPA Logic
if (!checkAuth('tenant')) throw new Error('Not authorized');

let tData = {};

document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (user.tenantInfo) {
    document.getElementById('tenantName').textContent = user.tenantInfo.name || user.email;
    document.getElementById('tenantAvatar').textContent = (user.tenantInfo.name || 'T')[0].toUpperCase();
  }
  document.getElementById('tenantCredId').textContent = user.credentialId || '';
  tNavigate('dashboard');
  loadTenantNotifs();
});

function toggleNotifPanel() { document.getElementById('tNotifPanel').classList.toggle('open'); }

async function loadTenantNotifs() {
  try {
    const notifs = await apiRequest('/dashboard/notifications');
    const unread = notifs.filter(n => !n.is_read).length;
    document.getElementById('tNotifDot').classList.toggle('hidden', unread === 0);
    document.getElementById('tNotifList').innerHTML = notifs.length === 0 ? '<div class="empty-state"><p>No notifications</p></div>' :
      notifs.map(n => `<div class="notif-item ${n.is_read ? '' : 'unread'}">
        <div class="notif-title">${n.title}</div><div class="notif-body">${n.body||''}</div>
        <div class="notif-time">${formatDateTime(n.created_at)}</div></div>`).join('');
  } catch(e) {}
}

async function tMarkAllRead() {
  await apiRequest('/dashboard/notifications/read-all', { method: 'PUT' });
  loadTenantNotifs(); showToast('All read', 'success');
}

function tNavigate(view) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const map = { dashboard:0, payments:1, maintenance:2, announcements:3, profile:4 };
  document.querySelectorAll('.nav-item')[map[view]]?.classList.add('active');
  const titles = { dashboard:'Dashboard', payments:'My Payments', maintenance:'Maintenance', announcements:'Announcements', profile:'My Profile' };
  document.getElementById('tPageTitle').textContent = titles[view] || view;
  document.getElementById('tPageContent').innerHTML = '<div class="spinner"></div>';
  document.getElementById('sidebar').classList.remove('open');

  const loaders = { dashboard: loadTenantDashboard, payments: loadTenantPayments, maintenance: loadTenantMaintenance, announcements: loadTenantAnnouncements, profile: loadTenantProfile };
  if (loaders[view]) loaders[view]();
}

// ═══ DASHBOARD ═══
async function loadTenantDashboard() {
  try {
    const d = await apiRequest('/dashboard/tenant');
    tData = d;
    const a = d.assignment;
    const pendingPayments = d.payments?.filter(p => p.status === 'Pending' || p.status === 'Overdue') || [];
    const openMaint = d.maintenanceRequests?.filter(m => m.status === 'Open' || m.status === 'In Progress') || [];

    document.getElementById('tPageContent').innerHTML = `
      ${a ? `<div class="card mb-6">
        <div class="card-header"><h3>🏠 My Flat</h3>${statusBadge('Active')}</div>
        <div class="card-body">
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
            <div><div style="font-size:12px;color:var(--text-muted)">Flat Number</div><div style="font-size:20px;font-weight:700">${a.flat_number}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Building</div><div style="font-size:16px;font-weight:600">${a.building_name || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Floor</div><div style="font-size:16px;font-weight:600">${a.floor}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Bedrooms</div><div style="font-size:16px;font-weight:600">${a.bedrooms} BHK</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Monthly Rent</div><div style="font-size:20px;font-weight:700;color:var(--accent-primary)">${formatCurrency(a.rent_amount)}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Property</div><div style="font-size:16px;font-weight:600">${a.property_name}</div></div>
          </div>
          <div style="margin-top:16px;font-size:13px;color:var(--text-secondary)">
            📍 ${a.property_address || ''} &nbsp;|&nbsp; 📅 Lease: ${formatDate(a.lease_start)} → ${formatDate(a.lease_end)}
            ${a.amenities ? `&nbsp;|&nbsp; ✨ ${a.amenities}` : ''}
          </div>
        </div>
      </div>` : '<div class="card mb-6"><div class="card-body"><div class="empty-state"><h3>No flat assigned</h3><p>Contact your administrator</p></div></div></div>'}

      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card"><div class="stat-icon amber">💰</div><div class="stat-value">${pendingPayments.length}</div><div class="stat-label">Pending Payments</div></div>
        <div class="stat-card"><div class="stat-icon blue">🔧</div><div class="stat-value">${openMaint.length}</div><div class="stat-label">Open Maintenance</div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-value">${d.payments?.filter(p => p.status === 'Paid').length || 0}</div><div class="stat-label">Payments Made</div></div>
      </div>

      <div class="grid-2 mt-6">
        <div class="card">
          <div class="card-header"><h3>💳 Recent Payments</h3><button class="btn btn-sm btn-outline" onclick="tNavigate('payments')">View All</button></div>
          <div class="card-body"><div class="table-container"><table><thead><tr><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            ${(d.payments || []).slice(0,5).map(p => `<tr><td>${formatDate(p.due_date)}</td><td>${formatCurrency(p.amount)}</td><td>${statusBadge(p.status)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">No payments</td></tr>'}
          </tbody></table></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🔧 Maintenance Requests</h3><button class="btn btn-sm btn-outline" onclick="tNavigate('maintenance')">View All</button></div>
          <div class="card-body"><div class="table-container"><table><thead><tr><th>Issue</th><th>Priority</th><th>Status</th></tr></thead><tbody>
            ${(d.maintenanceRequests || []).slice(0,5).map(m => `<tr><td>${m.title}</td><td>${priorityBadge(m.priority)}</td><td>${statusBadge(m.status)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-center">No requests</td></tr>'}
          </tbody></table></div></div>
        </div>
      </div>

      ${(d.announcements || []).length > 0 ? `<div class="mt-6"><h3 style="font-size:16px;font-weight:700;margin-bottom:12px">📢 Announcements</h3>
        ${d.announcements.map(a => `<div class="card mb-4"><div class="card-body"><h4 style="font-weight:700;margin-bottom:8px">${a.title}</h4>
          <p style="color:var(--text-secondary);font-size:13px">${a.body}</p>
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">${formatDateTime(a.created_at)}</div></div></div>`).join('')}
      </div>` : ''}`;
  } catch (e) { document.getElementById('tPageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

// ═══ PAYMENTS ═══
async function loadTenantPayments() {
  try {
    const payments = await apiRequest('/rent');
    tData.allPayments = payments;
    document.getElementById('tPageContent').innerHTML = `
      <div class="action-bar">
        <div class="filter-group">
          <select id="tPayFilter" onchange="filterTenantPayments()">
            <option value="">All</option><option value="Pending">Pending</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option>
          </select>
        </div>
        <span style="font-size:14px;color:var(--text-secondary)">${payments.length} records</span>
      </div>
      <div class="card"><div class="card-body"><div class="table-container" id="tPayTable"></div></div></div>`;
    renderTenantPayments(payments);
  } catch (e) { document.getElementById('tPageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function renderTenantPayments(payments) {
  document.getElementById('tPayTable').innerHTML = payments.length === 0 ? '<div class="empty-state"><h3>No payments</h3></div>' :
    `<table><thead><tr><th>Due Date</th><th>Amount</th><th>Status</th><th>Paid On</th><th>Receipt #</th><th>Action</th></tr></thead><tbody>
    ${payments.map(p => `<tr><td>${formatDate(p.due_date)}</td><td style="font-weight:700">${formatCurrency(p.amount)}</td>
      <td>${statusBadge(p.status)}</td><td>${formatDate(p.payment_date)}</td>
      <td><code style="font-size:11px">${p.receipt_number||'—'}</code></td>
      <td>${p.status !== 'Paid' ? `<button class="btn btn-sm btn-success" onclick="tenantPay(${p.id})">Pay Now</button>` : '✅ Paid'}</td>
    </tr>`).join('')}</tbody></table>`;
}

async function filterTenantPayments() {
  const status = document.getElementById('tPayFilter').value;
  const filtered = status ? tData.allPayments.filter(p => p.status === status) : tData.allPayments;
  renderTenantPayments(filtered);
}

async function tenantPay(id) {
  if (!confirm('Confirm payment? (Simulated — in production this connects to a payment gateway)')) return;
  try { await apiRequest(`/rent/${id}/pay`, { method: 'PUT', body: JSON.stringify({}) }); showToast('Payment successful!', 'success'); loadTenantPayments(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ═══ MAINTENANCE ═══
async function loadTenantMaintenance() {
  try {
    const requests = await apiRequest('/maintenance');
    tData.maintenance = requests;
    document.getElementById('tPageContent').innerHTML = `
      <div class="action-bar">
        <h2 style="font-size:16px">${requests.length} Requests</h2>
        <button class="btn btn-primary" onclick="showNewMaintenanceForm()">+ New Request</button>
      </div>
      ${requests.length === 0 ? '<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">🔧</div><h3>No maintenance requests</h3><p>Submit a request when you need something fixed</p></div></div></div>' :
      requests.map(m => `<div class="card mb-4">
        <div class="card-header">
          <div><h3>${m.title}</h3><span style="font-size:12px;color:var(--text-muted)">Submitted ${formatDate(m.created_at)}</span></div>
          <div class="flex gap-2">${priorityBadge(m.priority)} ${statusBadge(m.status)}</div>
        </div>
        <div class="card-body">
          <p style="color:var(--text-secondary);font-size:13px">${m.description || 'No description'}</p>
          ${m.technician_name ? `<p style="margin-top:8px;font-size:13px">👷 Assigned: ${m.technician_name}</p>` : ''}
          ${m.status === 'Resolved' || m.status === 'Closed' ? `<div style="margin-top:12px">
            <button class="btn btn-sm btn-outline" onclick="showFeedbackForm(${m.id})">⭐ Rate Service</button></div>` : ''}
        </div>
      </div>`).join('')}`;
  } catch (e) { document.getElementById('tPageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function showNewMaintenanceForm() {
  document.getElementById('tModalTitle').textContent = 'New Maintenance Request';
  document.getElementById('tModalBody').innerHTML = `
    <div class="form-group-app"><label>Issue Title *</label><input type="text" id="mTitle" placeholder="e.g. Leaking Faucet"></div>
    <div class="form-group-app"><label>Description</label><textarea id="mDesc" rows="4" placeholder="Describe the issue in detail..."></textarea></div>
    <div class="form-group-app"><label>Priority</label><select id="mPriority">
      <option value="Low">Low</option><option value="Medium" selected>Medium</option><option value="High">High</option><option value="Urgent">Urgent</option>
    </select></div>`;
  document.getElementById('tModalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('tFormModal')">Cancel</button>
    <button class="btn btn-primary" onclick="submitMaintenance()">Submit Request</button>`;
  openModal('tFormModal');
}

async function submitMaintenance() {
  try {
    await apiRequest('/maintenance', { method: 'POST', body: JSON.stringify({
      title: document.getElementById('mTitle').value,
      description: document.getElementById('mDesc').value,
      priority: document.getElementById('mPriority').value
    })});
    closeModal('tFormModal'); showToast('Request submitted!', 'success'); loadTenantMaintenance();
  } catch (e) { showToast(e.message, 'error'); }
}

function showFeedbackForm(maintId) {
  document.getElementById('tModalTitle').textContent = '⭐ Rate Maintenance Service';
  document.getElementById('tModalBody').innerHTML = `
    <div class="form-group-app"><label>Rating (1-5)</label>
      <div id="starRating" style="font-size:32px;cursor:pointer">
        ${'★'.repeat(5).split('').map((s,i) => `<span onclick="setRating(${i+1})" data-star="${i+1}" style="color:var(--border-color);transition:color 0.2s">${s}</span>`).join('')}
      </div>
      <input type="hidden" id="fbRating" value="0">
    </div>
    <div class="form-group-app"><label>Comment</label><textarea id="fbComment" rows="3" placeholder="Share your experience..."></textarea></div>`;
  document.getElementById('tModalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('tFormModal')">Cancel</button>
    <button class="btn btn-primary" onclick="submitFeedback(${maintId})">Submit</button>`;
  openModal('tFormModal');
}

function setRating(r) {
  document.getElementById('fbRating').value = r;
  document.querySelectorAll('#starRating span').forEach(s => {
    s.style.color = parseInt(s.dataset.star) <= r ? 'var(--accent-amber)' : 'var(--border-color)';
  });
}

async function submitFeedback(maintId) {
  const rating = parseInt(document.getElementById('fbRating').value);
  if (!rating) { showToast('Please select a rating', 'warning'); return; }
  try {
    await apiRequest(`/maintenance/${maintId}/feedback`, { method: 'POST', body: JSON.stringify({
      rating, comment: document.getElementById('fbComment').value
    })});
    closeModal('tFormModal'); showToast('Thank you for your feedback!', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ═══ ANNOUNCEMENTS ═══
async function loadTenantAnnouncements() {
  try {
    const announcements = await apiRequest('/dashboard/announcements');
    document.getElementById('tPageContent').innerHTML = announcements.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">📢</div><h3>No announcements</h3></div>' :
      announcements.map(a => `<div class="card mb-4">
        <div class="card-header"><h3>${a.title}</h3><span style="font-size:12px;color:var(--text-muted)">${formatDateTime(a.created_at)}</span></div>
        <div class="card-body"><p style="color:var(--text-secondary)">${a.body}</p></div></div>`).join('');
  } catch (e) { document.getElementById('tPageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

// ═══ PROFILE ═══
async function loadTenantProfile() {
  try {
    const user = getUser();
    const me = await apiRequest('/auth/me');
    const info = me.tenantInfo || {};
    document.getElementById('tPageContent').innerHTML = `
      <div class="card">
        <div class="card-header"><h3>👤 My Profile</h3></div>
        <div class="card-body">
          <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
            <div><div style="font-size:12px;color:var(--text-muted)">Full Name</div><div style="font-size:16px;font-weight:600">${info.name || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Email</div><div style="font-size:16px;font-weight:600">${info.email || me.email || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Phone</div><div style="font-size:16px;font-weight:600">${info.phone || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Emergency Contact</div><div style="font-size:16px;font-weight:600">${info.emergency_contact || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Credential ID</div><div style="font-size:16px;font-weight:600;font-family:monospace">${me.credential_id || '—'}</div></div>
            <div><div style="font-size:12px;color:var(--text-muted)">Account Status</div><div>${statusBadge('Active')}</div></div>
          </div>
        </div>
      </div>
      <div class="card mt-6">
        <div class="card-header"><h3>🔒 Change Password</h3></div>
        <div class="card-body">
          <div style="max-width:400px">
            <div class="form-group-app"><label>Current Password</label><input type="password" id="profCurPwd"></div>
            <div class="form-group-app"><label>New Password</label><input type="password" id="profNewPwd" minlength="8"></div>
            <div class="form-group-app"><label>Confirm New Password</label><input type="password" id="profConfPwd" minlength="8"></div>
            <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
          </div>
        </div>
      </div>`;
  } catch (e) { document.getElementById('tPageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

async function changePassword() {
  const cur = document.getElementById('profCurPwd').value;
  const newP = document.getElementById('profNewPwd').value;
  const conf = document.getElementById('profConfPwd').value;
  if (newP !== conf) { showToast('Passwords do not match', 'error'); return; }
  if (newP.length < 8) { showToast('Password must be 8+ characters', 'error'); return; }
  try {
    await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ currentPassword: cur, newPassword: newP }) });
    showToast('Password updated!', 'success');
    document.getElementById('profCurPwd').value = '';
    document.getElementById('profNewPwd').value = '';
    document.getElementById('profConfPwd').value = '';
  } catch (e) { showToast(e.message, 'error'); }
}
