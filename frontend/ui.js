const baseUrl = "http://localhost:3000";
const SESSION_KEY = "educontrol_usuario";

let currentUser = null;

let views = [];
let personaForm = null;
let personaTableBody = null;
let cancelEditButton = null;
let allPersonas = [];

window.addEventListener('DOMContentLoaded', () => {
  wireLoginScreen();
  restoreSession();
});

/* ============================================================
   SESIÓN / LOGIN
   ============================================================ */

function wireLoginScreen() {
  const loginForm = document.getElementById('login-form');
  const togglePassword = document.getElementById('toggle-password');

  loginForm?.addEventListener('submit', handleLogin);

  togglePassword?.addEventListener('click', () => {
    const input = document.getElementById('login-contrasena');
    const icon = togglePassword.querySelector('i');
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    icon?.classList.toggle('bi-eye', showing);
    icon?.classList.toggle('bi-eye-slash', !showing);
  });

  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

function restoreSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) {
    showLoginScreen();
    return;
  }
  try {
    currentUser = JSON.parse(saved);
    showApp();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const correo = document.getElementById('login-correo').value.trim();
  const contrasena = document.getElementById('login-contrasena').value;
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  if (errorBox) { errorBox.textContent = ''; errorBox.classList.add('hidden'); }

  if (!correo || !contrasena) {
    if (errorBox) { errorBox.textContent = 'Ingresa correo y contraseña.'; errorBox.classList.remove('hidden'); }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Ingresando...';

  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena })
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.mensaje || 'No se pudo iniciar sesión.');
    }

    currentUser = json.usuario;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    showApp();
  } catch (error) {
    if (errorBox) { errorBox.textContent = error.message || 'No se pudo conectar con el backend.'; errorBox.classList.remove('hidden'); }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión';
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  currentUser = null;
  document.getElementById('login-form')?.reset();
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('app-shell')?.classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');
  renderUserInfo();
  initApp();
}

function renderUserInfo() {
  if (!currentUser) return;
  const nombreCompleto = `${currentUser.nombre ?? ''} ${currentUser.apellido1 ?? ''}`.trim();
  const iniciales = `${(currentUser.nombre || '?')[0] ?? ''}${(currentUser.apellido1 || '?')[0] ?? ''}`.toUpperCase();
  const rol = currentUser.rol || '—';
  const rolClase = rol.toLowerCase() === 'administrador' ? 'role-badge-admin' : 'role-badge-asistente';

  [
    ['sidebar-avatar', iniciales], ['topbar-avatar', iniciales],
    ['sidebar-user-name', nombreCompleto], ['topbar-user-name', nombreCompleto]
  ].forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  [['sidebar-role-badge', rol], ['topbar-role-badge', rol]].forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `role-badge ${rolClase}`;
  });

  document.body.classList.toggle('is-admin', rol.toLowerCase() === 'administrador');
}

/* fetch con el header de usuario para que el backend sepa quién hace la acción */
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (currentUser?.id_usuario) headers['x-user-id'] = currentUser.id_usuario;

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    showToast('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
    logout();
  }

  return res;
}

/* ============================================================
   INICIALIZACIÓN DE LA APP (una vez logueado)
   ============================================================ */

