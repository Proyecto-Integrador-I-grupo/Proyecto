// frontend/ui.js
const baseUrl = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://proyecto-vcz6.onrender.com";
const SESSION_KEY = "educontrol_usuario";

let currentUser = null;
let views = [];
let appViewsReady = false;

window.addEventListener('DOMContentLoaded', () => {
  wireLoginScreen();
  restoreSession();
});

window.addEventListener('app:views-ready', () => {
  appViewsReady = true;
  if (currentUser) {
    initApp();
  }
});

/* ==========================================
   1. SESIÓN Y AUTENTICACIÓN
   ========================================== */

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
  const correoInput = document.getElementById('login-correo');
  const contrasenaInput = document.getElementById('login-contrasena');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  const correo = correoInput ? correoInput.value.trim() : '';
  const contrasena = contrasenaInput ? contrasenaInput.value : '';

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
      throw new Error(json.mensaje || json.message || 'Credenciales incorrectas.');
    }

    currentUser = json.usuario;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    showApp();
  } catch (error) {
    if (correoInput) correoInput.value = '';
    if (contrasenaInput) contrasenaInput.value = '';

    if (errorBox) { 
      errorBox.textContent = error.message || 'Usuario o contraseña incorrectos.'; 
      errorBox.classList.remove('hidden'); 
    }
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
  if (appViewsReady) {
    initApp();
  }
}

// Módulos a los que el rol "Profesor" NO tiene acceso todavía.
// (Dashboard, Asistencia, Reportes y Mi Perfil sí quedan disponibles.)
const VISTAS_RESTRINGIDAS_PROFESOR = ['matricula', 'estudiantes', 'profesores'];

function renderUserInfo() {
  if (!currentUser) return;
  const nombreCompleto = `${currentUser.nombre ?? ''} ${currentUser.apellido1 ?? ''}`.trim();
  const iniciales = `${(currentUser.nombre || '?')[0] ?? ''}${(currentUser.apellido1 || '?')[0] ?? ''}`.toUpperCase();
  const rol = currentUser.rol || '—';
  const rolNormalizado = rol.toLowerCase();
  const esAdmin = rolNormalizado === 'administrador';
  const esProfesor = rolNormalizado === 'profesor';
  const rolClase = esAdmin ? 'role-badge-admin' : (esProfesor ? 'role-badge-profesor' : 'role-badge-asistente');

 // Nombres de usuario
  ['sidebar-user-name', 'topbar-user-name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = nombreCompleto;
  });

  // Avatares / Fotos de perfil
  const claveFoto = `educontrol-perfil-foto-${currentUser.id_usuario}`;
  const fotoGuardada = localStorage.getItem(claveFoto);
  const fotoFinal = currentUser.foto || fotoGuardada;

  ['sidebar-avatar', 'topbar-avatar'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (fotoFinal) {
      if (el.tagName === 'IMG') {
        el.src = fotoFinal;
      } else {
        el.style.backgroundImage = `url("${fotoFinal}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = ''; // Limpia las iniciales si existen
      }
    } else {
      el.textContent = iniciales;
    }
  });
  [['sidebar-role-badge', rol], ['topbar-role-badge', rol]].forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `role-badge ${rolClase}`;
  });

  document.body.classList.toggle('is-admin', esAdmin);
  document.body.classList.toggle('is-asistente', !esAdmin && !esProfesor);
  document.body.classList.toggle('is-profesor', esProfesor);

  const assistantBanner = document.getElementById('assistant-permission-notice');
  if (assistantBanner) {
    assistantBanner.classList.toggle('hidden', esAdmin);
  }

  aplicarRestriccionesModulos(rolNormalizado);
}

function aplicarRestriccionesModulos(rolNormalizado) {
  const esProfesor = rolNormalizado === 'profesor';

  document.querySelectorAll('.sidebar button[data-view]').forEach((btn) => {
    const vista = btn.dataset.view;
    const restringida = esProfesor && VISTAS_RESTRINGIDAS_PROFESOR.includes(vista);
    const item = btn.closest('.nav-item') || btn;
    item.classList.toggle('hidden', restringida);
  });
}

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

/* ==========================================
   2. INICIALIZACIÓN Y NAVEGACIÓN
   Cada módulo (Estudiantes, Profesores, Matrícula, Asistencia, Reportes)
   conecta sus propios formularios, botones y filtros dentro de su init(),
   invocado por setActiveView() la primera vez que se visita esa vista.
   ========================================== */

function initApp() {
  views = document.querySelectorAll('.sidebar button[data-view]');
  views.forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

  setActiveView('dashboard');
  refreshDashboardCounts();
}

function setActiveView(viewName) {
  const rolNormalizado = (currentUser?.rol || '').toLowerCase();
  if (rolNormalizado === 'profesor' && VISTAS_RESTRINGIDAS_PROFESOR.includes(viewName)) {
    viewName = 'dashboard';
  }

  const targetSection = document.getElementById(`${viewName}-view`);
  if (!targetSection) return;
  const modulo = window.EduControlModules?.[viewName];

if (modulo && typeof modulo.init === 'function') {
  modulo.init();
}
 
  views.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle('active', isActive);
  });

  const sections = document.querySelectorAll('.view');
  sections.forEach((section) => section.classList.toggle('hidden', section.id !== `${viewName}-view`));

  const heroCard = document.getElementById('dashboard-hero');
  if (heroCard) heroCard.classList.toggle('hidden', viewName !== 'dashboard');

  const titleElement = document.getElementById('view-title');
  if (titleElement) {
    const activeButton = document.querySelector(`.sidebar button[data-view="${viewName}"]`);
    titleElement.textContent = activeButton?.textContent.trim() || 'Dashboard';
  }

  if (viewName === 'estudiantes') loadPersonas();
  if (viewName === 'profesores') loadProfesores();
  if (viewName === 'matricula') loadMatriculaData();
  if (viewName === 'asistencia') loadAsistenciaData();
  if (viewName === 'reportes') loadReportesData();
}

/* ==========================================
   3. UI Y NOTIFICACIONES COMPARTIDAS
   Usadas por varios módulos (Estudiantes, Profesores, etc.).
   ========================================== */

function showResultModal(type, titulo, mensaje) {
  const icono = document.getElementById('resultado-icono');
  const tituloEl = document.getElementById('resultado-titulo');
  const mensajeEl = document.getElementById('resultado-mensaje');

  if (icono) {
    icono.className = type === 'success'
      ? 'bi bi-check-circle-fill text-success'
      : 'bi bi-x-circle-fill text-danger';
    icono.style.fontSize = '42px';
  }
  if (tituloEl) tituloEl.textContent = titulo;
  if (mensajeEl) mensajeEl.textContent = mensaje;

  const modalEl = document.getElementById('modalResultado');
  if (modalEl) {
    const instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    instance.show();
  }
}

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