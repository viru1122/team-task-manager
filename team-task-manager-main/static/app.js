console.log('🚀 app.js loaded');

const token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');
let user = null;

try {
  user = userRaw ? JSON.parse(userRaw) : null;
} catch (e) {
  console.error('❌ Failed to parse user:', e);
  localStorage.clear();
  window.location.href = '/';
}

console.log('🔑 Token exists:', !!token);
console.log('👤 User:', user);

// ===== THEME (MUST be before init) =====
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = next === 'light' ? '🌙' : '☀️';
}

// ===== AUTH HELPERS =====
function authHeaders() {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function logout() {
  showToast('Logging out...', 'info');
  setTimeout(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }, 500);
}

async function api(path, options = {}) {
  console.log(`📡 API: ${options.method || 'GET'} ${path}`);
  const res = await fetch(path, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  console.log(`   Response: ${res.status}`);
  if (res.status === 401) { logout(); return; }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) { console.log('Toast:', message); return; }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== ANIMATED COUNTER =====
function animateCounter(el, target, duration = 1000) {
  const start = parseInt(el.textContent) || 0;
  const range = target - start;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(start + range * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ===== CONFETTI =====
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#f6ad55'];
  const particles = [];
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: canvas.width / 2, y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15 - 5,
      size: Math.random() * 8 + 4, color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.3, rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10, life: 100
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.rotation += p.rotationSpeed; p.life--;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 100);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      if (p.life <= 0) particles.splice(i, 1);
    });
    if (particles.length > 0) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

let currentProject = null;
let allUsers = [];

async function init() {
  console.log('🎬 init() starting...');

  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';

  const setIfExists = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    else console.warn(`Element #${id} not found`);
  };

  setIfExists('user-name', user.name);
  setIfExists('user-role', user.role);
  setIfExists('user-avatar', getInitials(user.name));
  setIfExists('welcome-name', user.name.split(' ')[0]);

  console.log('✅ User info populated');

  await loadDashboard();
  await loadProjects();

  try {
    allUsers = await api('/api/users/');
    console.log(`✅ Loaded ${allUsers.length} users`);
  } catch (e) {
    console.error('Failed to load users:', e);
    allUsers = [];
  }

  attachRipple();
  console.log('🎉 init() complete!');
}