function initApp() {
  views = document.querySelectorAll('.sidebar button[data-view]');

  personaForm = document.getElementById('persona-form');
  personaTableBody = document.querySelector('#personas-table tbody');
  cancelEditButton = document.getElementById('cancel-edit');

  views.forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view), { once: false });
  });

  if (personaForm && !personaForm.dataset.wired) {
    personaForm.dataset.wired = '1';
    personaForm.addEventListener('submit', handlePersonaSubmit);
  }

  if (cancelEditButton && !cancelEditButton.dataset.wired) {
    cancelEditButton.dataset.wired = '1';
    cancelEditButton.addEventListener('click', resetForm);
  }

  const nuevoBtn = document.getElementById('btn-nuevo-estudiante');
  if (nuevoBtn && !nuevoBtn.dataset.wired) {
    nuevoBtn.dataset.wired = '1';
    nuevoBtn.addEventListener('click', resetForm);
  }

  const searchInput = document.getElementById('persona-search');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderPersonasTable(filterPersonas(searchInput.value)));
  }

  if (personaTableBody && !personaTableBody.dataset.wired) {
    personaTableBody.dataset.wired = '1';
    personaTableBody.addEventListener('click', handlePersonaTableClick);
  }

  const matForm = document.getElementById('matricula-form');
  if (matForm && !matForm.dataset.wired) {
    matForm.dataset.wired = '1';
    matForm.addEventListener('submit', handleMatriculaSubmit);
  }

  const asisForm = document.getElementById('asistencia-form');
  if (asisForm && !asisForm.dataset.wired) {
    asisForm.dataset.wired = '1';
    asisForm.addEventListener('submit', handleAsistenciaSubmit);
  }

  setActiveView('dashboard');
  refreshDashboardCount();
}

function setActiveView(viewName) {
  const targetSection = document.getElementById(`${viewName}-view`);
  if (!targetSection) return;

  views.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const sections = document.querySelectorAll('.view');
  sections.forEach((section) => section.classList.toggle('hidden', section.id !== `${viewName}-view`));

  const titleElement = document.getElementById('view-title');
  if (titleElement) {
    const activeButton = document.querySelector(`.sidebar button[data-view="${viewName}"]`);
    titleElement.textContent = activeButton?.textContent.trim() || 'Dashboard';
  }

  if (viewName === 'estudiantes') loadPersonas();
  if (viewName === 'matricula') populatePersonaSelects();
  if (viewName === 'asistencia') populatePersonaSelects();
}

function setSubmitState(button, isSubmitting, label = 'Guardar') {
  if (!button) return;
  button.disabled = isSubmitting;
  button.innerHTML = isSubmitting
    ? '<span class="spinner-border spinner-border-sm"></span> Guardando...'
    : `<i class="bi bi-check2-circle"></i> ${label}`;
}

/* ============================================================
   ESTUDIANTES
   ============================================================ */

async function refreshDashboardCount() {
  try {
    const res = await apiFetch('/api/personas');
    if (!res.ok) throw new Error();
    const personas = await res.json();
    const cnt = document.getElementById('cnt-personas');
    if (cnt) cnt.textContent = personas.length;
  } catch {
    const cnt = document.getElementById('cnt-personas');
    if (cnt) cnt.textContent = '0';
  }
}

async function loadPersonas() {
  if (!personaTableBody) return;

  try {
    const res = await apiFetch('/api/personas');
    if (!res.ok) throw new Error('No se pudo cargar la lista de estudiantes');
    allPersonas = await res.json();

    const cnt = document.getElementById('cnt-personas');
    if (cnt) cnt.textContent = allPersonas.length;

    const searchInput = document.getElementById('persona-search');
    renderPersonasTable(filterPersonas(searchInput?.value || ''));
  } catch (error) {
    personaTableBody.innerHTML = '<tr><td colspan="5" class="text-muted">No se pudo cargar la tabla. Verifica que el backend esté corriendo.</td></tr>';
    showToast(error.message || 'Error cargando estudiantes', 'error');
  }
}

function filterPersonas(term) {
  const q = (term || '').trim().toLowerCase();
  if (!q) return allPersonas;
  return allPersonas.filter((p) => {
    const texto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.toLowerCase();
    return texto.includes(q);
  });
}

