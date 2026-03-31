// PMS Admin Application - SPA Logic
if (!checkAuth('admin')) throw new Error('Not authorized');

let currentView = 'dashboard';
let cachedData = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  document.getElementById('sidebarUserName').textContent = user.email || 'Admin';
  navigate('dashboard');
  loadNotifications();
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleNotifications() {
  document.getElementById('notifPanel').classList.toggle('open');
}

async function loadNotifications() {
  try {
    const notifs = await apiRequest('/dashboard/notifications');
    const unread = notifs.filter(n => !n.is_read).length;
    document.getElementById('notifDot').classList.toggle('hidden', unread === 0);
    const list = document.getElementById('notifList');
    list.innerHTML = notifs.length === 0 ? '<div class="empty-state"><p>No notifications</p></div>' :
      notifs.map(n => `<div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body || ''}</div>
        <div class="notif-time">${formatDateTime(n.created_at)}</div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

async function markNotifRead(id) {
  await apiRequest(`/dashboard/notifications/${id}/read`, { method: 'PUT' });
  loadNotifications();
}

async function markAllRead() {
  await apiRequest('/dashboard/notifications/read-all', { method: 'PUT' });
  loadNotifications();
  showToast('All notifications marked as read', 'success');
}

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  const viewMap = { dashboard:0, properties:1, flats:2, tenants:3, assignments:4, rent:5, maintenance:6, announcements:7, audit:8 };
  if (items[viewMap[view]]) items[viewMap[view]].classList.add('active');

  const titles = { dashboard:'Dashboard', properties:'Properties', flats:'Flats', tenants:'Tenants', assignments:'Assignments', rent:'Rent & Payments', maintenance:'Maintenance', announcements:'Announcements', audit:'Audit Logs' };
  document.getElementById('pageTitle').textContent = titles[view] || view;
  document.getElementById('breadcrumb').textContent = `Home / ${titles[view] || view}`;

  document.getElementById('pageContent').innerHTML = '<div class="spinner"></div>';
  document.getElementById('sidebar').classList.remove('open');

  const loaders = { dashboard: loadDashboard, properties: loadProperties, flats: loadFlats, tenants: loadTenants, assignments: loadAssignments, rent: loadRent, maintenance: loadMaintenance, announcements: loadAnnouncements, audit: loadAuditLogs };
  if (loaders[view]) loaders[view]();
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
  try {
    const d = await apiRequest('/dashboard/admin');
    cachedData.dashboard = d;
    document.getElementById('pageContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon purple">🏘️</div><div class="stat-value">${d.totalProperties}</div><div class="stat-label">Properties</div></div>
        <div class="stat-card"><div class="stat-icon blue">🏠</div><div class="stat-value">${d.totalFlats}</div><div class="stat-label">Total Flats</div><div class="stat-trend up">${d.occupancyRate}% Occupancy</div></div>
        <div class="stat-card"><div class="stat-icon green">👥</div><div class="stat-value">${d.activeTenants}</div><div class="stat-label">Active Tenants</div><div class="stat-trend">${d.totalTenants} total registered</div></div>
        <div class="stat-card"><div class="stat-icon amber">💰</div><div class="stat-value">${formatCurrency(d.monthlyIncome)}</div><div class="stat-label">Monthly Income</div></div>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-value">${formatCurrency(d.totalCollected)}</div><div class="stat-label">Total Collected</div></div>
        <div class="stat-card"><div class="stat-icon amber">⏳</div><div class="stat-value">${d.pendingCount}</div><div class="stat-label">Pending Payments</div><div class="stat-trend down">${formatCurrency(d.totalPending)}</div></div>
        <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-value">${d.overdueCount}</div><div class="stat-label">Overdue Payments</div><div class="stat-trend down">${formatCurrency(d.totalOverdue)}</div></div>
        <div class="stat-card"><div class="stat-icon blue">🔧</div><div class="stat-value">${d.openMaint + d.inProgressMaint}</div><div class="stat-label">Open Maintenance</div><div class="stat-trend">${d.openMaint} open, ${d.inProgressMaint} in progress</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>📊 Income Trend (6 Months)</h3></div>
          <div class="card-body">
            <div class="chart-bar-group">${d.incomeChart.map(c => {
              const maxAmt = Math.max(...d.incomeChart.map(x => x.amount), 1);
              const h = Math.max((c.amount / maxAmt) * 180, 4);
              return `<div class="chart-bar-item"><div class="chart-bar-value">${formatCurrency(c.amount)}</div><div class="chart-bar" style="height:${h}px"></div><div class="chart-bar-label">${c.month.substring(5)}</div></div>`;
            }).join('')}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>⏰ Leases Expiring Soon</h3></div>
          <div class="card-body">${d.expiringLeases.length === 0 ? '<div class="empty-state"><p>No leases expiring in 30 days</p></div>' :
            '<div class="table-container"><table><thead><tr><th>Tenant</th><th>Flat</th><th>Expires</th></tr></thead><tbody>' +
            d.expiringLeases.map(l => `<tr><td>${l.tenant_name}</td><td>${l.flat_number}</td><td>${formatDate(l.lease_end)}</td></tr>`).join('') +
            '</tbody></table></div>'}</div>
        </div>
      </div>
      <div class="grid-2 mt-6">
        <div class="card">
          <div class="card-header"><h3>💳 Recent Payments</h3></div>
          <div class="card-body"><div class="table-container"><table><thead><tr><th>Tenant</th><th>Flat</th><th>Amount</th><th>Date</th></tr></thead><tbody>${
            d.recentPayments.map(p => `<tr><td>${p.tenant_name}</td><td>${p.flat_number}</td><td>${formatCurrency(p.amount)}</td><td>${formatDate(p.payment_date)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center">No recent payments</td></tr>'
          }</tbody></table></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>🔧 Recent Maintenance</h3></div>
          <div class="card-body"><div class="table-container"><table><thead><tr><th>Issue</th><th>Flat</th><th>Priority</th><th>Status</th></tr></thead><tbody>${
            d.recentMaintenance.map(m => `<tr><td>${m.title}</td><td>${m.flat_number}</td><td>${priorityBadge(m.priority)}</td><td>${statusBadge(m.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="text-center">No requests</td></tr>'
          }</tbody></table></div></div>
        </div>
      </div>`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error loading dashboard</h3><p>${e.message}</p></div>`; }
}

// ═══════════════════════════════════════
// PROPERTIES
// ═══════════════════════════════════════
async function loadProperties() {
  try {
    const props = await apiRequest('/properties');
    cachedData.properties = props;
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <h2 style="font-size:16px">${props.length} Properties</h2>
        <button class="btn btn-primary" onclick="showPropertyForm()">+ Add Property</button>
      </div>
      ${props.length === 0 ? '<div class="empty-state"><div class="empty-icon">🏘️</div><h3>No properties yet</h3><p>Add your first property to get started</p></div>' :
      '<div class="stats-grid">' + props.map(p => `
        <div class="card" style="cursor:pointer">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h3 style="font-size:18px;font-weight:700">${p.name}</h3>
              <span class="badge-status active">${p.code}</span>
            </div>
            <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">📍 ${p.address}</p>
            ${p.description ? `<p style="color:var(--text-muted);font-size:12px;margin-bottom:16px">${p.description}</p>` : ''}
            <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
              <div style="text-align:center;padding:8px;background:var(--bg-input);border-radius:var(--radius-sm)">
                <div style="font-size:18px;font-weight:700">${p.total_flats || 0}</div>
                <div style="font-size:10px;color:var(--text-muted)">Total</div>
              </div>
              <div style="text-align:center;padding:8px;background:var(--accent-green-bg);border-radius:var(--radius-sm)">
                <div style="font-size:18px;font-weight:700;color:var(--accent-green)">${p.occupied || 0}</div>
                <div style="font-size:10px;color:var(--text-muted)">Occupied</div>
              </div>
              <div style="text-align:center;padding:8px;background:var(--accent-amber-bg);border-radius:var(--radius-sm)">
                <div style="font-size:18px;font-weight:700;color:var(--accent-amber)">${p.vacant || 0}</div>
                <div style="font-size:10px;color:var(--text-muted)">Vacant</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-secondary" onclick="showPropertyForm(${p.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteProperty(${p.id})">Delete</button>
            </div>
          </div>
        </div>`).join('') + '</div>'}`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function showPropertyForm(id) {
  const prop = id ? cachedData.properties?.find(p => p.id === id) : null;
  document.getElementById('modalTitle').textContent = prop ? 'Edit Property' : 'Add Property';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group-app"><label>Property Name *</label><input type="text" id="propName" value="${prop?.name || ''}" required></div>
    <div class="form-group-app"><label>Address *</label><input type="text" id="propAddress" value="${prop?.address || ''}" required></div>
    ${prop ? '' : '<div class="form-group-app"><label>Property Code * (short unique code, e.g. MAPLE)</label><input type="text" id="propCode" value="" required maxlength="10" style="text-transform:uppercase"></div>'}
    <div class="form-group-app"><label>Description</label><textarea id="propDesc" rows="3">${prop?.description || ''}</textarea></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="saveProperty(${id || 'null'})">${prop ? 'Update' : 'Create'}</button>`;
  openModal('formModal');
}

async function saveProperty(id) {
  try {
    const body = { name: document.getElementById('propName').value, address: document.getElementById('propAddress').value, description: document.getElementById('propDesc').value };
    if (!id) body.code = document.getElementById('propCode').value;
    await apiRequest(`/properties${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    closeModal('formModal');
    showToast(id ? 'Property updated!' : 'Property created!', 'success');
    loadProperties();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteProperty(id) {
  if (!confirm('Delete this property?')) return;
  try { await apiRequest(`/properties/${id}`, { method: 'DELETE' }); showToast('Property deleted', 'success'); loadProperties(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// FLATS
// ═══════════════════════════════════════
async function loadFlats() {
  try {
    const [flats, props] = await Promise.all([apiRequest('/flats'), apiRequest('/properties')]);
    cachedData.flats = flats; cachedData.properties = props;
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <div class="filter-group">
          <select id="flatPropFilter" onchange="filterFlats()">
            <option value="">All Properties</option>
            ${props.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
          <select id="flatStatusFilter" onchange="filterFlats()">
            <option value="">All Statuses</option>
            <option value="Vacant">Vacant</option>
            <option value="Occupied">Occupied</option>
            <option value="Under Maintenance">Under Maintenance</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="showFlatForm()">+ Add Flat</button>
      </div>
      <div class="card"><div class="card-body"><div class="table-container" id="flatsTable"></div></div></div>`;
    renderFlatsTable(flats);
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function renderFlatsTable(flats) {
  document.getElementById('flatsTable').innerHTML = flats.length === 0 ?
    '<div class="empty-state"><div class="empty-icon">🏠</div><h3>No flats found</h3></div>' :
    `<table><thead><tr><th>Flat</th><th>Property</th><th>Floor</th><th>Rent</th><th>Bedrooms</th><th>Status</th><th>Tenant</th><th>Actions</th></tr></thead><tbody>
    ${flats.map(f => `<tr>
      <td><div class="cell-main">${f.flat_number}</div><div class="cell-sub">${f.building_name || ''}</div></td>
      <td>${f.property_name}</td><td>${f.floor}</td><td>${formatCurrency(f.rent_amount)}</td><td>${f.bedrooms} BHK</td>
      <td>${statusBadge(f.status)}</td><td>${f.current_assignment?.tenant_name || '—'}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="showFlatForm(${f.id})">Edit</button>
      ${f.status !== 'Occupied' ? `<button class="btn btn-sm btn-danger" onclick="deleteFlat(${f.id})">Del</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;
}

async function filterFlats() {
  const propId = document.getElementById('flatPropFilter').value;
  const status = document.getElementById('flatStatusFilter').value;
  let url = '/flats?';
  if (propId) url += `property_id=${propId}&`;
  if (status) url += `status=${status}`;
  const flats = await apiRequest(url);
  renderFlatsTable(flats);
}

function showFlatForm(id) {
  const flat = id ? cachedData.flats?.find(f => f.id === id) : null;
  const props = cachedData.properties || [];
  document.getElementById('modalTitle').textContent = flat ? 'Edit Flat' : 'Add Flat';
  document.getElementById('modalBody').innerHTML = `
    ${flat ? '' : `<div class="form-group-app"><label>Property *</label><select id="flatPropId">${props.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>`}
    <div class="form-row">
      <div class="form-group-app"><label>Flat Number *</label><input type="text" id="flatNumber" value="${flat?.flat_number || ''}"></div>
      <div class="form-group-app"><label>Building Name</label><input type="text" id="flatBuilding" value="${flat?.building_name || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group-app"><label>Floor</label><input type="number" id="flatFloor" value="${flat?.floor || 0}"></div>
      <div class="form-group-app"><label>Bedrooms</label><input type="number" id="flatBedrooms" value="${flat?.bedrooms || 1}"></div>
    </div>
    <div class="form-row">
      <div class="form-group-app"><label>Rent Amount (₹) *</label><input type="number" id="flatRent" value="${flat?.rent_amount || ''}"></div>
      <div class="form-group-app"><label>Security Deposit (₹)</label><input type="number" id="flatDeposit" value="${flat?.security_deposit || 0}"></div>
    </div>
    <div class="form-group-app"><label>Amenities</label><input type="text" id="flatAmenities" value="${flat?.amenities || ''}" placeholder="WiFi, Parking, Gym..."></div>
    ${flat ? `<div class="form-group-app"><label>Status</label><select id="flatStatus">
      <option value="Vacant" ${flat.status==='Vacant'?'selected':''}>Vacant</option>
      <option value="Occupied" ${flat.status==='Occupied'?'selected':''}>Occupied</option>
      <option value="Under Maintenance" ${flat.status==='Under Maintenance'?'selected':''}>Under Maintenance</option>
    </select></div>` : ''}`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="saveFlat(${id || 'null'})">${flat ? 'Update' : 'Create'}</button>`;
  openModal('formModal');
}

async function saveFlat(id) {
  try {
    const body = {
      flat_number: document.getElementById('flatNumber').value,
      building_name: document.getElementById('flatBuilding').value,
      floor: parseInt(document.getElementById('flatFloor').value) || 0,
      bedrooms: parseInt(document.getElementById('flatBedrooms').value) || 1,
      rent_amount: parseFloat(document.getElementById('flatRent').value),
      security_deposit: parseFloat(document.getElementById('flatDeposit').value) || 0,
      amenities: document.getElementById('flatAmenities').value
    };
    if (!id) body.property_id = parseInt(document.getElementById('flatPropId').value);
    if (id) body.status = document.getElementById('flatStatus').value;
    await apiRequest(`/flats${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    closeModal('formModal'); showToast(id ? 'Flat updated!' : 'Flat created!', 'success'); loadFlats();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteFlat(id) {
  if (!confirm('Delete this flat?')) return;
  try { await apiRequest(`/flats/${id}`, { method: 'DELETE' }); showToast('Flat deleted', 'success'); loadFlats(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// TENANTS
// ═══════════════════════════════════════
async function loadTenants() {
  try {
    const [tenants, props] = await Promise.all([apiRequest('/tenants'), apiRequest('/properties')]);
    cachedData.tenants = tenants; cachedData.properties = props;
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <h2 style="font-size:16px">${tenants.length} Tenants</h2>
        <button class="btn btn-primary" onclick="showTenantForm()">+ Register Tenant</button>
      </div>
      <div class="card"><div class="card-body"><div class="table-container">
        ${tenants.length === 0 ? '<div class="empty-state"><div class="empty-icon">👥</div><h3>No tenants yet</h3></div>' :
        `<table><thead><tr><th>Tenant</th><th>Credential ID</th><th>Phone</th><th>Assigned Flat</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>
        ${tenants.map(t => `<tr>
          <td><div class="cell-main">${t.name}</div><div class="cell-sub">${t.email}</div></td>
          <td><code style="font-size:12px;background:var(--bg-input);padding:2px 8px;border-radius:4px">${t.credential_id || '—'}</code></td>
          <td>${t.phone || '—'}</td>
          <td>${t.current_assignment ? `${t.current_assignment.flat_number} (${t.current_assignment.property_name})` : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
          <td>${statusBadge(t.is_active ? 'Active' : 'Closed')}</td>
          <td>${formatDate(t.last_login)}</td>
          <td class="flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="showTenantForm(${t.id})">Edit</button>
            <button class="btn btn-sm btn-outline" onclick="resetTenantCreds(${t.id})">Reset</button>
            <button class="btn btn-sm btn-danger" onclick="deactivateTenant(${t.id})">Deactivate</button>
          </td></tr>`).join('')}</tbody></table>`}
      </div></div></div>`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function showTenantForm(id) {
  const tenant = id ? cachedData.tenants?.find(t => t.id === id) : null;
  const props = cachedData.properties || [];
  document.getElementById('modalTitle').textContent = tenant ? 'Edit Tenant' : 'Register New Tenant';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group-app"><label>Full Name *</label><input type="text" id="tenantName" value="${tenant?.name || ''}"></div>
    <div class="form-group-app"><label>Email Address *</label><input type="email" id="tenantEmail" value="${tenant?.email || ''}" ${tenant ? 'disabled' : ''}></div>
    <div class="form-row">
      <div class="form-group-app"><label>Phone</label><input type="text" id="tenantPhone" value="${tenant?.phone || ''}"></div>
      <div class="form-group-app"><label>Emergency Contact</label><input type="text" id="tenantEmergency" value="${tenant?.emergency_contact || ''}"></div>
    </div>
    ${tenant ? '' : `<div class="form-group-app"><label>Property (for Credential ID prefix)</label><select id="tenantPropCode">
      ${props.map(p => `<option value="${p.code}">${p.name} (${p.code})</option>`).join('')}
    </select></div>`}`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="saveTenant(${id || 'null'})">${tenant ? 'Update' : 'Register & Generate Credentials'}</button>`;
  openModal('formModal');
}

async function saveTenant(id) {
  try {
    const body = { name: document.getElementById('tenantName').value, phone: document.getElementById('tenantPhone').value, emergency_contact: document.getElementById('tenantEmergency').value };
    if (!id) {
      body.email = document.getElementById('tenantEmail').value;
      body.property_code = document.getElementById('tenantPropCode').value;
    }
    const data = await apiRequest(`/tenants${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    closeModal('formModal');
    if (!id && data.credentials) {
      document.getElementById('credentialsBody').innerHTML = `
        <p style="margin-bottom:16px;color:var(--text-secondary)">Tenant account created successfully! Share these credentials with the tenant:</p>
        <div class="credentials-box">
          <h4>🔑 Login Credentials</h4>
          <div class="cred-item"><span class="cred-label">Credential ID</span><span class="cred-value">${data.credentials.credentialId}</span></div>
          <div class="cred-item"><span class="cred-label">Temporary Password</span><span class="cred-value">${data.credentials.temporaryPassword}</span></div>
          <div class="cred-item"><span class="cred-label">Login URL</span><span class="cred-value">${window.location.origin}</span></div>
        </div>
        <p style="margin-top:12px;font-size:12px;color:var(--accent-amber)">⚠️ The tenant must change their password on first login. Save these credentials now — the password cannot be retrieved later.</p>`;
      openModal('credentialsModal');
    }
    showToast(id ? 'Tenant updated!' : 'Tenant registered!', 'success');
    loadTenants();
  } catch (e) { showToast(e.message, 'error'); }
}

async function resetTenantCreds(id) {
  if (!confirm('Reset this tenant\'s password? They will need to login with the new temporary password.')) return;
  try {
    const data = await apiRequest(`/tenants/${id}/reset-credentials`, { method: 'POST' });
    document.getElementById('credentialsBody').innerHTML = `
      <p style="margin-bottom:16px;color:var(--text-secondary)">Credentials have been reset:</p>
      <div class="credentials-box"><h4>🔑 New Credentials</h4>
        <div class="cred-item"><span class="cred-label">Credential ID</span><span class="cred-value">${data.credentialId}</span></div>
        <div class="cred-item"><span class="cred-label">New Password</span><span class="cred-value">${data.temporaryPassword}</span></div>
      </div>`;
    openModal('credentialsModal');
  } catch (e) { showToast(e.message, 'error'); }
}

async function deactivateTenant(id) {
  if (!confirm('Deactivate this tenant? Their account will be disabled and assignment ended.')) return;
  try { await apiRequest(`/tenants/${id}`, { method: 'DELETE' }); showToast('Tenant deactivated', 'success'); loadTenants(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════
async function loadAssignments() {
  try {
    const [assignments, tenants, flats] = await Promise.all([apiRequest('/assignments'), apiRequest('/tenants'), apiRequest('/flats')]);
    cachedData.assignments = assignments;
    cachedData.unassignedTenants = tenants.filter(t => !t.current_assignment && t.is_active);
    cachedData.vacantFlats = flats.filter(f => f.status === 'Vacant');
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <h2 style="font-size:16px">${assignments.length} Assignments</h2>
        <button class="btn btn-primary" onclick="showAssignmentForm()">+ New Assignment</button>
      </div>
      <div class="card"><div class="card-body"><div class="table-container">
        ${assignments.length === 0 ? '<div class="empty-state"><h3>No assignments</h3></div>' :
        `<table><thead><tr><th>Tenant</th><th>Flat</th><th>Property</th><th>Lease Period</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${assignments.map(a => `<tr>
          <td><div class="cell-main">${a.tenant_name}</div></td>
          <td>${a.flat_number} ${a.building_name ? '('+a.building_name+')' : ''}</td>
          <td>${a.property_name}</td>
          <td><div class="cell-main">${formatDate(a.lease_start)} — ${formatDate(a.lease_end)}</div></td>
          <td>${formatCurrency(a.rent_amount)}</td>
          <td>${statusBadge(a.is_active ? 'Active' : 'Closed')}</td>
          <td>${a.is_active ? `<button class="btn btn-sm btn-danger" onclick="vacateAssignment(${a.id})">Vacate</button>` : '—'}</td>
        </tr>`).join('')}</tbody></table>`}
      </div></div></div>`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function showAssignmentForm() {
  const tenants = cachedData.unassignedTenants || [];
  const flats = cachedData.vacantFlats || [];
  if (tenants.length === 0 || flats.length === 0) {
    showToast('Need at least one unassigned tenant and one vacant flat', 'warning'); return;
  }
  document.getElementById('modalTitle').textContent = 'New Assignment';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group-app"><label>Tenant *</label><select id="assignTenant">${tenants.map(t => `<option value="${t.id}">${t.name} (${t.email})</option>`).join('')}</select></div>
    <div class="form-group-app"><label>Flat *</label><select id="assignFlat">${flats.map(f => `<option value="${f.id}" data-rent="${f.rent_amount}" data-dep="${f.security_deposit}">${f.flat_number} — ${f.property_name} (₹${f.rent_amount}/mo)</option>`).join('')}</select></div>
    <div class="form-row">
      <div class="form-group-app"><label>Lease Start *</label><input type="date" id="assignStart"></div>
      <div class="form-group-app"><label>Lease End *</label><input type="date" id="assignEnd"></div>
    </div>
    <div class="form-row">
      <div class="form-group-app"><label>Monthly Rent (₹) *</label><input type="number" id="assignRent" value="${flats[0]?.rent_amount || ''}"></div>
      <div class="form-group-app"><label>Security Deposit (₹)</label><input type="number" id="assignDeposit" value="${flats[0]?.security_deposit || 0}"></div>
    </div>`;
  document.getElementById('assignFlat').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    document.getElementById('assignRent').value = opt.dataset.rent || '';
    document.getElementById('assignDeposit').value = opt.dataset.dep || 0;
  });
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="saveAssignment()">Create Assignment</button>`;
  openModal('formModal');
}

async function saveAssignment() {
  try {
    const body = {
      tenant_id: parseInt(document.getElementById('assignTenant').value),
      flat_id: parseInt(document.getElementById('assignFlat').value),
      lease_start: document.getElementById('assignStart').value,
      lease_end: document.getElementById('assignEnd').value,
      rent_amount: parseFloat(document.getElementById('assignRent').value),
      security_deposit: parseFloat(document.getElementById('assignDeposit').value) || 0
    };
    await apiRequest('/assignments', { method: 'POST', body: JSON.stringify(body) });
    closeModal('formModal'); showToast('Assignment created!', 'success'); loadAssignments();
  } catch (e) { showToast(e.message, 'error'); }
}

async function vacateAssignment(id) {
  if (!confirm('Vacate this assignment? The flat will be set to Vacant.')) return;
  try { await apiRequest(`/assignments/${id}/vacate`, { method: 'PUT' }); showToast('Assignment vacated', 'success'); loadAssignments(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// RENT
// ═══════════════════════════════════════
async function loadRent() {
  try {
    const payments = await apiRequest('/rent');
    cachedData.payments = payments;
    const pending = payments.filter(p => p.status === 'Pending').length;
    const overdue = payments.filter(p => p.status === 'Overdue').length;
    const paid = payments.filter(p => p.status === 'Paid').length;
    document.getElementById('pageContent').innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-value">${paid}</div><div class="stat-label">Paid</div></div>
        <div class="stat-card"><div class="stat-icon amber">⏳</div><div class="stat-value">${pending}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-icon red">⚠️</div><div class="stat-value">${overdue}</div><div class="stat-label">Overdue</div></div>
      </div>
      <div class="action-bar">
        <div class="filter-group">
          <select id="rentStatusFilter" onchange="filterRent()">
            <option value="">All Statuses</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Overdue">Overdue</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" onclick="markOverdue()">Mark Overdue</button>
          <button class="btn btn-primary" onclick="showGenerateRent()">Generate Rent</button>
        </div>
      </div>
      <div class="card"><div class="card-body"><div class="table-container" id="rentTable"></div></div></div>`;
    renderRentTable(payments);
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function renderRentTable(payments) {
  document.getElementById('rentTable').innerHTML = payments.length === 0 ?
    '<div class="empty-state"><h3>No payment records</h3><p>Generate rent records for active assignments</p></div>' :
    `<table><thead><tr><th>Tenant</th><th>Flat</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Paid On</th><th>Receipt</th><th>Actions</th></tr></thead><tbody>
    ${payments.map(p => `<tr>
      <td>${p.tenant_name}</td><td>${p.flat_number}</td><td>${formatDate(p.due_date)}</td>
      <td>${formatCurrency(p.amount)}</td><td>${statusBadge(p.status)}</td>
      <td>${formatDate(p.payment_date)}</td><td><code style="font-size:11px">${p.receipt_number || '—'}</code></td>
      <td>${p.status !== 'Paid' ? `<button class="btn btn-sm btn-success" onclick="markPaid(${p.id})">Mark Paid</button>` : '✅'}</td>
    </tr>`).join('')}</tbody></table>`;
}

async function filterRent() {
  const status = document.getElementById('rentStatusFilter').value;
  const payments = await apiRequest(`/rent${status ? '?status=' + status : ''}`);
  renderRentTable(payments);
}

async function markPaid(id) {
  try { await apiRequest(`/rent/${id}/pay`, { method: 'PUT', body: JSON.stringify({}) }); showToast('Payment marked as paid!', 'success'); loadRent(); }
  catch (e) { showToast(e.message, 'error'); }
}

async function markOverdue() {
  try { const data = await apiRequest('/rent/mark-overdue', { method: 'POST' }); showToast(data.message, 'info'); loadRent(); }
  catch (e) { showToast(e.message, 'error'); }
}

function showGenerateRent() {
  const now = new Date();
  document.getElementById('modalTitle').textContent = 'Generate Monthly Rent';
  document.getElementById('modalBody').innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:16px">Generate rent payment records for all active assignments.</p>
    <div class="form-row">
      <div class="form-group-app"><label>Month</label><select id="genMonth">${Array.from({length:12},(_,i) => `<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</option>`).join('')}</select></div>
      <div class="form-group-app"><label>Year</label><input type="number" id="genYear" value="${now.getFullYear()}"></div>
    </div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="generateRent()">Generate</button>`;
  openModal('formModal');
}

async function generateRent() {
  try {
    const data = await apiRequest('/rent/generate', { method: 'POST', body: JSON.stringify({
      month: parseInt(document.getElementById('genMonth').value),
      year: parseInt(document.getElementById('genYear').value)
    })});
    closeModal('formModal'); showToast(data.message, 'success'); loadRent();
  } catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════
async function loadMaintenance() {
  try {
    const requests = await apiRequest('/maintenance');
    cachedData.maintenance = requests;
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <div class="filter-group">
          <select id="maintStatusFilter" onchange="filterMaintenance()">
            <option value="">All Statuses</option><option value="Open">Open</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option><option value="Closed">Closed</option>
          </select>
        </div>
        <span style="font-size:14px;color:var(--text-secondary)">${requests.length} requests</span>
      </div>
      <div class="card"><div class="card-body"><div class="table-container" id="maintTable"></div></div></div>`;
    renderMaintTable(requests);
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function renderMaintTable(requests) {
  document.getElementById('maintTable').innerHTML = requests.length === 0 ?
    '<div class="empty-state"><div class="empty-icon">🔧</div><h3>No maintenance requests</h3></div>' :
    `<table><thead><tr><th>Issue</th><th>Tenant</th><th>Flat</th><th>Priority</th><th>Status</th><th>Technician</th><th>Cost</th><th>Date</th><th>Actions</th></tr></thead><tbody>
    ${requests.map(m => `<tr>
      <td><div class="cell-main">${m.title}</div><div class="cell-sub truncate">${m.description || ''}</div></td>
      <td>${m.tenant_name}</td><td>${m.flat_number}</td>
      <td>${priorityBadge(m.priority)}</td><td>${statusBadge(m.status)}</td>
      <td>${m.technician_name || '—'}</td>
      <td>${formatCurrency((m.labor_cost||0) + (m.parts_cost||0))}</td>
      <td>${formatDate(m.created_at)}</td>
      <td><button class="btn btn-sm btn-secondary" onclick="showMaintUpdateForm(${m.id})">Update</button></td>
    </tr>`).join('')}</tbody></table>`;
}

async function filterMaintenance() {
  const status = document.getElementById('maintStatusFilter').value;
  const requests = await apiRequest(`/maintenance${status ? '?status=' + status : ''}`);
  renderMaintTable(requests);
}

async function showMaintUpdateForm(id) {
  const m = cachedData.maintenance?.find(x => x.id === id);
  if (!m) return;
  let techs = [];
  try { techs = await apiRequest('/maintenance/technicians/list'); } catch(e){}
  document.getElementById('modalTitle').textContent = `Update: ${m.title}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius-md);margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-muted)">Submitted by ${m.tenant_name} • Flat ${m.flat_number} • ${formatDate(m.created_at)}</div>
      <p style="margin-top:8px;font-size:13px">${m.description || 'No description'}</p>
    </div>
    <div class="form-row">
      <div class="form-group-app"><label>Status</label><select id="maintStatus">
        <option value="Open" ${m.status==='Open'?'selected':''}>Open</option>
        <option value="In Progress" ${m.status==='In Progress'?'selected':''}>In Progress</option>
        <option value="Resolved" ${m.status==='Resolved'?'selected':''}>Resolved</option>
        <option value="Closed" ${m.status==='Closed'?'selected':''}>Closed</option>
      </select></div>
      <div class="form-group-app"><label>Priority</label><select id="maintPriority">
        <option value="Low" ${m.priority==='Low'?'selected':''}>Low</option>
        <option value="Medium" ${m.priority==='Medium'?'selected':''}>Medium</option>
        <option value="High" ${m.priority==='High'?'selected':''}>High</option>
        <option value="Urgent" ${m.priority==='Urgent'?'selected':''}>Urgent</option>
      </select></div>
    </div>
    <div class="form-group-app"><label>Assign Technician</label><select id="maintTech">
      <option value="">Unassigned</option>${techs.map(t => `<option value="${t.id}" ${m.assigned_technician_id===t.id?'selected':''}>${t.name} (${t.specialization})</option>`).join('')}
    </select></div>
    <div class="form-row">
      <div class="form-group-app"><label>Labor Cost (₹)</label><input type="number" id="maintLabor" value="${m.labor_cost||0}"></div>
      <div class="form-group-app"><label>Parts Cost (₹)</label><input type="number" id="maintParts" value="${m.parts_cost||0}"></div>
    </div>
    <div class="form-group-app"><label>Admin Notes (internal)</label><textarea id="maintNotes" rows="2">${m.admin_notes||''}</textarea></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="updateMaintenance(${id})">Update</button>`;
  openModal('formModal');
}

async function updateMaintenance(id) {
  try {
    const body = {
      status: document.getElementById('maintStatus').value,
      priority: document.getElementById('maintPriority').value,
      assigned_technician_id: document.getElementById('maintTech').value ? parseInt(document.getElementById('maintTech').value) : null,
      labor_cost: parseFloat(document.getElementById('maintLabor').value) || 0,
      parts_cost: parseFloat(document.getElementById('maintParts').value) || 0,
      admin_notes: document.getElementById('maintNotes').value
    };
    await apiRequest(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    closeModal('formModal'); showToast('Maintenance request updated!', 'success'); loadMaintenance();
  } catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════
async function loadAnnouncements() {
  try {
    const [announcements, props] = await Promise.all([apiRequest('/dashboard/announcements'), apiRequest('/properties')]);
    cachedData.properties = props;
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar">
        <h2 style="font-size:16px">${announcements.length} Announcements</h2>
        <button class="btn btn-primary" onclick="showAnnouncementForm()">+ New Announcement</button>
      </div>
      ${announcements.length === 0 ? '<div class="empty-state"><div class="empty-icon">📢</div><h3>No announcements</h3></div>' :
      announcements.map(a => `<div class="card mb-4">
        <div class="card-header"><h3>${a.title}</h3><span style="font-size:12px;color:var(--text-muted)">${formatDateTime(a.created_at)}</span></div>
        <div class="card-body"><p style="color:var(--text-secondary)">${a.body}</p></div>
      </div>`).join('')}`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}

function showAnnouncementForm() {
  const props = cachedData.properties || [];
  document.getElementById('modalTitle').textContent = 'New Announcement';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group-app"><label>Property (optional — leave blank for all)</label><select id="annProp"><option value="">All Properties</option>${props.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
    <div class="form-group-app"><label>Title *</label><input type="text" id="annTitle"></div>
    <div class="form-group-app"><label>Message *</label><textarea id="annBody" rows="4"></textarea></div>`;
  document.getElementById('modalFooter').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('formModal')">Cancel</button>
    <button class="btn btn-primary" onclick="saveAnnouncement()">Post Announcement</button>`;
  openModal('formModal');
}

async function saveAnnouncement() {
  try {
    const body = {
      property_id: document.getElementById('annProp').value || null,
      title: document.getElementById('annTitle').value,
      body: document.getElementById('annBody').value
    };
    await apiRequest('/dashboard/announcements', { method: 'POST', body: JSON.stringify(body) });
    closeModal('formModal'); showToast('Announcement posted!', 'success'); loadAnnouncements();
  } catch (e) { showToast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════
async function loadAuditLogs() {
  try {
    const logs = await apiRequest('/dashboard/audit-logs');
    document.getElementById('pageContent').innerHTML = `
      <div class="action-bar"><h2 style="font-size:16px">${logs.length} Recent Activities</h2></div>
      <div class="card"><div class="card-body"><div class="table-container">
        <table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead><tbody>
        ${logs.map(l => `<tr>
          <td>${formatDateTime(l.created_at)}</td>
          <td>${l.user_email || 'System'}</td>
          <td><span class="badge-status active" style="font-size:11px">${l.action_type}</span></td>
          <td>${l.entity_type} #${l.entity_id || '—'}</td>
          <td class="truncate">${l.details || '—'}</td>
          <td style="font-size:11px">${l.ip_address || '—'}</td>
        </tr>`).join('')}</tbody></table>
      </div></div></div>`;
  } catch (e) { document.getElementById('pageContent').innerHTML = `<div class="empty-state"><h3>Error</h3><p>${e.message}</p></div>`; }
}