function attachRipple() {
  document.querySelectorAll('.ripple').forEach(btn => {
    if (btn.dataset.ripple) return;
    btn.dataset.ripple = '1';
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      const rect = this.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top = (e.clientY - rect.top) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

async function loadDashboard() {
  try {
    const stats = await api('/api/dashboard');
    const statsEl = document.getElementById('stats');
    if (!statsEl) return;

    const items = [
      { icon: '📊', value: stats.total_tasks, label: 'Total Tasks', class: '' },
      { icon: '📝', value: stats.todo, label: 'To Do', class: '' },
      { icon: '⚙️', value: stats.in_progress, label: 'In Progress', class: '' },
      { icon: '✅', value: stats.done, label: 'Completed', class: '' },
      { icon: '⏰', value: stats.overdue, label: 'Overdue', class: 'stat-overdue' },
    ];

    statsEl.innerHTML = items.map(item => `
      <div class="stat-card ${item.class}">
        <div class="stat-icon">${item.icon}</div>
        <h3 data-target="${item.value}">0</h3>
        <p>${item.label}</p>
      </div>
    `).join('');

    statsEl.querySelectorAll('h3').forEach(h => {
      animateCounter(h, parseInt(h.dataset.target), 1200);
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    showToast('Failed to load dashboard', 'error');
  }
}

async function loadProjects() {
  try {
    const projects = await api('/api/projects/');
    console.log(`📁 Got ${projects.length} projects`);
    const list = document.getElementById('projects-list');
    if (!list) return;

    if (projects.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>No projects yet</h3>
          <p>Click "✨ New Project" to create your first one!</p>
        </div>`;
      return;
    }

    list.innerHTML = projects.map((p, i) => `
      <div class="project-card" onclick="openProject(${p.id})" style="animation-delay: ${i * 0.05}s">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description || 'No description provided')}</p>
        <div class="project-meta">
          <span>👥 ${p.members.length} ${p.members.length === 1 ? 'member' : 'members'}</span>
          <span>•</span>
          <span>📅 ${new Date(p.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Projects error:', e);
    showToast('Failed to load projects', 'error');
  }
}

async function openProject(id) {
  try {
    currentProject = await api(`/api/projects/${id}`);
    const section = document.getElementById('tasks-section');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('project-title').textContent = currentProject.name;
    document.getElementById('project-desc').textContent = currentProject.description || 'No description';

    const isOwnerOrAdmin = currentProject.owner_id === user.id || user.role === 'admin';
    document.getElementById('add-member-btn').style.display = isOwnerOrAdmin ? 'inline-flex' : 'none';

    document.getElementById('members-list').innerHTML = currentProject.members.map(m =>
      `<span class="member-chip">
        <span class="mini-avatar">${getInitials(m.name)}</span>
        ${escapeHtml(m.name)} ${m.id === currentProject.owner_id ? '👑' : ''}
       </span>`
    ).join('');

    await loadTasks();
    setupDragAndDrop();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadTasks() {
  try {
    const tasks = await api(`/api/projects/${currentProject.id}/tasks`);
    const isOwnerOrAdmin = currentProject.owner_id === user.id || user.role === 'admin';

    ['todo', 'in_progress', 'done'].forEach(status => {
      const filtered = tasks.filter(t => t.status === status);
      const countEl = document.getElementById(`count-${status}`);
      if (countEl) countEl.textContent = filtered.length;

      const tasksDiv = document.querySelector(`.tasks[data-status="${status}"]`);
      if (!tasksDiv) return;

      if (filtered.length === 0) {
        tasksDiv.innerHTML = `<p style="text-align:center;color:var(--text-light);font-size:13px;padding:20px;">No tasks yet</p>`;
        return;
      }

      tasksDiv.innerHTML = filtered.map(t => {
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
        const canEdit = isOwnerOrAdmin || t.assignee_id === user.id;
        return `
          <div class="task-card priority-${t.priority} ${isOverdue ? 'overdue' : ''}" 
               draggable="${canEdit}" data-task-id="${t.id}" data-status="${t.status}">
            <span class="priority-badge ${t.priority}">${t.priority}</span>
            <h4>${escapeHtml(t.title)}</h4>
            ${t.description ? `<p class="task-desc">${escapeHtml(t.description)}</p>` : ''}
            <div class="task-meta">
              <span>👤 ${t.assignee ? escapeHtml(t.assignee.name) : 'Unassigned'}</span>
              <span>${t.due_date ? '📅 ' + new Date(t.due_date).toLocaleDateString() : ''}</span>
            </div>
            ${canEdit ? `
              <div class="task-actions">
                <select onchange="updateTaskStatus(${t.id}, this.value)" onclick="event.stopPropagation()">
                  <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>📝 To Do</option>
                  <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>⚙️ In Progress</option>
                  <option value="done" ${t.status === 'done' ? 'selected' : ''}>✅ Done</option>
                </select>
                ${isOwnerOrAdmin ? `<button class="btn-delete" onclick="event.stopPropagation();deleteTask(${t.id})">🗑️</button>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    });

    await loadDashboard();
  } catch (e) {
    showToast('Failed to load tasks', 'error');
  }
}

function setupDragAndDrop() {
  document.querySelectorAll('.task-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('taskId', card.dataset.taskId);
      e.dataTransfer.setData('oldStatus', card.dataset.status);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('taskId');
      const oldStatus = e.dataTransfer.getData('oldStatus');
      const newStatus = col.dataset.status;
      if (oldStatus !== newStatus) await updateTaskStatus(parseInt(taskId), newStatus, true);
    });
  });
}

async function updateTaskStatus(taskId, status, fromDrag = false) {
  try {
    await api(`/api/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (status === 'done') { fireConfetti(); showToast('🎉 Task completed!', 'success'); }
    else showToast(`Status updated to ${status.replace('_', ' ')}`, 'success');
    await loadTasks();
  } catch (e) {
    showToast(e.message, 'error');
    if (fromDrag) await loadTasks();
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task permanently?')) return;
  try {
    await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
    showToast('Task deleted', 'success');
    await loadTasks();
  } catch (e) { showToast(e.message, 'error'); }
}

function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function showCreateProject() {
  openModal(`
    <h2>✨ Create Project</h2>
    <form onsubmit="createProject(event)">
      <input name="name" placeholder="Project name" required minlength="2" autofocus>
      <textarea name="description" placeholder="Description (optional)" rows="3"></textarea>
      <button type="submit">Create Project 🚀</button>
    </form>
  `);
}

async function createProject(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/projects/', {
      method: 'POST',
      body: JSON.stringify({ name: fd.get('name'), description: fd.get('description') }),
    });
    closeModal();
    showToast('Project created! 🎉', 'success');
    await loadProjects();
  } catch (err) { showToast(err.message, 'error'); }
}

function showCreateTask() {
  const memberOptions = currentProject.members.map(m =>
    `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  openModal(`
    <h2>➕ Create Task</h2>
    <form onsubmit="createTask(event)">
      <input name="title" placeholder="Task title" required autofocus>
      <textarea name="description" placeholder="Description (optional)" rows="3"></textarea>
      <select name="priority">
        <option value="low">🟢 Low Priority</option>
        <option value="medium" selected>🟡 Medium Priority</option>
        <option value="high">🔴 High Priority</option>
      </select>
      <select name="assignee_id">
        <option value="">👤 Unassigned</option>${memberOptions}
      </select>
      <input name="due_date" type="datetime-local">
      <button type="submit">Create Task 🎯</button>
    </form>
  `);
}

async function createTask(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = {
    title: fd.get('title'),
    description: fd.get('description'),
    priority: fd.get('priority'),
    assignee_id: fd.get('assignee_id') ? parseInt(fd.get('assignee_id')) : null,
    due_date: fd.get('due_date') || null,
  };
  try {
    await api(`/api/projects/${currentProject.id}/tasks`, {
      method: 'POST', body: JSON.stringify(body),
    });
    closeModal();
    showToast('Task created! 🎯', 'success');
    await loadTasks();
  } catch (err) { showToast(err.message, 'error'); }
}

function showAddMember() {
  const currentIds = currentProject.members.map(m => m.id);
  const available = allUsers.filter(u => !currentIds.includes(u.id));
  if (available.length === 0) {
    showToast('All registered users are already members', 'info');
    return;
  }
  const opts = available.map(u =>
    `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
  openModal(`
    <h2>👥 Add Team Member</h2>
    <form onsubmit="addMember(event)">
      <select name="user_id" required>${opts}</select>
      <button type="submit">Add to Project 🤝</button>
    </form>
  `);
}

async function addMember(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api(`/api/projects/${currentProject.id}/members`, {
      method: 'POST', body: JSON.stringify({ user_id: parseInt(fd.get('user_id')) }),
    });
    closeModal();
    showToast('Member added! 🤝', 'success');
    await openProject(currentProject.id);
  } catch (err) { showToast(err.message, 'error'); }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Run init AFTER everything is defined
if (window.location.pathname === '/dashboard') {
  if (!token || !user) {
    console.warn('⚠️ No token/user, redirecting to login');
    window.location.href = '/';
  } else {
    init().catch(e => {
      console.error('❌ Init failed:', e);
      alert('Failed to load dashboard: ' + e.message);
    });
  }
}