function renderPersonasTable(personas) {
  if (!personaTableBody) return;
  personaTableBody.innerHTML = '';

  const esAdmin = (currentUser?.rol || '').toLowerCase() === 'administrador';

  if (!personas.length) {
    personaTableBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center py-4">No hay estudiantes que coincidan.</td></tr>';
    return;
  }

  personas.forEach((p) => {
    const id = p.id_persona ?? p.id ?? '';
    const nombre = p.nombre ?? '';
    const ap1 = p.apellido1 ?? '';
    const ap2 = p.apellido2 ?? '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${id}</td><td>${nombre}</td><td>${ap1} ${ap2}</td><td>${p.fecha_nacimiento ?? ''}</td><td class="text-end">
      <button class="action-btn edit" data-id="${id}" title="Editar"><i class="bi bi-pencil"></i></button>
      ${esAdmin ? `<button class="action-btn del" data-id="${id}" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
    </td>`;
    personaTableBody.appendChild(tr);
  });
}

function resetForm() {
  document.getElementById('persona-id').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('apellido1').value = '';
  document.getElementById('apellido2').value = '';
  document.getElementById('fecha_nacimiento').value = '';
  document.getElementById('genero').value = '';
  if (cancelEditButton) cancelEditButton.classList.add('hidden');
  const titleEl = document.getElementById('persona-form-title');
  if (titleEl) titleEl.textContent = 'Agregar estudiante';
  const submitButton = personaForm?.querySelector('button[type="submit"]');
  if (submitButton) setSubmitState(submitButton, false, 'Guardar');
}

async function handlePersonaSubmit(e) {
  e.preventDefault();
  if (!personaForm) return;

  const submitButton = personaForm.querySelector('button[type="submit"]');
  const id = document.getElementById('persona-id').value;
  const nombre = document.getElementById('nombre').value.trim();
  const apellido1 = document.getElementById('apellido1').value.trim();
  const apellido2 = document.getElementById('apellido2').value.trim();
  const fecha_nacimiento = document.getElementById('fecha_nacimiento').value || null;
  const genero = document.getElementById('genero').value || null;

  if (!nombre || !apellido1) {
    showToast('Nombre y Apellido 1 son obligatorios', 'error');
    return;
  }

  setSubmitState(submitButton, true, 'Guardar');

  const payload = { nombre, apellido1, apellido2, fecha_nacimiento, genero };

  try {
    const url = `/api/personas${id ? `/${id}` : ''}`;
    const method = id ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      resetForm();
      await loadPersonas();
      showToast(json.mensaje || (id ? 'Persona actualizada' : 'Persona creada'));
    } else {
      showToast(json.mensaje || json.message || 'No se pudo guardar el estudiante', 'error');
    }
  } catch (error) {
    showToast(error.message || 'No se pudo conectar con el backend', 'error');
  } finally {
    setSubmitState(submitButton, false, 'Guardar');
  }
}

