// frontend/ui.js
const baseUrl = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://proyecto-vcz6.onrender.com";
const SESSION_KEY = "educontrol_usuario";

let currentUser = null;
let views = [];
let appViewsReady = false;
const ACCESSIBILITY_KEY = 'educontrol_accesibilidad';
let accessibilitySettings = { isDark: false, highContrast: false, fontSize: 100 };

window.addEventListener('DOMContentLoaded', () => {
  wireLoginScreen();
  restoreAccessibilitySettings();
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
    togglePassword.setAttribute('aria-pressed', String(!showing));
    togglePassword.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
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

// Módulos a los que el rol "Profesor" NO tiene acceso
const VISTAS_RESTRINGIDAS_PROFESOR = ['matricula', 'estudiantes', 'profesores', 'usuarios'];

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
        el.textContent = '';
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
  const esAdmin = rolNormalizado === 'administrador';
  const esProfesor = rolNormalizado === 'profesor';

  document.querySelectorAll('.sidebar button[data-view]').forEach((btn) => {
    const vista = btn.dataset.view;
    let restringida = false;

    // SOLO el Administrador puede ver el botón de Gestión de Permisos/Usuarios
    if (vista === 'usuarios') {
      restringida = !esAdmin;
    } else if (esProfesor && VISTAS_RESTRINGIDAS_PROFESOR.includes(vista)) {
      restringida = true;
    }

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
   ========================================== */

function initApp() {
  views = document.querySelectorAll('.sidebar button[data-view]');
  views.forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

  wireUsuariosForm();
  wireSidebarToggle();
  initAccessibilityWidget();
  setActiveView('dashboard');
  refreshDashboardCounts();
}

function wireSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const icon = toggle?.querySelector('i');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar || !icon) return;

  const updateToggleState = () => {
    const isOpen = sidebar.classList.contains('open');
    icon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-list';
    toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    updateToggleState();
  });

  document.addEventListener('click', (event) => {
    if (window.innerWidth > 880) return;
    if (!sidebar.classList.contains('open')) return;
    if (toggle.contains(event.target) || sidebar.contains(event.target)) return;
    sidebar.classList.remove('open');
    updateToggleState();
  });
}

function setActiveView(viewName) {
  const rolNormalizado = (currentUser?.rol || '').toLowerCase();
  const esAdmin = rolNormalizado === 'administrador';

  // Si intentan entrar a Usuarios sin ser Admin, los devolvemos al Dashboard
  if (viewName === 'usuarios' && !esAdmin) {
    showToast('Acceso restringido. Solo administradores.', 'error');
    viewName = 'dashboard';
  } else if (rolNormalizado === 'profesor' && VISTAS_RESTRINGIDAS_PROFESOR.includes(viewName)) {
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
  if (viewName === 'usuarios') loadUsuariosData();

  if (window.innerWidth <= 880) {
    document.querySelector('.sidebar')?.classList.remove('open');
  }
}/* ==========================================
   3. MÓDULO DE USUARIOS Y PERMISOS
   ========================================== */

function wireUsuariosForm() {
  const form = document.getElementById('usuario-form');
  if (!form || form.dataset.wired === "true") return;
  form.dataset.wired = "true";

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('btn-guardar-usuario');
    const nombre = document.getElementById('usuario-nombre')?.value.trim();
    const apellido1 = document.getElementById('usuario-apellido1')?.value.trim();
    const correo = document.getElementById('usuario-correo')?.value.trim();
    const rolTexto = document.getElementById('usuario-rol')?.value;
    const contrasena = document.getElementById('usuario-clave')?.value;

    if (!nombre || !apellido1 || !correo || !contrasena) {
      showToast('Por favor completa todos los campos.', 'error');
      return;
    }

    const payload = {
      nombre,
      primer_apellido: apellido1,
      correo,
      contrasena,
      id_rol: rolTexto === 'Administrador' ? 1 : 2
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
    }

    try {
      const res = await apiFetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.mensaje || 'Error al guardar el usuario.');
      }

      showToast('Usuario guardado con éxito.', 'success');
      form.reset();
      
      // Carga y renderizado automático
      await loadUsuariosData();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-download me-1"></i> Guardar Usuario';
      }
    }
  });
}

async function loadUsuariosData() {
  try {
    const res = await apiFetch('/api/usuarios');
    if (!res.ok) return;
    const usuarios = await res.json();
    renderTablaUsuarios(usuarios);
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
  }
}