async function handlePersonaTableClick(e) {
  const editButton = e.target.closest('.edit');
  const deleteButton = e.target.closest('.del');

  if (editButton) {
    const id = editButton.dataset.id;
    try {
      const res = await apiFetch(`/api/personas/${id}`);
      const p = await res.json();
      document.getElementById('persona-id').value = p.id_persona ?? p.id ?? '';
      document.getElementById('nombre').value = p.nombre ?? '';
      document.getElementById('apellido1').value = p.apellido1 ?? '';
      document.getElementById('apellido2').value = p.apellido2 ?? '';
      document.getElementById('fecha_nacimiento').value = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '';
      document.getElementById('genero').value = p.genero ?? '';
      if (cancelEditButton) cancelEditButton.classList.remove('hidden');
      const titleEl = document.getElementById('persona-form-title');
      if (titleEl) titleEl.textContent = 'Editar estudiante';
      showToast('Editando estudiante');
    } catch (error) {
      showToast(error.message || 'No se pudo cargar la persona', 'error');
    }
  }

  if (deleteButton) {
    const id = deleteButton.dataset.id;
    if (!confirm('¿Eliminar este estudiante?')) return;
    try {
      const res = await apiFetch(`/api/personas/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadPersonas();
        showToast(json.mensaje || 'Persona eliminada');
      } else {
        showToast(json.mensaje || json.message || 'Error eliminando', 'error');
      }
    } catch (error) {
      showToast(error.message || 'Error de red', 'error');
    }
  }
}

/* ============================================================
   SELECTS COMPARTIDOS (matrícula / asistencia)
   ============================================================ */

async function populatePersonaSelects() {
  try {
    const res = await apiFetch('/api/personas');
    if (!res.ok) throw new Error('No se pudo cargar la lista de personas');
    const personas = await res.json();
    const matSel = document.getElementById('mat-persona');
    const asisSel = document.getElementById('asis-persona');

    [matSel, asisSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Seleccionar estudiante';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    });

    personas.forEach((p) => {
      const id = p.id_persona ?? p.id ?? '';
      const text = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = text || 'Sin nombre';
      if (matSel) matSel.appendChild(opt.cloneNode(true));
      if (asisSel) asisSel.appendChild(opt.cloneNode(true));
    });

    [matSel, asisSel].forEach((select) => {
      if (!select) return;
      select.disabled = personas.length === 0;
    });
  } catch (error) {
    showToast(error.message || 'No se pudieron cargar los estudiantes', 'error');
  }
}

/* ============================================================
   MATRÍCULA
   ============================================================ */

async function handleMatriculaSubmit(e) {
  e.preventDefault();
  const personaId = parseInt(document.getElementById('mat-persona').value, 10);
  const id_grupo = parseInt(document.getElementById('mat-id-grupo').value, 10);
  const hoy = new Date();

  if (Number.isNaN(personaId) || Number.isNaN(id_grupo)) {
    showToast('Selecciona un estudiante y un grupo válido', 'error');
    return;
  }

  const payload = {
    fecha: hoy.toISOString().split('T')[0],
    periodo: hoy.toLocaleString('default', { month: 'long' }),
    anio: hoy.getFullYear(),
    tipo: 'regular',
    estado: 1,
    observaciones: '',
    id_estudiante: personaId,
    id_usuario: currentUser?.id_usuario ?? 1,
    id_grupo: id_grupo
  };

  try {
    const res = await apiFetch('/api/procesos/matricula', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    const matResult = document.getElementById('mat-result');
    if (res.ok) {
      if (matResult) matResult.textContent = json.message || json.mensaje || 'Matrícula registrada';
      showToast(json.message || json.mensaje || 'Matrícula registrada');
    } else {
      if (matResult) matResult.textContent = JSON.stringify(json);
      showToast(json.message || json.mensaje || 'Error matrícula', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error de red', 'error');
  }
}

/* ============================================================
   ASISTENCIA
   ============================================================ */

async function handleAsistenciaSubmit(e) {
  e.preventDefault();
  const personaId = parseInt(document.getElementById('asis-persona').value, 10);
  const id_grupo = parseInt(document.getElementById('asis-id-grupo').value, 10);
  const id_profesor = parseInt(document.getElementById('asis-id-profesor').value, 10);
  const estado = document.getElementById('asis-estado').value;
  const fecha = document.getElementById('asis-fecha').value;

  if (Number.isNaN(personaId) || Number.isNaN(id_grupo) || Number.isNaN(id_profesor) || !fecha) {
    showToast('Completa todos los campos de asistencia', 'error');
    return;
  }

  const payload = {
    fecha,
    estado_asistencia: estado,
    observaciones: '',
    id_estudiante: personaId,
    id_grupo: id_grupo,
    id_profesor: id_profesor
  };

  try {
    const res = await apiFetch('/api/procesos/asistencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    const asisResult = document.getElementById('asis-result');
    if (res.ok) {
      if (asisResult) asisResult.textContent = json.message || json.mensaje || 'Asistencia registrada';
      showToast(json.message || json.mensaje || 'Asistencia registrada');
    } else {
      if (asisResult) asisResult.textContent = JSON.stringify(json);
      showToast(json.message || json.mensaje || 'Error asistencia', 'error');
    }
  } catch (error) {
    showToast(error.message || 'Error de red', 'error');
  }
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(message, type = 'success', ms = 3500) {
  const toastElement = document.getElementById('toast');
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.className = `toast ${type}`;
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    if (toastElement) toastElement.className = 'toast hidden';
  }, ms);
}