function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody) return;

  if (!Array.isArray(usuarios) || usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No hay usuarios registrados.</td></tr>`;
    return;
  }

  // Filtrar docentes (id_rol === 3)
  const usuariosPermisos = usuarios.filter(u => u.id_rol === 1 || u.id_rol === 2);

  tbody.innerHTML = usuariosPermisos.map(u => {
    const esElMismo = currentUser?.id_usuario === u.id_usuario;
    const esAdmin = u.id_rol === 1;

    return `
      <tr>
        <td><strong>${u.nombre || 'Usuario'} ${u.apellido1 || ''}</strong></td>
        <td>${u.correo || '—'}</td>
        <td>
          <span class="badge ${esAdmin ? 'bg-dark' : 'bg-info'} text-white px-2 py-1">
            ${esAdmin ? 'Administrador' : 'Asistente'}
          </span>
        </td>
        <td class="text-end">
          ${esElMismo 
            ? `<span class="badge bg-light text-dark border">Sesión Actual</span>`
            : `<button class="btn btn-sm btn-outline-danger" onclick="eliminarUsuario(${u.id_usuario})">
                 <i class="bi bi-trash"></i> Eliminar
               </button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

window.eliminarUsuario = async function(idUsuario) {
  if (!idUsuario) return;
  if (!confirm('¿Deseas eliminar este usuario?')) return;

  try {
    const res = await apiFetch(`/api/usuarios/${idUsuario}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.mensaje || 'Error al eliminar usuario.');
    }
    showToast('Usuario eliminado con éxito.', 'success');
    await loadUsuariosData();
  } catch (err) {
    showToast(err.message, 'error');
  }
};
/* ==========================================
   4. UI Y NOTIFICACIONES COMPARTIDAS
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

function initAccessibilityWidget() {
  const toggleBtn = document.getElementById('accessibility-toggle');
  const menu = document.getElementById('accessibility-menu');
  const themeBtn = document.getElementById('btn-toggle-theme');
  const contrastBtn = document.getElementById('btn-toggle-contrast');
  const resetBtn = document.getElementById('btn-reset-accessibility');
  const fontRange = document.getElementById('font-size-range');
  const fontValue = document.getElementById('font-size-value');

  if (!toggleBtn || !menu || !themeBtn || !contrastBtn || !resetBtn || !fontRange || !fontValue) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = menu.classList.toggle('hidden');
    toggleBtn.setAttribute('aria-expanded', (!isHidden).toString());
  });

  themeBtn.addEventListener('click', () => {
    accessibilitySettings.isDark = !accessibilitySettings.isDark;
    applyAccessibilitySettings();
    menu.classList.add('hidden');
    toggleBtn.setAttribute('aria-expanded', 'false');
  });

  contrastBtn.addEventListener('click', () => {
    accessibilitySettings.highContrast = !accessibilitySettings.highContrast;
    applyAccessibilitySettings();
    menu.classList.add('hidden');
    toggleBtn.setAttribute('aria-expanded', 'false');
  });

  resetBtn.addEventListener('click', () => {
    accessibilitySettings = {
      isDark: false,
      highContrast: false,
      fontSize: 100,
    };
    applyAccessibilitySettings();
    menu.classList.add('hidden');
    toggleBtn.setAttribute('aria-expanded', 'false');
  });

  fontRange.addEventListener('input', () => {
    accessibilitySettings.fontSize = parseInt(fontRange.value, 10);
    fontValue.textContent = `${accessibilitySettings.fontSize}%`;
    applyAccessibilitySettings();
  });

  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('hidden') && !toggleBtn.contains(event.target) && !menu.contains(event.target)) {
      menu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  updateAccessibilityControls();
}

function applyAccessibilitySettings() {
  document.body.classList.toggle('theme-dark', accessibilitySettings.isDark);
  document.body.classList.toggle('high-contrast', accessibilitySettings.highContrast);
  document.body.style.fontSize = `${accessibilitySettings.fontSize}%`;
  localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(accessibilitySettings));
  updateAccessibilityControls();
}

function restoreAccessibilitySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY));
    if (saved) {
      accessibilitySettings = {
        ...accessibilitySettings,
        ...saved,
      };
    }
  } catch (err) {
    console.warn('No se pudo restaurar accesibilidad:', err);
  }
  applyAccessibilitySettings();
}

function updateAccessibilityControls() {
  const themeBtn = document.getElementById('btn-toggle-theme');
  const contrastBtn = document.getElementById('btn-toggle-contrast');
  const fontRange = document.getElementById('font-size-range');
  const fontValue = document.getElementById('font-size-value');
  if (!themeBtn || !contrastBtn || !fontRange || !fontValue) return;

  themeBtn.textContent = accessibilitySettings.isDark ? 'Modo claro' : 'Modo oscuro';
  contrastBtn.textContent = accessibilitySettings.highContrast ? 'Contraste normal' : 'Alto contraste';
  fontRange.value = accessibilitySettings.fontSize;
  fontValue.textContent = `${accessibilitySettings.fontSize}%`;

  themeBtn.classList.toggle('accessibility-action-active', accessibilitySettings.isDark);
  contrastBtn.classList.toggle('accessibility-action-active', accessibilitySettings.highContrast);
}