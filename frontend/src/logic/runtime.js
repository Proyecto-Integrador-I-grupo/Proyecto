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

  // Nombre de usuario
  const nombreEl = document.getElementById('sidebar-user-name');
  if (nombreEl) nombreEl.textContent = nombreCompleto;

  // Avatares / Fotos de perfil
  const claveFoto = `educontrol-perfil-foto-${currentUser.id_usuario}`;
  const fotoGuardada = localStorage.getItem(claveFoto);
  const fotoFinal = currentUser.foto || fotoGuardada;

  const avatarEl = document.getElementById('sidebar-avatar');
  if (avatarEl) {
    if (fotoFinal) {
      if (avatarEl.tagName === 'IMG') {
        avatarEl.src = fotoFinal;
      } else {
        avatarEl.style.backgroundImage = `url("${fotoFinal}")`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
      }
    } else {
      avatarEl.textContent = iniciales;
    }
  }

  const rolBadgeEl = document.getElementById('sidebar-role-badge');
  if (rolBadgeEl) {
    rolBadgeEl.textContent = rol;
    rolBadgeEl.className = `role-badge ${rolClase}`;
  }

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
    if (window.innerWidth >= 992) return;
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

  if (window.innerWidth < 992) {
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

(function () {
  const moduleName = 'dashboard';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE DASHBOARD
   Contadores generales de estudiantes y profesores.
   ========================================== */

async function refreshDashboardCounts() {
  try {
    const resEst = await apiFetch('/api/estudiantes');
    if (resEst.ok) {
      const estudiantes = await resEst.json();
      const cnt = document.getElementById('cnt-personas');
      if (cnt) cnt.textContent = estudiantes.length;
    }

    const resProf = await apiFetch('/api/profesores');
    if (resProf.ok) {
      const profesores = await resProf.json();
      const cntP = document.getElementById('cnt-profesores');
      if (cntP) cntP.textContent = profesores.length;
    }
  } catch {
    console.error('Error al actualizar contadores');
  }
}

(function () {
  const moduleName = 'estudiantes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireEstudiantesEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE ESTUDIANTES (PERSONAS)
   Pre-registro de estudiantes: alta, edición, búsqueda y baja lógica.
   ========================================== */

let allPersonas = [];
let personaTableBody = null;
let estudiantePendienteId = null;

function wireEstudiantesEvents() {
  personaTableBody = document.querySelector('#personas-table tbody');
  const personaForm = document.getElementById('persona-form');

  if (personaForm && !personaForm.dataset.wired) {
    personaForm.dataset.wired = '1';
    personaForm.addEventListener('submit', handlePersonaSubmit);
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

  const confirmarEliminarEstudianteBtn = document.getElementById('confirmar-eliminar-estudiante-btn');
  if (confirmarEliminarEstudianteBtn && !confirmarEliminarEstudianteBtn.dataset.wired) {
    confirmarEliminarEstudianteBtn.dataset.wired = '1';
    confirmarEliminarEstudianteBtn.addEventListener('click', async () => {
      bootstrap.Modal.getInstance(document.getElementById('modalEliminarEstudiante'))?.hide();
      await eliminarEstudiante(estudiantePendienteId);
    });
  }

  const modalEstudianteEl = document.getElementById('modalEstudiante');
  if (modalEstudianteEl && !modalEstudianteEl.dataset.wired) {
    modalEstudianteEl.dataset.wired = '1';
    modalEstudianteEl.addEventListener('hidden.bs.modal', resetPersonaForm);
  }
}

async function loadPersonas() {
  if (!personaTableBody) return;

  try {
    const res = await apiFetch('/api/estudiantes');
    if (!res.ok) throw new Error('No se pudo cargar la lista de estudiantes');
    allPersonas = await res.json();

    const searchInput = document.getElementById('persona-search');
    renderPersonasTable(filterPersonas(searchInput?.value || ''));
  } catch (error) {
    personaTableBody.innerHTML = '<tr><td colspan="6" class="text-muted text-center py-3">Error al obtener estudiantes del servidor.</td></tr>';
    showToast(error.message || 'Error cargando datos', 'error');
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
    personaTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <i class="bi bi-people display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay estudiantes registrados todavía.</span>
        </td>
      </tr>
    `;
    return;
  }

  personas.forEach((p) => {
    const id = p.id_estudiante ?? p.id ?? '';
    const nombreCompleto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
    const nac = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '-';
    const ingreso = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : '-';
    const activo = p.estado == 1 || p.estado === undefined;

    const badgeEstado = activo
      ? '<span class="badge bg-success">Activo</span>'
      : '<span class="badge bg-secondary">Inactivo</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${id}</td>
      <td>${nombreCompleto}</td>
      <td>${nac}</td>
      <td>${ingreso}</td>
      <td>${badgeEstado}</td>
      <td class="text-end">
        <button class="action-btn edit" data-id="${id}"><i class="bi bi-pencil"></i> Editar</button>
        ${esAdmin ? `<button class="action-btn del eliminar-estudiante-btn" data-id="${id}" data-nombre="${nombreCompleto}"><i class="bi bi-trash"></i> Eliminar</button>` : ''}
      </td>
    `;
    personaTableBody.appendChild(tr);
  });
}

function resetPersonaForm() {
  document.getElementById('persona-id').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('apellido1').value = '';
  document.getElementById('apellido2').value = '';
  document.getElementById('fecha_nacimiento').value = '';
  document.getElementById('genero').value = '';
  const ingresoEl = document.getElementById('persona-fecha-ingreso');
  if (ingresoEl) ingresoEl.value = '';
  const titleEl = document.getElementById('persona-form-title');
  if (titleEl) titleEl.textContent = 'Pre-registro de Estudiante';
  const submitEl = document.getElementById('persona-submit');
  if (submitEl) submitEl.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Estudiante';
}

async function handlePersonaSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('persona-id').value;
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    apellido1: document.getElementById('apellido1').value.trim(),
    apellido2: document.getElementById('apellido2').value.trim(),
    fecha_nacimiento: document.getElementById('fecha_nacimiento').value || null,
    genero: document.getElementById('genero').value || null,
    fecha_ingreso: document.getElementById('persona-fecha-ingreso')?.value || null
  };

  try {
    const url = `/api/estudiantes${id ? `/${id}` : ''}`;
    const method = id ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

    if (res.ok) {
      const modalEl = document.getElementById('modalEstudiante');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

      await loadPersonas();
      await refreshDashboardCounts();
      showResultModal(
        'success',
        id ? 'Estudiante actualizado' : 'Estudiante registrado',
        id ? 'Los datos del estudiante se actualizaron correctamente.' : 'El estudiante quedó pre-registrado. Recuerda procesar su matrícula cuando corresponda.'
      );
    } else {
      const json = await res.json().catch(() => ({}));
      showResultModal('error', 'No se pudo guardar', json.mensaje || json.error || 'No se pudo guardar la información del estudiante.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  }
}

async function handlePersonaTableClick(e) {
  const editButton = e.target.closest('.edit');
  const deleteButton = e.target.closest('.eliminar-estudiante-btn');

  if (editButton) {
    const id = editButton.dataset.id;
    try {
      const res = await apiFetch(`/api/estudiantes/${id}`);
      if (!res.ok) throw new Error();
      const p = await res.json();

      document.getElementById('persona-id').value = p.id_estudiante ?? p.id ?? '';
      document.getElementById('nombre').value = p.nombre ?? '';
      document.getElementById('apellido1').value = p.apellido1 ?? '';
      document.getElementById('apellido2').value = p.apellido2 ?? '';
      document.getElementById('fecha_nacimiento').value = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '';
      document.getElementById('genero').value = p.genero ?? '';
      const ingresoEl = document.getElementById('persona-fecha-ingreso');
      if (ingresoEl) ingresoEl.value = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : '';

      document.getElementById('persona-form-title').textContent = 'Editar Estudiante';
      const submitEl = document.getElementById('persona-submit');
      if (submitEl) submitEl.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Cambios';

      const modalEl = document.getElementById('modalEstudiante');
      if (modalEl) new bootstrap.Modal(modalEl).show();
    } catch {
      showResultModal('error', 'Error', 'No se pudo obtener la información del estudiante.');
    }
  }

  if (deleteButton) {
    estudiantePendienteId = deleteButton.dataset.id;
    const nombreEl = document.getElementById('eliminar-nombre-estudiante');
    if (nombreEl) nombreEl.textContent = deleteButton.dataset.nombre || '';

    const modalEl = document.getElementById('modalEliminarEstudiante');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }
}

async function eliminarEstudiante(id) {
  if (!id) return;
  try {
    const res = await apiFetch(`/api/estudiantes/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showResultModal('success', 'Estudiante eliminado', 'El estudiante fue marcado como inactivo y ya no aparece en el listado.');
      await loadPersonas();
      await refreshDashboardCounts();
    } else {
      showResultModal('error', 'No se pudo eliminar', json.error || 'Ocurrió un error al eliminar el estudiante.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    estudiantePendienteId = null;
  }
}

(function () {
  const moduleName = 'profesores';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireProfesoresEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE PROFESORES
   Alta, edición, destitución, reintegro y asignación de sustitutos.
   ========================================== */

let allProfesores = [];
let profesorPendienteId = null;
let profesorReintegrarId = null;
let profesorFiltroEstado = 'todos';
let profesorBusqueda = '';

function wireProfesoresEvents() {
  const profForm = document.getElementById('profesor-form');
  if (profForm && !profForm.dataset.wired) {
    profForm.dataset.wired = '1';
    profForm.addEventListener('submit', handleProfesorSubmit);
  }

  const toggleProfPassword = document.getElementById('toggle-prof-password');
  if (toggleProfPassword && !toggleProfPassword.dataset.wired) {
    toggleProfPassword.dataset.wired = '1';
    toggleProfPassword.addEventListener('click', () => {
      const input = document.getElementById('prof-contrasena');
      const icon = toggleProfPassword.querySelector('i');
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      icon?.classList.toggle('bi-eye', showing);
      icon?.classList.toggle('bi-eye-slash', !showing);
    });
  }

  const profTableBody = document.querySelector('#profesores-table tbody');
  if (profTableBody && !profTableBody.dataset.wired) {
    profTableBody.dataset.wired = '1';
    profTableBody.addEventListener('click', handleProfesorTableClick);
  }

  const profFiltroEstado = document.getElementById('prof-filtro-estado');
  if (profFiltroEstado && !profFiltroEstado.dataset.wired) {
    profFiltroEstado.dataset.wired = '1';
    profFiltroEstado.addEventListener('change', () => {
      profesorFiltroEstado = profFiltroEstado.value;
      renderProfesoresTable(filtrarProfesores(allProfesores));
    });
  }

  const profSearch = document.getElementById('prof-search');
  if (profSearch && !profSearch.dataset.wired) {
    profSearch.dataset.wired = '1';
    profSearch.addEventListener('input', () => {
      profesorBusqueda = profSearch.value.trim().toLowerCase();
      renderProfesoresTable(filtrarProfesores(allProfesores));
    });
  }

  const confirmarDestituirBtn = document.getElementById('confirmar-destituir-btn');
  if (confirmarDestituirBtn && !confirmarDestituirBtn.dataset.wired) {
    confirmarDestituirBtn.dataset.wired = '1';
    confirmarDestituirBtn.addEventListener('click', async () => {
      const motivo = document.getElementById('destituir-motivo')?.value.trim() || '';
      bootstrap.Modal.getInstance(document.getElementById('modalDestituir'))?.hide();
      await destituirProfesor(profesorPendienteId, motivo);
    });
  }

  const confirmarEliminarBtn = document.getElementById('confirmar-eliminar-btn');
  if (confirmarEliminarBtn && !confirmarEliminarBtn.dataset.wired) {
    confirmarEliminarBtn.dataset.wired = '1';
    confirmarEliminarBtn.addEventListener('click', async () => {
      bootstrap.Modal.getInstance(document.getElementById('modalEliminarProfesor'))?.hide();
      await eliminarProfesor(profesorPendienteId);
    });
  }

  const confirmarReintegrarBtn = document.getElementById('confirmar-reintegrar-btn');
  if (confirmarReintegrarBtn && !confirmarReintegrarBtn.dataset.wired) {
    confirmarReintegrarBtn.dataset.wired = '1';
    confirmarReintegrarBtn.addEventListener('click', async () => {
      bootstrap.Modal.getInstance(document.getElementById('modalReintegrar'))?.hide();
      await reintegrarProfesor(profesorReintegrarId);
    });
  }

  const asignarGruposSearch = document.getElementById('asignar-grupos-search');
  if (asignarGruposSearch && !asignarGruposSearch.dataset.wired) {
    asignarGruposSearch.dataset.wired = '1';
    asignarGruposSearch.addEventListener('input', () => {
      filtrarChecklistGrupos(asignarGruposSearch.value);
    });
  }

  const confirmarAsignarGruposBtn = document.getElementById('confirmar-asignar-grupos-btn');
  if (confirmarAsignarGruposBtn && !confirmarAsignarGruposBtn.dataset.wired) {
    confirmarAsignarGruposBtn.dataset.wired = '1';
    confirmarAsignarGruposBtn.addEventListener('click', async () => {
      const idProf = confirmarAsignarGruposBtn.dataset.idProf;
      if (!idProf) return;
      await guardarAsignacionGrupos(idProf);
    });
  }

  // Limpieza segura de backdrops al cerrar modales para prevenir bloqueos de pantalla
  const modalSustitutoEl = document.getElementById('modalAsignarSustituto');
  if (modalSustitutoEl && !modalSustitutoEl.dataset.wiredBackdrop) {
    modalSustitutoEl.dataset.wiredBackdrop = '1';
    modalSustitutoEl.addEventListener('hidden.bs.modal', () => {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    });
  }

  const modalAsignarGruposEl = document.getElementById('modalAsignarGrupos');
  if (modalAsignarGruposEl && !modalAsignarGruposEl.dataset.wiredBackdrop) {
    modalAsignarGruposEl.dataset.wiredBackdrop = '1';
    modalAsignarGruposEl.addEventListener('hidden.bs.modal', () => {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    });
  }
}

async function loadProfesores() {
  const profTableBody = document.querySelector('#profesores-table tbody');
  if (!profTableBody) return;

  try {
    const res = await apiFetch('/api/profesores');
    if (!res.ok) throw new Error('No se pudo cargar la lista de profesores');
    allProfesores = await res.json();
    actualizarStatsProfesores(allProfesores);
    renderProfesoresTable(filtrarProfesores(allProfesores));
  } catch (error) {
    profTableBody.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-3">Error al cargar profesores.</td></tr>';
    showToast(error.message || 'Error al obtener datos', 'error');
  }
}

function filtrarProfesores(profesores) {
  let resultado = profesores;

  if (profesorFiltroEstado === 'activos') {
    resultado = resultado.filter((p) => p.estado == 1 || p.estado === true);
  } else if (profesorFiltroEstado === 'inactivos') {
    resultado = resultado.filter((p) => !(p.estado == 1 || p.estado === true));
  }

  if (profesorBusqueda) {
    resultado = resultado.filter((p) => {
      const nombreComp = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.toLowerCase();
      const materia = (p.materia ?? '').toLowerCase();
      return nombreComp.includes(profesorBusqueda) || materia.includes(profesorBusqueda);
    });
  }

  return resultado;
}

function actualizarStatsProfesores(profesores) {
  const total = profesores.length;
  const activos = profesores.filter((p) => p.estado == 1 || p.estado === true).length;
  const inactivos = total - activos;
  const pendientes = profesores.reduce((acc, p) => acc + Number(p.grupos_pendientes ?? 0), 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('prof-cnt-total', total);
  setText('prof-cnt-activos', activos);
  setText('prof-cnt-inactivos', inactivos);
  setText('prof-cnt-pendientes', pendientes);
}

function renderProfesoresTable(profesores) {
  const profTableBody = document.querySelector('#profesores-table tbody');
  if (!profTableBody) return;
  profTableBody.innerHTML = '';

  const esAdmin = (currentUser?.rol || '').toLowerCase() === 'administrador';

  if (!profesores.length) {
    const mensaje = (profesorFiltroEstado !== 'todos' || profesorBusqueda)
      ? 'No hay profesores que coincidan con la búsqueda o el filtro seleccionado.'
      : 'No hay profesores registrados.';
    profTableBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-4">${mensaje}</td></tr>`;
    return;
  }

  profesores.forEach((p) => {
    const idProf = p.id_profesor ?? p.id;
    const nombreComp = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
    const materia = p.materia ?? 'N/A';
    const ingreso = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : 'N/A';
    const activo = p.estado == 1 || p.estado === true;
    const grupoPendientes = Number(p.grupos_pendientes ?? 0);

    const badgeEstado = activo 
      ? '<span class="badge bg-success">Activo</span>' 
      : '<span class="badge bg-danger">Incapacitado/Inactivo</span>';

    const celdaGrupos = activo
      ? (p.grupos_asignados ? `<span class="small">${p.grupos_asignados}</span>` : '<span class="text-muted small">Sin grupos</span>')
      : (grupoPendientes > 0
          ? `<span class="badge bg-warning text-dark">${grupoPendientes} grupo(s) por cubrir/restaurar</span>`
          : '<span class="text-muted small">Sin grupos pendientes</span>');

    const tr = document.createElement('tr');
    if (!activo) tr.classList.add('profesor-row-inactivo');
    tr.innerHTML = `
      <td>${idProf}</td>
      <td>${nombreComp}</td>
      <td><span class="badge bg-light text-dark border px-2 py-1">${materia}</span></td>
      <td>${ingreso}</td>
      <td>${celdaGrupos}</td>
      <td>${badgeEstado}</td>
      <td class="text-end">
        <div class="profesor-actions-inline d-flex justify-content-end align-items-center gap-1 flex-wrap">
          ${activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-primary asignar-grupos-btn" data-id="${idProf}" data-nombre="${nombreComp}" data-materia="${materia}">
              <i class="bi bi-diagram-3 me-1"></i>Grupos
            </button>
          ` : ''}
          ${activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-warning destituir-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-slash me-1"></i>Destituir
            </button>
          ` : ''}
          ${!activo && esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-success reintegrar-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-check-fill me-1"></i>Reintegrar
            </button>
          ` : ''}
          ${!activo && esAdmin && grupoPendientes > 0 ? `
            <button type="button" class="btn btn-sm btn-outline-primary sustituto-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-person-lines-fill me-1"></i>Sustituto
            </button>
          ` : ''}
          ${esAdmin ? `
            <button type="button" class="btn btn-sm btn-outline-danger eliminar-profesor-btn" data-id="${idProf}" data-nombre="${nombreComp}">
              <i class="bi bi-trash me-1"></i>Eliminar
            </button>
          ` : ''}
          ${!esAdmin ? `<span class="text-muted small">Sin acciones</span>` : ''}
        </div>
      </td>
    `;
    profTableBody.appendChild(tr);
  });
}

async function handleProfesorSubmit(e) {
  e.preventDefault();

  const nombre = document.getElementById('prof-nombre')?.value.trim();
  const apellido1 = document.getElementById('prof-apellido1')?.value.trim();
  const materia = document.getElementById('prof-materia')?.value;
  const correo = document.getElementById('prof-correo')?.value.trim();
  const contrasena = document.getElementById('prof-contrasena')?.value || '';

  if (!nombre || !apellido1 || !materia) {
    showToast('Por favor completa el nombre, apellido y selecciona una materia.', 'error');
    return;
  }

  if (!correo || !contrasena) {
    showToast('Ingresa el correo y la contraseña de acceso del docente.', 'error');
    return;
  }

  if (contrasena.length < 6) {
    showToast('La contraseña de acceso debe tener al menos 6 caracteres.', 'error');
    return;
  }

  const payload = {
    nombre: nombre,
    apellido1: apellido1,
    apellido2: document.getElementById('prof-apellido2')?.value.trim() || '',
    fecha_nacimiento: document.getElementById('prof-fecha-nac')?.value || null,
    genero: document.getElementById('prof-genero')?.value || null,
    materia: materia,
    fecha_ingreso: document.getElementById('prof-fecha-ingreso')?.value || null,
    correo: correo,
    contrasena: contrasena
  };

  try {
    const res = await apiFetch('/api/profesores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      const modalEl = document.getElementById('modalProfesor');
      if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.hide();
      }

      document.getElementById('profesor-form')?.reset();
      await loadProfesores();
      await populateProfesoresSelects();
      await refreshDashboardCounts();
      showResultModal('success', 'Profesor registrado', 'El profesor fue agregado correctamente al cuerpo docente.');
    } else {
      showResultModal('error', 'No se pudo registrar', json.error || json.mensaje || 'Ocurrió un error registrando al profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  }
}

function handleProfesorTableClick(e) {
  const btnDestituir = e.target.closest('.destituir-btn');
  const btnEliminar = e.target.closest('.eliminar-profesor-btn');
  const btnReintegrar = e.target.closest('.reintegrar-btn');
  const btnSustituto = e.target.closest('.sustituto-btn');
  const btnAsignarGrupos = e.target.closest('.asignar-grupos-btn');

  if (btnDestituir || btnEliminar || btnReintegrar || btnSustituto || btnAsignarGrupos) {
    e.preventDefault();
  }

  if (btnDestituir) {
    profesorPendienteId = btnDestituir.dataset.id;
    const nombreEl = document.getElementById('destituir-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnDestituir.dataset.nombre || '';
    const motivoEl = document.getElementById('destituir-motivo');
    if (motivoEl) motivoEl.value = 'Incapacidad médica / Salida';

    const modalEl = document.getElementById('modalDestituir');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnEliminar) {
    profesorPendienteId = btnEliminar.dataset.id;
    const nombreEl = document.getElementById('eliminar-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnEliminar.dataset.nombre || '';

    const modalEl = document.getElementById('modalEliminarProfesor');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnReintegrar) {
    profesorReintegrarId = btnReintegrar.dataset.id;
    const nombreEl = document.getElementById('reintegrar-nombre-profesor');
    if (nombreEl) nombreEl.textContent = btnReintegrar.dataset.nombre || '';

    const modalEl = document.getElementById('modalReintegrar');
    if (modalEl) new bootstrap.Modal(modalEl).show();
  }

  if (btnSustituto) {
    abrirModalAsignarSustituto(btnSustituto.dataset.id, btnSustituto.dataset.nombre || '');
  }

  if (btnAsignarGrupos) {
    abrirModalAsignarGrupos(
      btnAsignarGrupos.dataset.id,
      btnAsignarGrupos.dataset.nombre || '',
      btnAsignarGrupos.dataset.materia || ''
    );
  }
}

async function destituirProfesor(idProf, motivo) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}/destituir`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });

    if (res.ok) {
      showResultModal(
        'success',
        'Profesor incapacitado',
        'El profesor fue marcado como inactivo y retirado de todos sus grupos asignados.'
      );
      await loadProfesores();
      await populateProfesoresSelects();
    } else {
      const json = await res.json().catch(() => ({}));
      showResultModal('error', 'No se pudo destituir', json.error || 'Ocurrió un error al procesar la destitución.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorPendienteId = null;
  }
}

async function eliminarProfesor(idProf) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showResultModal('success', 'Profesor eliminado', 'El registro del profesor fue eliminado permanentemente del sistema.');
      await loadProfesores();
      await populateProfesoresSelects();
      await refreshDashboardCounts();
    } else {
      showResultModal('error', 'No se pudo eliminar', json.error || 'Ocurrió un error al eliminar el profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorPendienteId = null;
  }
}

async function reintegrarProfesor(idProf) {
  if (!idProf) return;
  try {
    const res = await apiFetch(`/api/profesores/${idProf}/reintegrar`, { method: 'PUT' });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      const restaurados = json.resultado?.grupos_restaurados?.length ?? 0;
      const omitidos = json.resultado?.grupos_omitidos?.length ?? 0;
      let mensaje = 'El profesor fue marcado como activo nuevamente.';
      if (restaurados > 0) mensaje += ` Se le restauraron ${restaurados} grupo(s).`;
      if (omitidos > 0) mensaje += ` ${omitidos} grupo(s) ya no existían y no se pudieron restaurar.`;
      showResultModal('success', 'Profesor reintegrado', mensaje);
      await loadProfesores();
      await populateProfesoresSelects();
    } else {
      showResultModal('error', 'No se pudo reintegrar', json.error || 'Ocurrió un error al reintegrar al profesor.');
    }
  } catch {
    showResultModal('error', 'Error de conexión', 'No se pudo conectar con el servidor.');
  } finally {
    profesorReintegrarId = null;
  }
}

async function abrirModalAsignarSustituto(idProfTitular, nombreTitular) {
  const nombreEl = document.getElementById('sustituto-nombre-profesor');
  if (nombreEl) nombreEl.textContent = nombreTitular || '';

  const modalEl = document.getElementById('modalAsignarSustituto');
  if (modalEl) new bootstrap.Modal(modalEl).show();

  const lista = document.getElementById('sustituto-lista');
  if (lista) lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Cargando grupos pendientes...</p>';

  try {
    const [resSuplencias, resProfesores] = await Promise.all([
      apiFetch('/api/profesores/suplencias/pendientes'),
      apiFetch('/api/profesores')
    ]);

    if (!resSuplencias.ok) throw new Error('No se pudieron cargar los grupos pendientes.');

    const suplencias = (await resSuplencias.json()).filter(
      (s) => String(s.id_profesor_titular) === String(idProfTitular)
    );
    const profesores = resProfesores.ok ? await resProfesores.json() : [];
    const profesoresActivos = profesores.filter(
      (p) => (p.estado == 1 || p.estado === true) && String(p.id_profesor ?? p.id) !== String(idProfTitular)
    );

    renderListaSuplencias(suplencias, profesoresActivos, idProfTitular);
  } catch (error) {
    if (lista) lista.innerHTML = `<p class="text-danger text-center py-3 mb-0">${error.message || 'Error al cargar los grupos pendientes.'}</p>`;
  }
}

function renderListaSuplencias(suplencias, profesoresActivos, idProfTitular) {
  const lista = document.getElementById('sustituto-lista');
  if (!lista) return;

  if (!suplencias.length) {
    lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Este profesor no tiene grupos pendientes de cubrir o restaurar.</p>';
    return;
  }

  const opcionesProfesores = profesoresActivos
    .map((p) => `<option value="${p.id_profesor ?? p.id}">${p.nombre} ${p.apellido1} (${p.materia || 'General'})</option>`)
    .join('');

  lista.innerHTML = suplencias.map((s) => `
    <div class="border rounded-3 p-3 d-flex align-items-center justify-content-between gap-3 flex-wrap" data-suplencia-row="${s.id_suplencia}">
      <div>
        <div class="fw-semibold">${s.nombre_grupo ?? 'Grupo #' + s.id_grupo}</div>
        <div class="small text-muted">
          ${s.id_profesor_suplente
            ? `Cubierto provisionalmente por: <strong>${s.suplente_nombre}</strong>`
            : 'Sin sustituto asignado todavía'}
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <select class="form-select form-select-sm sustituto-select" style="min-width: 220px;" data-grupo="${s.id_grupo}">
          <option value="" disabled ${s.id_profesor_suplente ? '' : 'selected'}>Seleccionar profesor</option>
          ${opcionesProfesores}
        </select>
        <button type="button" class="btn btn-sm btn-primary asignar-sustituto-confirm-btn"
          data-grupo="${s.id_grupo}" data-titular="${idProfTitular}">
          <i class="bi bi-check2"></i> ${s.id_profesor_suplente ? 'Cambiar' : 'Asignar'}
        </button>
      </div>
    </div>
  `).join('');

  lista.querySelectorAll('.asignar-sustituto-confirm-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const fila = btn.closest('[data-suplencia-row]');
      const select = fila?.querySelector('.sustituto-select');
      const idGrupo = btn.dataset.grupo;
      const idTitular = btn.dataset.titular;
      const idNuevoProfesor = select?.value;

      if (!idNuevoProfesor) {
        showToast('Selecciona un profesor sustituto primero.', 'error');
        return;
      }

      await asignarSustituto(idGrupo, idNuevoProfesor, idTitular);
    });
  });
}

async function asignarSustituto(idGrupo, idNuevoProfesor, idProfesorAnterior) {
  try {
    const res = await apiFetch('/api/profesores/reasignar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupoId: parseInt(idGrupo, 10),
        profesorId: parseInt(idNuevoProfesor, 10),
        profesorAnteriorId: parseInt(idProfesorAnterior, 10)
      })
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Grupo asignado provisionalmente. Se restaurará al titular al reintegrarlo.', 'success');
      await loadProfesores();
      const nombreTitular = document.getElementById('sustituto-nombre-profesor')?.textContent || '';
      await abrirModalAsignarSustituto(idProfesorAnterior, nombreTitular);
    } else {
      showToast(json.error || 'No se pudo asignar el sustituto.', 'error');
    }
  } catch {
    showToast('Error de conexión al asignar el sustituto.', 'error');
  }
}

async function populateProfesoresSelects(isGestion = false) {
  try {
    const res = await apiFetch('/api/profesores');
    if (!res.ok) return;
    const profesores = await res.json();
    const grupoProfSel = document.getElementById('grupo-profesor');
    const asisProfSel = document.getElementById('asis-id-profesor');
    const gestionProfSel = document.getElementById('gestion-grupo-profesor');

    [grupoProfSel, asisProfSel, gestionProfSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccionar profesor</option>';
    });

    const profesoresActivos = profesores.filter((p) => p.estado == 1 || p.estado === true);

    profesoresActivos.forEach((p) => {
      const id = p.id_profesor ?? p.id;
      const opt = new Option(`${p.nombre} ${p.apellido1} (${p.materia || 'General'})`, id);
      opt.dataset.busqueda = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''} ${p.materia ?? ''}`.toLowerCase();
      if (grupoProfSel) grupoProfSel.add(opt.cloneNode(true));
      if (asisProfSel) asisProfSel.add(opt.cloneNode(true));
      if (gestionProfSel) gestionProfSel.add(opt.cloneNode(true));
    });

    filtrarProfesoresGrupo(document.getElementById('grupo-profesor-search')?.value || '');
    filtrarProfesoresGestion(document.getElementById('gestion-profesor-search')?.value || '');
    if (isGestion) {
      await cargarDetalleGestionGrupo(Number(document.getElementById('gestion-grupo-select')?.value || 0));
    }
  } catch (error) {
    console.error('Error poblando profesores', error);
  }
}

function filtrarProfesoresGrupo(termino) {
  const select = document.getElementById('grupo-profesor');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });
}

function filtrarProfesoresGestion(termino) {
  const select = document.getElementById('gestion-grupo-profesor');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });
}

/* ==========================================
   ASIGNAR GRUPOS A UN PROFESOR (desde su ficha)
   Un profesor puede quedar marcado en varios grupos.
   Si quieres que un grupo tenga Español, Matemáticas y
   Ciencias cubiertas, repite este flujo con cada profesor
   y marca el mismo grupo en los tres: grupo_profesor admite
   varios profesores por grupo, uno por cada materia.
   ========================================== */

let profesorGruposActualesIds = [];

async function abrirModalAsignarGrupos(idProf, nombreProf, materiaProf) {
  const nombreEl = document.getElementById('asignar-grupos-nombre-profesor');
  if (nombreEl) nombreEl.textContent = nombreProf || '';
  const materiaEl = document.getElementById('asignar-grupos-materia');
  if (materiaEl) materiaEl.textContent = materiaProf || 'su materia';

  const btnConfirmar = document.getElementById('confirmar-asignar-grupos-btn');
  if (btnConfirmar) btnConfirmar.dataset.idProf = idProf;

  const modalEl = document.getElementById('modalAsignarGrupos');
  if (modalEl) new bootstrap.Modal(modalEl).show();

  const lista = document.getElementById('asignar-grupos-lista');
  if (lista) lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">Cargando grupos...</p>';

  const searchInput = document.getElementById('asignar-grupos-search');
  if (searchInput) searchInput.value = '';

  const profesor = allProfesores.find((p) => String(p.id_profesor ?? p.id) === String(idProf));
  profesorGruposActualesIds = (profesor?.grupos_ids || '')
    .split(',')
    .map((v) => parseInt(v, 10))
    .filter((v) => !isNaN(v));

  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) throw new Error('No se pudieron cargar los grupos.');
    const grupos = await res.json();
    renderChecklistGrupos(grupos);
  } catch (error) {
    if (lista) lista.innerHTML = `<p class="text-danger text-center py-3 mb-0">${error.message || 'Error al cargar los grupos.'}</p>`;
  }
}

function renderChecklistGrupos(grupos) {
  const lista = document.getElementById('asignar-grupos-lista');
  if (!lista) return;

  if (!grupos.length) {
    lista.innerHTML = '<p class="text-muted text-center py-3 mb-0">No hay grupos creados todavía. Crea uno desde Matrícula.</p>';
    return;
  }

  lista.innerHTML = grupos.map((g) => {
    const id = g.id_grupo ?? g.id;
    const checked = profesorGruposActualesIds.includes(Number(id)) ? 'checked' : '';
    const etiqueta = `${g.nombre_grupo ?? 'Grupo'} · ${g.nombre_seccion || g.nivel || ''} · Cupo ${g.ocupados ?? 0}/${g.capacidad ?? 0}`;
    const busqueda = `${g.nombre_grupo ?? ''} ${g.nombre_seccion ?? ''} ${g.nivel ?? ''}`.toLowerCase();
    return `
      <label class="form-check d-flex align-items-center gap-2 border rounded-3 p-2 mb-0 asignar-grupo-item" data-busqueda="${busqueda}">
        <input class="form-check-input mt-0 asignar-grupo-checkbox" type="checkbox" value="${id}" ${checked}>
        <span class="small">${etiqueta}</span>
      </label>
    `;
  }).join('');
}

function filtrarChecklistGrupos(termino) {
  const busqueda = (termino || '').trim().toLowerCase();
  document.querySelectorAll('#asignar-grupos-lista .asignar-grupo-item').forEach((item) => {
    const texto = item.dataset.busqueda || '';
    item.classList.toggle('hidden', !!busqueda && !texto.includes(busqueda));
  });
}

async function guardarAsignacionGrupos(idProf) {
  const seleccionados = Array.from(
    document.querySelectorAll('#asignar-grupos-lista .asignar-grupo-checkbox:checked')
  ).map((el) => parseInt(el.value, 10));

  const btnConfirmar = document.getElementById('confirmar-asignar-grupos-btn');
  if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch(`/api/profesores/${idProf}/grupos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grupos: seleccionados })
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Grupos del profesor actualizados correctamente.', 'success');
      const modalEl = document.getElementById('modalAsignarGrupos');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await loadProfesores();
    } else {
      showToast(json.error || 'No se pudo actualizar la asignación de grupos.', 'error');
    }
  } catch {
    showToast('Error de conexión al asignar los grupos.', 'error');
  } finally {
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar asignación'; }
  }
}

(function () {
  const moduleName = 'matricula';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireMatriculaEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE MATRÍCULA
   Matrícula de estudiantes, grupos y secciones académicas.
   ========================================== */

let allGrupos = [];

function wireMatriculaEvents() {
  const matForm = document.getElementById('matricula-form');
  if (matForm && !matForm.dataset.wired) {
    matForm.dataset.wired = '1';
    matForm.addEventListener('submit', handleMatriculaSubmit);
  }

  const grupoForm = document.getElementById('grupo-form');
  if (grupoForm && !grupoForm.dataset.wired) {
    grupoForm.dataset.wired = '1';
    grupoForm.addEventListener('submit', handleGrupoSubmit);
  }

  const gestionGrupoForm = document.getElementById('gestion-grupo-form');
  if (gestionGrupoForm && !gestionGrupoForm.dataset.wired) {
    gestionGrupoForm.dataset.wired = '1';
    gestionGrupoForm.addEventListener('submit', handleGestionGrupoSubmit);
  }

  const btnBorrarGrupo = document.getElementById('btn-borrar-grupo');
  if (btnBorrarGrupo && !btnBorrarGrupo.dataset.wired) {
    btnBorrarGrupo.dataset.wired = '1';
    btnBorrarGrupo.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const rawValue = document.getElementById('gestion-grupo-select')?.value;
      if (!rawValue) {
        showToast('Selecciona un grupo para borrar.', 'error');
        return;
      }

      const idGrupo = String(rawValue).split(':')[0].trim();

      if (!idGrupo || isNaN(idGrupo)) {
        showToast('ID de grupo inválido.', 'error');
        return;
      }

      const confirmarModalEl = document.getElementById('modalConfirmarEliminacion');
      if (confirmarModalEl) {
        const btnConfirmarAccion = document.getElementById('btn-confirmar-borrado-grupo');
        if (btnConfirmarAccion) btnConfirmarAccion.dataset.idGrupo = idGrupo;
        
        const modalConfirm = new bootstrap.Modal(confirmarModalEl);
        modalConfirm.show();
      }
    });
  }

  const btnConfirmarBorradoGrupo = document.getElementById('btn-confirmar-borrado-grupo');
  if (btnConfirmarBorradoGrupo && !btnConfirmarBorradoGrupo.dataset.wired) {
    btnConfirmarBorradoGrupo.dataset.wired = '1';
    btnConfirmarBorradoGrupo.addEventListener('click', async () => {
      const idGrupo = btnConfirmarBorradoGrupo.dataset.idGrupo;
      if (!idGrupo) return;

      const confirmarModalEl = document.getElementById('modalConfirmarEliminacion');
      if (confirmarModalEl) bootstrap.Modal.getInstance(confirmarModalEl)?.hide();

      await borrarGrupo(idGrupo);
    });
  }

  const gestionGrupoBtn = document.querySelector('[data-bs-target="#modalGestionGrupo"]');
  if (gestionGrupoBtn && !gestionGrupoBtn.dataset.wired) {
    gestionGrupoBtn.dataset.wired = '1';
    gestionGrupoBtn.addEventListener('click', async () => {
      await populateGestionGrupoModal();
      await populateProfesoresSelects(true);
    });
  }

  const gestionProfSearch = document.getElementById('gestion-profesor-search');
  if (gestionProfSearch && !gestionProfSearch.dataset.wired) {
    gestionProfSearch.dataset.wired = '1';
    gestionProfSearch.addEventListener('input', () => {
      filtrarProfesoresGestion(gestionProfSearch.value);
    });
  }

  const gestionGrupoSelect = document.getElementById('gestion-grupo-select');
  if (gestionGrupoSelect && !gestionGrupoSelect.dataset.wired) {
    gestionGrupoSelect.dataset.wired = '1';
    gestionGrupoSelect.addEventListener('change', async () => {
      const rawValue = gestionGrupoSelect.value;
      const cleanId = String(rawValue).split(':')[0].trim();
      await cargarDetalleGestionGrupo(Number(cleanId));
    });
  }

  const grupoSeccionSearch = document.getElementById('grupo-seccion-search');
  if (grupoSeccionSearch && !grupoSeccionSearch.dataset.wired) {
    grupoSeccionSearch.dataset.wired = '1';
    grupoSeccionSearch.addEventListener('input', () => {
      filtrarSeccionesGrupo(grupoSeccionSearch.value);
    });
  }

  const seccionForm = document.getElementById('seccion-form');
  if (seccionForm && !seccionForm.dataset.wired) {
    seccionForm.dataset.wired = '1';
    seccionForm.addEventListener('submit', handleSeccionSubmit);
  }

  const btnBorrarSeccion = document.getElementById('btn-borrar-seccion');
  if (btnBorrarSeccion && !btnBorrarSeccion.dataset.wired) {
    btnBorrarSeccion.dataset.wired = '1';
    btnBorrarSeccion.addEventListener('click', async (e) => {
      e.preventDefault();
      const idSeccion = document.getElementById('seccion-delete-select')?.value;
      if (!idSeccion) {
        showToast('Selecciona una sección para borrar.', 'error');
        return;
      }
      
      const confirmarModalEl = document.getElementById('modalConfirmarEliminacionSeccion');
      if (confirmarModalEl) {
        const btnConfSec = document.getElementById('btn-confirmar-borrado-seccion');
        if (btnConfSec) btnConfSec.dataset.idSeccion = idSeccion;
        new bootstrap.Modal(confirmarModalEl).show();
      }
    });
  }

  const btnConfirmarBorradoSeccion = document.getElementById('btn-confirmar-borrado-seccion');
  if (btnConfirmarBorradoSeccion && !btnConfirmarBorradoSeccion.dataset.wired) {
    btnConfirmarBorradoSeccion.dataset.wired = '1';
    btnConfirmarBorradoSeccion.addEventListener('click', async () => {
      const idSeccion = btnConfirmarBorradoSeccion.dataset.idSeccion;
      if (!idSeccion) return;
      const modalEl = document.getElementById('modalConfirmarEliminacionSeccion');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await borrarSeccion(idSeccion);
    });
  }

  setDefaultSeccionPeriodo();

  const hoyISO = new Date().toISOString().split('T')[0];
  const matFechaInput = document.getElementById('mat-fecha');
  if (matFechaInput) matFechaInput.max = hoyISO;

  const btnAbrirModalGrupo = document.querySelector('[data-bs-target="#modalGrupo"]');
  if (btnAbrirModalGrupo && !btnAbrirModalGrupo.dataset.wired) {
    btnAbrirModalGrupo.dataset.wired = '1';
    btnAbrirModalGrupo.addEventListener('click', () => {
      populateSeccionesSelect();
    });
  }

  const btnAbrirModalMatricula = document.querySelector('[data-bs-target="#modalMatricula"]');
  if (btnAbrirModalMatricula && !btnAbrirModalMatricula.dataset.wired) {
    btnAbrirModalMatricula.dataset.wired = '1';
    btnAbrirModalMatricula.addEventListener('click', () => {
      populatePersonaSelects();
      populateGruposSelects();
    });
  }

  const modalMatriculaEl = document.getElementById('modalMatricula');
  if (modalMatriculaEl && !modalMatriculaEl.dataset.wired) {
    modalMatriculaEl.dataset.wired = '1';
    modalMatriculaEl.addEventListener('show.bs.modal', () => {
      const fechaInput = document.getElementById('mat-fecha');
      if (fechaInput && !fechaInput.value) {
        fechaInput.value = new Date().toISOString().split('T')[0];
      }
      actualizarInfoCupoGrupo();
    });
  }

  const matGrupoSel = document.getElementById('mat-id-grupo');
  if (matGrupoSel && !matGrupoSel.dataset.wired) {
    matGrupoSel.dataset.wired = '1';
    matGrupoSel.addEventListener('change', actualizarInfoCupoGrupo);
  }

  const matGrupoSearch = document.getElementById('mat-grupo-search');
  if (matGrupoSearch && !matGrupoSearch.dataset.wired) {
    matGrupoSearch.dataset.wired = '1';
    matGrupoSearch.addEventListener('input', () => {
      filtrarGruposMatricula(matGrupoSearch.value);
    });
  }

  const btnAbrirGestionMatricula = document.querySelector('[data-bs-target="#modalGestionMatricula"]');
  if (btnAbrirGestionMatricula && !btnAbrirGestionMatricula.dataset.wired) {
    btnAbrirGestionMatricula.dataset.wired = '1';
    btnAbrirGestionMatricula.addEventListener('click', () => {
      poblarSelectGruposGestionMatricula();
    });
  }

  const gmGrupoActual = document.getElementById('gm-grupo-actual');
  if (gmGrupoActual && !gmGrupoActual.dataset.wired) {
    gmGrupoActual.dataset.wired = '1';
    gmGrupoActual.addEventListener('change', cargarEstudiantesGestionMatricula);
  }

  const gmAccion = document.getElementById('gm-accion');
  if (gmAccion && !gmAccion.dataset.wired) {
    gmAccion.dataset.wired = '1';
    gmAccion.addEventListener('change', actualizarCamposGestionMatricula);
  }

  const gestionMatriculaForm = document.getElementById('gestion-matricula-form');
  if (gestionMatriculaForm && !gestionMatriculaForm.dataset.wired) {
    gestionMatriculaForm.dataset.wired = '1';
    gestionMatriculaForm.addEventListener('submit', handleGestionMatriculaSubmit);
  }
}

function poblarSelectGruposGestionMatricula() {
  const selActual = document.getElementById('gm-grupo-actual');
  const selNuevo = document.getElementById('gm-grupo-nuevo');
  const estudianteSel = document.getElementById('gm-estudiante');
  const hint = document.getElementById('gm-hint');
  const fechaInput = document.getElementById('gm-fecha');

  if (selActual) {
    selActual.innerHTML = '<option value="" disabled selected>Seleccionar grupo</option>';
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      selActual.add(new Option(`${g.nombre_grupo ?? 'Grupo'} · ${g.nivel ?? ''}`, id));
    });
  }

  if (selNuevo) {
    selNuevo.innerHTML = '<option value="" disabled selected>Seleccionar grupo destino</option>';
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const ocupados = g.ocupados ?? 0;
      const capacidad = g.capacidad ?? 0;
      const lleno = ocupados >= capacidad;
      const opt = new Option(`${g.nombre_grupo ?? 'Grupo'} · Cupo ${ocupados}/${capacidad}${lleno ? ' (LLENO)' : ''}`, id);
      opt.disabled = lleno;
      selNuevo.add(opt);
    });
  }

  if (estudianteSel) {
    estudianteSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    estudianteSel.disabled = true;
  }

  if (hint) {
    hint.textContent = 'Selecciona un grupo para ver a sus estudiantes.';
    hint.classList.remove('text-danger');
  }

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = new Date().toISOString().split('T')[0];
  }

  actualizarCamposGestionMatricula();
}

async function cargarEstudiantesGestionMatricula() {
  const grupoSel = document.getElementById('gm-grupo-actual');
  const estudianteSel = document.getElementById('gm-estudiante');
  const hint = document.getElementById('gm-hint');
  const selNuevo = document.getElementById('gm-grupo-nuevo');
  if (!grupoSel || !estudianteSel) return;

  const idGrupo = parseInt(grupoSel.value, 10);
  if (!idGrupo || isNaN(idGrupo)) return;

  estudianteSel.innerHTML = '<option value="" disabled selected>Cargando estudiantes...</option>';
  estudianteSel.disabled = true;

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el detalle del grupo');
    const detalle = await res.json();
    const estudiantes = detalle.estudiantes || [];

    estudianteSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
    estudiantes.forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      estudianteSel.add(new Option(texto, e.id_estudiante));
    });
    estudianteSel.disabled = estudiantes.length === 0;

    if (hint) {
      if (estudiantes.length === 0) {
        hint.textContent = 'Este grupo no tiene estudiantes matriculados activos.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = `Se cargaron ${estudiantes.length} estudiante(s).`;
        hint.classList.remove('text-danger');
      }
    }

    if (selNuevo) {
      Array.from(selNuevo.options).forEach((opt) => {
        if (opt.value === '') return;
        opt.hidden = Number(opt.value) === idGrupo;
      });
    }
  } catch (error) {
    console.error('Error cargando estudiantes para gestión de matrícula', error);
    estudianteSel.innerHTML = '<option value="" disabled selected>Error al cargar estudiantes</option>';
  }
}

function actualizarCamposGestionMatricula() {
  const accion = document.getElementById('gm-accion')?.value;
  const camposTransferir = document.getElementById('gm-campos-transferir');
  const grupoNuevoSel = document.getElementById('gm-grupo-nuevo');
  if (!camposTransferir) return;

  const esTransferir = accion === 'transferir';
  camposTransferir.classList.toggle('hidden', !esTransferir);
  if (grupoNuevoSel) grupoNuevoSel.required = esTransferir;
}

async function handleGestionMatriculaSubmit(e) {
  e.preventDefault();

  const idGrupoActual = parseInt(document.getElementById('gm-grupo-actual')?.value, 10);
  const idEstudiante = parseInt(document.getElementById('gm-estudiante')?.value, 10);
  const accion = document.getElementById('gm-accion')?.value;

  if (!idGrupoActual || !idEstudiante) {
    showToast('Selecciona el grupo actual y el estudiante.', 'error');
    return;
  }

  const submitBtn = document.getElementById('gm-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    let res;

    if (accion === 'retirar') {
      res = await apiFetch(`/api/procesos/grupos/${idGrupoActual}/retirar-estudiante`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_estudiante: idEstudiante })
      });
    } else {
      const idGrupoNuevo = parseInt(document.getElementById('gm-grupo-nuevo')?.value, 10);
      if (!idGrupoNuevo) {
        showToast('Selecciona el grupo destino.', 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Guardar cambios'; }
        return;
      }

      const grupoDestino = allGrupos.find((g) => (g.id_grupo ?? g.id) === idGrupoNuevo);
      const fecha = document.getElementById('gm-fecha')?.value || new Date().toISOString().split('T')[0];
      const anio = grupoDestino?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

      const payload = {
        id_estudiante: idEstudiante,
        id_grupo_actual: idGrupoActual,
        id_grupo_nuevo: idGrupoNuevo,
        fecha,
        periodo: parseInt(document.getElementById('gm-periodo')?.value, 10),
        anio,
        tipo: document.getElementById('gm-tipo')?.value || 'traslado',
        estado: 'activa',
        observaciones: document.getElementById('gm-observaciones')?.value.trim().slice(0, 20) || null,
        id_usuario: currentUser?.id_usuario ?? 1
      };

      res = await apiFetch('/api/procesos/matricula/transferir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast(
        accion === 'retirar' ? 'Estudiante retirado del grupo correctamente.' : 'Estudiante transferido correctamente.',
        'success'
      );
      document.getElementById('gestion-matricula-form')?.reset();
      const modalEl = document.getElementById('modalGestionMatricula');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      await populateGruposSelects();
    } else {
      showToast(json.mensaje || json.error || 'No se pudo completar la operación.', 'error');
    }
  } catch (error) {
    console.error('Error en gestión de matrícula', error);
    showToast('Error de conexión al gestionar la matrícula.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Guardar cambios'; }
  }
}

async function loadMatriculaData() {
  await Promise.all([
    populatePersonaSelects(),
    populateGruposSelects(),
    populateProfesoresSelects(),
    populateSeccionesSelect()
  ]);
}

function setDefaultSeccionPeriodo() {
  const input = document.getElementById('seccion-periodo');
  if (input && !input.value) input.value = new Date().getFullYear();
}

async function populatePersonaSelects() {
  try {
    const res = await apiFetch('/api/estudiantes');
    if (!res.ok) return;
    const estudiantes = await res.json();
    const matSel = document.getElementById('mat-persona');

    if (matSel) {
      matSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
      estudiantes.forEach((p) => {
        const id = p.id_estudiante ?? p.id;
        const nombreCompleto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
        matSel.add(new Option(nombreCompleto, id));
      });
    }
  } catch (error) {
    console.error('Error poblando estudiantes', error);
  }
}

async function populateGruposSelects() {
  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) return;
    const grupos = await res.json();
    allGrupos = grupos;
    const matGrupoSel = document.getElementById('mat-id-grupo');
    const asisGrupoSel = document.getElementById('asis-id-grupo');

    [matGrupoSel, asisGrupoSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccionar grupo destino</option>';
    });

    grupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const ocupados = g.ocupados ?? 0;
      const capacidad = g.capacidad ?? 0;
      const lleno = ocupados >= capacidad;
      const etiqueta = `${g.nombre_grupo ?? 'Grupo'} · ${g.nivel ?? ''} — Ocupados: ${ocupados}/${capacidad}${lleno ? ' (CUPO LLENO)' : ''}`;

      if (matGrupoSel) {
        const optMat = new Option(etiqueta, id);
        optMat.dataset.nombre = (g.nombre_grupo ?? '').toLowerCase();
        optMat.disabled = lleno;
        matGrupoSel.add(optMat);
      }
      if (asisGrupoSel) {
        asisGrupoSel.add(new Option(etiqueta, id));
      }
    });

    actualizarInfoCupoGrupo();
    filtrarGruposMatricula(document.getElementById('mat-grupo-search')?.value || '');
  } catch (error) {
    console.error('Error poblando grupos', error);
  }
}

function filtrarGruposMatricula(termino) {
  const select = document.getElementById('mat-id-grupo');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    if (option.value === '') return;
    const nombre = (option.dataset.nombre || option.textContent || '').toLowerCase();
    const coincide = !busqueda || nombre.includes(busqueda);
    option.hidden = !coincide;
  });

  const primerVisible = Array.from(select.options).find((option) => !option.hidden && option.value !== '');
  if (primerVisible) {
    select.value = primerVisible.value;
    actualizarInfoCupoGrupo();
  }
}

async function borrarGrupo(idGrupo) {
  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.mensaje || json.error || 'No se pudo borrar el grupo.', 'error');
      return;
    }

    showToast('Grupo eliminado correctamente.', 'success');
    
    allGrupos = allGrupos.filter(g => String(g.id_grupo ?? g.id) !== String(idGrupo));

    const modalEl = document.getElementById('modalGestionGrupo');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

    document.getElementById('gestion-grupo-form')?.reset();
    
    await populateGruposSelects();
    await populateGestionGrupoModal();
  } catch (error) {
    console.error('Error al borrar grupo', error);
    showToast('Error al borrar el grupo.', 'error');
  }
}

async function actualizarInfoCupoGrupo() {
  const sel = document.getElementById('mat-id-grupo');
  const info = document.getElementById('mat-grupo-info');
  if (!sel || !info) return;

  const idSeleccionado = parseInt(sel.value, 10);
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === idSeleccionado);

  if (!grupo) {
    info.textContent = 'Selecciona un grupo para ver el cupo disponible.';
    info.classList.remove('text-danger');
    return;
  }

  const ocupados = grupo.ocupados ?? 0;
  const capacidad = grupo.capacidad ?? 0;
  const disponibles = capacidad - ocupados;

  if (disponibles <= 0) {
    info.textContent = `Este grupo ya no tiene cupo disponible (${ocupados}/${capacidad}).`;
    info.classList.add('text-danger');
  } else {
    info.textContent = `Cupo disponible: ${disponibles} de ${capacidad} · Año lectivo: ${grupo.periodo_lectivo ?? '—'}.`;
    info.classList.remove('text-danger');
  }
}

async function populateSeccionesSelect() {
  try {
    const res = await apiFetch('/api/procesos/secciones');
    if (!res.ok) return [];
    const secciones = await res.json();
    const sel = document.getElementById('grupo-seccion');
    const deleteSel = document.getElementById('seccion-delete-select');
    const hint = document.getElementById('grupo-seccion-empty-hint');

    if (sel) {
      sel.innerHTML = '<option value="" disabled selected>Seleccionar sección</option>';
      secciones.forEach((s) => {
        const etiqueta = `${s.nombre} — ${s.nivel} (${s.anio_lectivo})`;
        const option = new Option(etiqueta, s.id_seccion);
        option.dataset.busqueda = `${s.nombre ?? ''} ${s.nivel ?? ''} ${s.anio_lectivo ?? ''}`.toLowerCase();
        sel.add(option);
      });
    }
    if (deleteSel) {
      deleteSel.innerHTML = '<option value="" disabled selected>Seleccionar sección</option>';
      secciones.forEach((s) => {
        const etiqueta = `${s.nombre} — ${s.nivel} (${s.anio_lectivo})`;
        deleteSel.add(new Option(etiqueta, s.id_seccion));
      });
    }
    if (hint) hint.classList.toggle('hidden', secciones.length > 0);
    return secciones;
  } catch (error) {
    console.error('Error poblando secciones', error);
    return [];
  }
}

function filtrarSeccionesGrupo(termino) {
  const select = document.getElementById('grupo-seccion');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });

  // Si la opción actualmente seleccionada quedó oculta por el filtro (o no había
  // ninguna seleccionada todavía), forzamos la selección a la primera visible.
  // Sin esto, el <select> puede "verse" seleccionado visualmente en algunos
  // navegadores mientras su .value real sigue vacío, y el backend rechaza
  // la creación del grupo con "Debe seleccionar una sección académica."
  const seleccionActual = select.options[select.selectedIndex];
  const seleccionValida = seleccionActual && seleccionActual.value !== '' && !seleccionActual.hidden;

  if (!seleccionValida) {
    const primerVisible = Array.from(select.options).find((option) => !option.hidden && option.value !== '');
    if (primerVisible) {
      select.value = primerVisible.value;
    }
  }
}

async function borrarSeccion(idSeccion) {
  try {
    const res = await apiFetch(`/api/procesos/secciones/${idSeccion}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.mensaje || json.error || 'No se pudo borrar la sección.', 'error');
      return;
    }

    showToast('Sección eliminada correctamente.', 'success');
    document.getElementById('seccion-form')?.reset();
    setDefaultSeccionPeriodo();
    await populateSeccionesSelect();
  } catch (error) {
    console.error('Error al borrar sección', error);
    showToast('Error al borrar la sección.', 'error');
  }
}

async function populateGestionGrupoModal() {
  const select = document.getElementById('gestion-grupo-select');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Seleccionar grupo</option>';
  allGrupos.forEach((grupo) => {
    const nombre = `${grupo.nombre_grupo} · ${grupo.nombre_seccion || grupo.id_seccion} · Cupo ${grupo.ocupados ?? 0}/${grupo.capacidad ?? 0}`;
    select.add(new Option(nombre, grupo.id_grupo));
  });
}

async function cargarDetalleGestionGrupo(idGrupo) {
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === Number(idGrupo));
  const capacidadInput = document.getElementById('gestion-grupo-capacidad');
  const aulaSelect = document.getElementById('gestion-grupo-aula');
  const profSelect = document.getElementById('gestion-grupo-profesor');

  if (!grupo || !capacidadInput || !aulaSelect || !profSelect) return;

  capacidadInput.value = grupo.capacidad ?? 30;
  aulaSelect.value = grupo.aula ?? '';

  try {
    const res = await apiFetch(`/api/procesos/grupos/${grupo.id_grupo}/detalle`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    if (Array.isArray(json.profesores) && json.profesores.length > 0) {
      const selectedIds = json.profesores.map(p => String(p.id_profesor));
      Array.from(profSelect.options).forEach(opt => {
        opt.selected = selectedIds.includes(String(opt.value));
      });
    }
  } catch (error) {
    console.error('Error cargando detalle del grupo', error);
  }
}

async function handleGestionGrupoSubmit(e) {
  e.preventDefault();

  const rawGrupoVal = document.getElementById('gestion-grupo-select')?.value || 0;
  const idGrupo = Number(String(rawGrupoVal).split(':')[0].trim());
  const capacidad = Number(document.getElementById('gestion-grupo-capacidad')?.value || 0);
  const aula = document.getElementById('gestion-grupo-aula')?.value.trim() || null;
  
  const profSelect = document.getElementById('gestion-grupo-profesor');
  const profesoresSeleccionados = Array.from(profSelect?.selectedOptions || []).map(opt => parseInt(opt.value, 10));

  if (!idGrupo || !capacidad) {
    showToast('Selecciona un grupo y capacidad.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacidad, aula, profesores: profesoresSeleccionados })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo actualizar el grupo.', 'error');
      return;
    }

    showToast('Grupo actualizado correctamente.', 'success');
    document.getElementById('gestion-grupo-form')?.reset();
    await populateGruposSelects();
    await populateGestionGrupoModal();
    await populateProfesoresSelects(true);
  } catch (error) {
    console.error('Error actualizando grupo', error);
    showToast('Error al actualizar el grupo.', 'error');
  }
}

async function handleMatriculaSubmit(e) {
  e.preventDefault();
  const personaSelect = document.getElementById('mat-persona');
  const grupoSelect = document.getElementById('mat-id-grupo');

  if (!personaSelect.value || !grupoSelect.value) {
    showToast('Selecciona un estudiante y un grupo destino.', 'error');
    return;
  }

  const personaId = parseInt(personaSelect.value, 10);
  const id_grupo = parseInt(String(grupoSelect.value).split(':')[0].trim(), 10);
  const grupoSeleccionado = allGrupos.find((g) => (g.id_grupo ?? g.id) === id_grupo);

  const fechaInput = document.getElementById('mat-fecha').value;
  const fecha = fechaInput || new Date().toISOString().split('T')[0];

  const anio = grupoSeleccionado?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

  const payload = {
    fecha,
    periodo: parseInt(document.getElementById('mat-periodo').value, 10),
    anio,
    tipo: document.getElementById('mat-tipo').value,
    estado: 'activa',
    observaciones: document.getElementById('mat-observaciones').value.trim().slice(0, 20) || null,
    id_estudiante: personaId,
    id_usuario: currentUser?.id_usuario ?? 1,
    id_grupo: id_grupo
  };

  const submitBtn = document.getElementById('mat-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...'; }

  try {
    const res = await apiFetch('/api/procesos/matricula', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('¡Matrícula definitiva completada y cupo actualizado correctamente!', 'success');
      const modalEl = document.getElementById('modalMatricula');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('matricula-form').reset();
      
      await populateGruposSelects();
      await populatePersonaSelects();
      await refreshDashboardCounts();
    } else {
      showToast(json.error || json.mensaje || 'Error al procesar la matrícula', 'error');
    }
  } catch {
    showToast('Error de conexión al matricular', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Completar Matrícula'; }
  }
}

async function handleGrupoSubmit(e) {
  e.preventDefault();

  const nombre = document.getElementById('grupo-nombre').value.trim();
  const capacidad = parseInt(document.getElementById('grupo-capacidad').value, 10);
  const idSeccion = parseInt(document.getElementById('grupo-seccion').value, 10);
  const aula = document.getElementById('grupo-aula').value.trim() || null;

  // Validación previa en el frontend: si algo no es válido, avisamos exactamente
  // qué falta en vez de mandar la petición y dejar que el 400 del servidor
  // se pierda en un toast que desaparece solo.
  if (!nombre) {
    showToast('Escribe un nombre para el grupo.', 'error');
    return;
  }
  if (!Number.isInteger(capacidad) || capacidad <= 0) {
    showToast('La capacidad máxima debe ser un número mayor a cero.', 'error');
    return;
  }
  if (!Number.isInteger(idSeccion) || idSeccion <= 0) {
    showToast('Selecciona una sección académica válida de la lista (haz clic en una opción del desplegable).', 'error');
    return;
  }

  // El grupo se crea sin profesores: la asignación docente se hace después
  // desde "Gestionar Grupo" o desde el módulo de Profesores (botón "Grupos").
  const payload = { nombre_grupo: nombre, capacidad, aula, id_seccion: idSeccion };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creando...'; }

  try {
    const res = await apiFetch('/api/procesos/grupos', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Grupo creado correctamente');
      const modalEl = document.getElementById('modalGrupo');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('grupo-form').reset();
      await populateGruposSelects();
    } else {
      const mensaje = json.error || json.mensaje || 'Error creando grupo';
      if (typeof showResultModal === 'function') {
        showResultModal('error', 'No se pudo crear el grupo', mensaje);
      } else {
        showToast(mensaje, 'error');
      }
    }
  } catch {
    showToast('Error de conexión al crear el grupo', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Crear Grupo'; }
  }
}

async function handleSeccionSubmit(e) {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('seccion-nombre').value.trim(),
    nivel: document.getElementById('seccion-nivel').value.trim(),
    anio_lectivo: parseInt(document.getElementById('seccion-periodo').value, 10),
    descripcion: document.getElementById('seccion-descripcion').value.trim()
  };

  try {
    const res = await apiFetch('/api/procesos/secciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Sección creada correctamente');
      const modalEl = document.getElementById('modalSeccion');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('seccion-form').reset();
      setDefaultSeccionPeriodo();

      await populateSeccionesSelect();
      if (json.id_seccion) {
        const sel = document.getElementById('grupo-seccion');
        if (sel) sel.value = json.id_seccion;
      }
    } else {
      showToast(json.error || json.mensaje || 'Error creando sección', 'error');
    }
  } catch {
    showToast('Error creando sección', 'error');
  }
}

(function () {
  const moduleName = 'asistencia';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireAsistenciaEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE ASISTENCIA 
   ========================================== */

let asistenciaChartInstance = null;

function wireAsistenciaEvents() {
  const asisForm = document.getElementById('asistencia-form');
  if (asisForm && !asisForm.dataset.wired) {
    asisForm.dataset.wired = '1';
    asisForm.addEventListener('submit', handleAsistenciaSubmit);
  }

  const modForm = document.getElementById('modificar-asistencia-form');
  if (modForm && !modForm.dataset.wired) {
    modForm.dataset.wired = '1';
    modForm.addEventListener('submit', handleModificarAsistenciaSubmit);
  }

  const asisGrupoSelEl = document.getElementById('asis-id-grupo');
  if (asisGrupoSelEl && !asisGrupoSelEl.dataset.wired) {
    asisGrupoSelEl.dataset.wired = '1';
    asisGrupoSelEl.addEventListener('change', () => {
      cargarRosterGrupoAsistencia();
    });
  }

  // --- Filtros del historial en cascada ---
  const histGrupoSel = document.getElementById('hist-filtro-grupo');
  if (histGrupoSel && !histGrupoSel.dataset.wired) {
    histGrupoSel.dataset.wired = '1';
    histGrupoSel.addEventListener('change', async () => {
      await poblarFiltroEstudiantesHistorial(histGrupoSel.value);
      cargarHistorialAsistencia();
    });
  }

  const histEstudianteSel = document.getElementById('hist-filtro-estudiante');
  if (histEstudianteSel && !histEstudianteSel.dataset.wired) {
    histEstudianteSel.dataset.wired = '1';
    histEstudianteSel.addEventListener('change', cargarHistorialAsistencia);
  }

  // NUEVO: filtro de Materia/Curso
  const histMateriaSel = document.getElementById('hist-filtro-materia');
  if (histMateriaSel && !histMateriaSel.dataset.wired) {
    histMateriaSel.dataset.wired = '1';
    histMateriaSel.addEventListener('change', cargarHistorialAsistencia);
  }

  const histEstadoSel = document.getElementById('hist-filtro-estado');
  if (histEstadoSel && !histEstadoSel.dataset.wired) {
    histEstadoSel.dataset.wired = '1';
    histEstadoSel.addEventListener('change', cargarHistorialAsistencia);
  }

  const histDesde = document.getElementById('hist-filtro-fecha-desde');
  if (histDesde && !histDesde.dataset.wired) {
    histDesde.dataset.wired = '1';
    histDesde.addEventListener('change', cargarHistorialAsistencia);
  }

  const histHasta = document.getElementById('hist-filtro-fecha-hasta');
  if (histHasta && !histHasta.dataset.wired) {
    histHasta.dataset.wired = '1';
    histHasta.addEventListener('change', cargarHistorialAsistencia);
  }

  const histBusqueda = document.getElementById('hist-filtro-busqueda');
  if (histBusqueda && !histBusqueda.dataset.wired) {
    histBusqueda.dataset.wired = '1';
    let debounceTimer = null;
    histBusqueda.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(cargarHistorialAsistencia, 350);
    });
  }

  const histLimpiar = document.getElementById('hist-limpiar-filtros');
  if (histLimpiar && !histLimpiar.dataset.wired) {
    histLimpiar.dataset.wired = '1';
    histLimpiar.addEventListener('click', async () => {
      if (histGrupoSel) histGrupoSel.value = '';
      await poblarFiltroEstudiantesHistorial('');
      if (histEstudianteSel) histEstudianteSel.value = '';
      if (histMateriaSel) histMateriaSel.value = '';
      if (histEstadoSel) histEstadoSel.value = '';
      if (histDesde) histDesde.value = '';
      if (histHasta) histHasta.value = '';
      if (histBusqueda) histBusqueda.value = '';
      cargarHistorialAsistencia();
    });
  }

  const histRefrescar = document.getElementById('hist-refrescar');
  if (histRefrescar && !histRefrescar.dataset.wired) {
    histRefrescar.dataset.wired = '1';
    histRefrescar.addEventListener('click', cargarHistorialAsistencia);
  }

  const hoyISO = new Date().toISOString().split('T')[0];
  const asisFechaInput = document.getElementById('asis-fecha');
  if (asisFechaInput) { asisFechaInput.max = hoyISO; if (!asisFechaInput.value) asisFechaInput.value = hoyISO; }

  // Asegurar que al abrir el modal de asistencia se recarguen los grupos correctamente y se cargue el roster si ya hay uno seleccionado
  const modalRegistrarAsistenciaEl = document.getElementById('modalRegistrarAsistencia');
  if (modalRegistrarAsistenciaEl && !modalRegistrarAsistenciaEl.dataset.wired) {
    modalRegistrarAsistenciaEl.dataset.wired = '1';
    modalRegistrarAsistenciaEl.addEventListener('show.bs.modal', async () => {
      if (typeof populateGruposSelects === 'function') {
        await populateGruposSelects();
      }
      const grupoSel = document.getElementById('asis-id-grupo');
      if (grupoSel && grupoSel.value) {
        await cargarRosterGrupoAsistencia();
      } else if (grupoSel && grupoSel.options.length > 1) {
        grupoSel.value = grupoSel.options[1].value;
        await cargarRosterGrupoAsistencia();
      }
    });
  }
}

async function loadAsistenciaData() {
  if (typeof populateGruposSelects === 'function') {
    await populateGruposSelects();
  }
  
  const grupoSel = document.getElementById('asis-id-grupo');
  if (grupoSel && grupoSel.options.length > 1 && !grupoSel.value) {
    grupoSel.value = grupoSel.options[1].value;
  }

  await cargarRosterGrupoAsistencia();
  poblarFiltroGrupoHistorial();
  await poblarFiltroEstudiantesHistorial('');
  await poblarFiltroMateriaHistorial();
  await cargarHistorialAsistencia();
}

async function cargarRosterGrupoAsistencia() {
  const grupoSel = document.getElementById('asis-id-grupo');
  const personaSel = document.getElementById('asis-persona');
  const profesorSel = document.getElementById('asis-id-profesor');
  const hint = document.getElementById('asis-grupo-hint');
  if (!grupoSel || !personaSel || !profesorSel) return;

  const idGrupo = parseInt(grupoSel.value, 10);
  
  if (!idGrupo || isNaN(idGrupo)) {
    personaSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    personaSel.disabled = true;
    profesorSel.disabled = true;
    if (hint) {
      hint.textContent = 'Selecciona el grupo para filtrar automáticamente el roster.';
      hint.classList.remove('text-danger');
    }
    return;
  }

  personaSel.innerHTML = '<option value="" disabled selected>Cargando estudiantes...</option>';
  profesorSel.innerHTML = '<option value="" disabled selected>Cargando profesor...</option>';
  personaSel.disabled = true;
  profesorSel.disabled = true;

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el detalle del grupo');
    const detalle = await res.json();

    // Guardia anti-race-condition: si mientras esta petición estaba en
    // vuelo el usuario (o el modal al abrirse) cambió el grupo seleccionado,
    // esta respuesta ya quedó vieja/obsoleta. Se descarta para no pisar
    // con datos del grupo anterior lo que corresponde al grupo actual.
    // Esto es lo que causaba que, por ejemplo, al seleccionar "1-B" se
    // terminara mostrando el profesor y los estudiantes de "1-A".
    const idGrupoActualEnPantalla = parseInt(grupoSel.value, 10);
    if (idGrupoActualEnPantalla !== idGrupo) {
      return;
    }

    // Poblar estudiantes
    personaSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
    const estudiantes = detalle.estudiantes || [];
    estudiantes.forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      personaSel.add(new Option(texto, e.id_estudiante));
    });
    personaSel.disabled = estudiantes.length === 0;

    // Poblar profesores
    profesorSel.innerHTML = '<option value="" disabled selected>Seleccionar profesor</option>';
    const rolActual = (currentUser?.rol || '').toLowerCase();

    if (rolActual === 'profesor' && currentUser?.id_profesor) {
      // Un profesor únicamente puede registrar asistencia bajo su propio nombre.
      // No usamos la lista que devuelve el detalle del grupo (esa refleja el/los
      // profesor(es) vinculados en grupo_profesor, que puede no coincidir con
      // quien tiene la sesión abierta, p. ej. si hay suplencias).
      profesorSel.innerHTML = '';
      const nombreProfesorActual = `${currentUser.nombre ?? ''} ${currentUser.apellido1 ?? ''}`.trim();
      profesorSel.add(new Option(nombreProfesorActual || 'Profesor actual', currentUser.id_profesor));
      profesorSel.value = currentUser.id_profesor;
      profesorSel.disabled = true;
    } else {
      const profesores = detalle.profesores || [];
      profesores.forEach((p) => {
        const texto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} (${p.materia || 'General'})`.trim();
        profesorSel.add(new Option(texto, p.id_profesor));
      });
      profesorSel.disabled = profesores.length === 0;

      if (profesores.length === 1) {
        profesorSel.value = profesores[0].id_profesor;
      }
    }

    if (hint) {
      if (estudiantes.length === 0) {
        hint.textContent = 'Este grupo no tiene estudiantes matriculados.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = `Se cargaron ${estudiantes.length} estudiante(s) correctamente.`;
        hint.classList.remove('text-danger');
      }
    }
  } catch (error) {
    console.error('Error cargando roster del grupo', error);
    personaSel.innerHTML = '<option value="" disabled selected>Error al cargar estudiantes</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Error al cargar profesor</option>';
  }
}

function poblarFiltroGrupoHistorial() {
  const sel = document.getElementById('hist-filtro-grupo');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  if (typeof allGrupos !== 'undefined' && Array.isArray(allGrupos)) {
    allGrupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      sel.add(new Option(g.nombre_grupo ?? `Grupo ${id}`, id));
    });
  }
  sel.value = valorActual || '';
}

async function poblarFiltroEstudiantesHistorial(idGrupo) {
  const sel = document.getElementById('hist-filtro-estudiante');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos los estudiantes</option>';
  
  if (!idGrupo) {
    sel.disabled = false;
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) return;
    const detalle = await res.json();
    (detalle.estudiantes || []).forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      sel.add(new Option(texto, e.id_estudiante));
    });
  } catch (e) {
    console.error('Error cargando estudiantes para filtro', e);
  }
}

/**
 * NUEVO: Puebla el filtro "Materia/Curso" del historial con las materias
 * distintas registradas actualmente en la tabla profesor.
 */
async function poblarFiltroMateriaHistorial() {
  const sel = document.getElementById('hist-filtro-materia');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todas las materias</option>';
  try {
    const res = await apiFetch('/api/procesos/materias');
    if (!res.ok) return;
    const materias = await res.json();
    materias.forEach((m) => sel.add(new Option(m, m)));
    sel.value = valorActual || '';
  } catch (e) {
    console.error('Error cargando materias para filtro', e);
  }
}

async function cargarHistorialAsistencia() {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;

  const idGrupo = document.getElementById('hist-filtro-grupo')?.value || '';
  const idEstudiante = document.getElementById('hist-filtro-estudiante')?.value || '';
  const materia = document.getElementById('hist-filtro-materia')?.value || '';
  const estado = document.getElementById('hist-filtro-estado')?.value || '';
  const fechaDesde = document.getElementById('hist-filtro-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('hist-filtro-fecha-hasta')?.value || '';
  const busqueda = document.getElementById('hist-filtro-busqueda')?.value.trim() || '';

  const params = new URLSearchParams();
  if (idGrupo) params.set('id_grupo', idGrupo);
  if (idEstudiante) params.set('id_estudiante', idEstudiante);
  if (materia) params.set('materia', materia);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);
  if (busqueda) params.set('busqueda', busqueda);

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Cargando historial...</td></tr>';

  try {
    const res = await apiFetch(`/api/procesos/asistencia?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo cargar el historial');
    const registros = await res.json();
    renderHistorialAsistencia(registros);
    actualizarGraficosAsistencia(registros);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Error al cargar el historial.</td></tr>';
    actualizarGraficosAsistencia([]);
  }
}

function renderHistorialAsistencia(registros) {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!registros.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5">
          <i class="bi bi-calendar-x display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay registros de asistencia con estos filtros.</span>
        </td>
      </tr>
    `;
    actualizarGraficosAsistencia([]);
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  registros.forEach((r) => {
    const idAsis = r.id_asistencia ?? r.id;
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const materiaCurso = r.materia_curso ?? '-';
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const estado = (r.estado_asistencia || '').toLowerCase();
    const etiqueta = etiquetasEstado[estado] || r.estado_asistencia || '-';
    const observaciones = r.observaciones ? r.observaciones : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td class="fw-semibold">${estudiante || '-'}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor || '-'}</td>
      <td>${materiaCurso}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiqueta}</span></td>
      <td class="observaciones-cell" title="${observaciones}">${observaciones}</td>
      <td class="text-end">
        <button type="button" class="btn btn-outline-primary btn-sm px-2 py-1 btn-modificar-asistencia" title="Modificar estado">
          <i class="bi bi-pencil-square"></i> Modificar
        </button>
      </td>
    `;
    
    const btnMod = tr.querySelector('.btn-modificar-asistencia');
    btnMod.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      abrirModalModificarAsistencia(idAsis, estudiante, estado, r.observaciones || '');
    });

    tbody.appendChild(tr);
  });

  actualizarGraficosAsistencia(registros);
}

function abrirModalModificarAsistencia(idAsistencia, estudianteNombre, estadoActual, observacionesActuales) {
  document.getElementById('mod-id-asistencia').value = idAsistencia;
  document.getElementById('mod-estudiante-nombre').value = estudianteNombre;
  document.getElementById('mod-estado').value = estadoActual;
  document.getElementById('mod-observaciones').value = observacionesActuales !== '—' ? observacionesActuales : '';
  
  const modalEl = document.getElementById('modalModificarAsistencia');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

async function handleModificarAsistenciaSubmit(e) {
  e.preventDefault();
  const idAsistencia = document.getElementById('mod-id-asistencia').value;
  const payload = {
    estado_asistencia: document.getElementById('mod-estado').value,
    observaciones: document.getElementById('mod-observaciones').value.trim() || null
  };

  const btn = document.getElementById('mod-submit');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch(`/api/procesos/asistencia/${idAsistencia}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Registro de asistencia actualizado correctamente');
      const modalEl = document.getElementById('modalModificarAsistencia');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      await cargarHistorialAsistencia();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.mensaje || err.error || 'No se pudo actualizar el registro', 'error');
    }
  } catch (e) {
    showToast('Error de conexión al actualizar asistencia', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-save"></i> Actualizar Registro'; }
  }
}

function actualizarGraficosAsistencia(registros) {
  const total = registros.length;
  const presentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'presente').length;
  const ausentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'ausente').length;
  const tardias = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'tardia').length;
  const justificadas = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'justificada').length;

  const elTotal = document.getElementById('graf-total');
  const elEfectiva = document.getElementById('graf-efectiva');
  const elAusentismo = document.getElementById('graf-ausentismo');

  if (elTotal) elTotal.textContent = total;
  const ef = total > 0 ? ((presentes / total) * 100).toFixed(1) : 0;
  const aus = total > 0 ? ((ausentes / total) * 100).toFixed(1) : 0;
  if (elEfectiva) elEfectiva.textContent = `${ef}%`;
  if (elAusentismo) elAusentismo.textContent = `${aus}%`;

  const ctx = document.getElementById('chartAsistenciaEstados');
  if (!ctx) return;

  if (asistenciaChartInstance) {
    asistenciaChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    asistenciaChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Presentes', 'Ausentes', 'Tardías', 'Justificadas'],
        datasets: [{
          data: [presentes, ausentes, tardias, justificadas],
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }
}

async function handleAsistenciaSubmit(e) {
  e.preventDefault();
  const grupoSel = document.getElementById('asis-id-grupo');
  const personaSel = document.getElementById('asis-persona');
  const profesorSel = document.getElementById('asis-id-profesor');

  if (!grupoSel.value || !personaSel.value || !profesorSel.value) {
    showToast('Selecciona grupo, estudiante y profesor.', 'error');
    return;
  }

  const payload = {
    fecha: document.getElementById('asis-fecha').value,
    estado_asistencia: document.getElementById('asis-estado').value,
    observaciones: document.getElementById('asis-observaciones').value.trim() || null,
    id_estudiante: parseInt(personaSel.value, 10),
    id_grupo: parseInt(grupoSel.value, 10),
    id_profesor: parseInt(profesorSel.value, 10)
  };

  const submitBtn = document.getElementById('asis-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...'; }

  try {
    const res = await apiFetch('/api/procesos/asistencia', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      showToast('Asistencia guardada correctamente');
      document.getElementById('asis-observaciones').value = '';
      personaSel.value = '';
      await cargarHistorialAsistencia();
    } else {
      const json = await res.json().catch(() => ({}));
      showToast(json.error || json.mensaje || 'Error guardando asistencia', 'error');
    }
  } catch {
    showToast('Error guardando asistencia', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Registro de Asistencia'; }
  }
}

(function () {
  const moduleName = 'reportes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireReportesEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE REPORTES
   Resumen académico, detalle de asistencias y exportación a PDF.
   ========================================== */

function wireReportesEvents() {
  const reportApply = document.getElementById('report-aplicar');
  if (reportApply && !reportApply.dataset.wired) {
    reportApply.dataset.wired = '1';
    reportApply.addEventListener('click', cargarReporteResumen);
  }

  const reportClear = document.getElementById('report-limpiar');
  if (reportClear && !reportClear.dataset.wired) {
    reportClear.dataset.wired = '1';
    reportClear.addEventListener('click', () => {
      const grupoSel = document.getElementById('report-filtro-grupo');
      const busquedaInput = document.getElementById('report-filtro-busqueda');
      const tipoReporteSel = document.getElementById('report-filtro-tipo');
      const estadoSel = document.getElementById('report-filtro-estado');
      const fechaDesde = document.getElementById('report-filtro-fecha-desde');
      const fechaHasta = document.getElementById('report-filtro-fecha-hasta');

      if (grupoSel) grupoSel.value = '';
      if (busquedaInput) busquedaInput.value = '';
      if (tipoReporteSel) tipoReporteSel.value = 'resumen';
      if (estadoSel) estadoSel.value = '';
      if (fechaDesde) fechaDesde.value = '';
      if (fechaHasta) fechaHasta.value = '';
      cambiarModoReporte('matricula');
      cargarReporteResumen();
    });
  }

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.addEventListener('click', () => cambiarModoReporte(button.dataset.reportMode));
  });

  const reportPreview = document.getElementById('report-vista-previa');
  if (reportPreview && !reportPreview.dataset.wired) {
    reportPreview.dataset.wired = '1';
    reportPreview.addEventListener('click', abrirVistaPreviaReporte);
  }

  const reportPrint = document.getElementById('report-imprimir-pdf');
  if (reportPrint && !reportPrint.dataset.wired) {
    reportPrint.dataset.wired = '1';
    reportPrint.addEventListener('click', imprimirReportePdf);
  }

  const previewPdfBtn = document.getElementById('preview-generar-pdf');
  if (previewPdfBtn && !previewPdfBtn.dataset.wired) {
    previewPdfBtn.dataset.wired = '1';
    previewPdfBtn.addEventListener('click', () => {
      const modalEl = document.getElementById('modalPreviewReporte');
      if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
      }
      imprimirReportePdf();
    });
  }

  const tipoReporteSel = document.getElementById('report-filtro-tipo');
  if (tipoReporteSel) {
    tipoReporteSel.addEventListener('change', () => {
      const valor = tipoReporteSel.value || 'resumen';
      actualizarEtiquetasModo(obtenerModoReporteActivo());
      if (valor === 'individual' || valor === 'grupo') {
        document.querySelector('.report-ui-title')?.setAttribute('data-mode-context', valor);
      }
    });
  }

  cambiarModoReporte('matricula');
}

async function loadReportesData() {
  await populateGruposSelects();
  poblarFiltroGrupoReportes();
  await cargarReporteResumen();
}

function cambiarModoReporte(modo) {
  const buttons = document.querySelectorAll('[data-report-mode]');
  const tipoReporteSel = document.getElementById('report-filtro-tipo');
  const modoNormalizado = modo || 'matricula';

  if (tipoReporteSel) {
    const tipoMap = {
      matricula: 'resumen',
      estudiantes: 'individual',
      grupos: 'grupo',
      profesores: 'resumen'
    };
    tipoReporteSel.value = tipoMap[modoNormalizado] || 'resumen';
  }

  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === modoNormalizado);
  });

  document.querySelectorAll('.report-filter-field').forEach((field) => field.classList.add('is-hidden'));
  const map = {
    matricula: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    estudiantes: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    grupos: ['grupo', 'fecha-desde', 'fecha-hasta'],
    profesores: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta']
  };

  const visible = map[modoNormalizado] || map.matricula;
  visible.forEach((key) => {
    const field = document.querySelector(`.report-filter-field[data-filter="${key}"]`);
    if (field) field.classList.remove('is-hidden');
  });

  actualizarEtiquetasModo(modoNormalizado);
}

function obtenerModoReporteActivo() {
  const active = document.querySelector('[data-report-mode].active');
  return active?.dataset.reportMode || 'matricula';
}

function actualizarEtiquetasModo(modo) {
  const title = document.querySelector('#reportes-view .card-title-serif');
  const labels = {
    matricula: 'Reporte de matrícula',
    estudiantes: 'Reporte de estudiantes',
    grupos: 'Reporte de grupos',
    profesores: 'Reporte de profesores'
  };
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${labels[modo] || labels.matricula}`;
}

function obtenerFiltrosActivos() {
  return {
    idGrupo: document.getElementById('report-filtro-grupo')?.value || '',
    busqueda: document.getElementById('report-filtro-busqueda')?.value.trim() || '',
    tipoReporte: document.getElementById('report-filtro-tipo')?.value || 'resumen',
    estado: document.getElementById('report-filtro-estado')?.value || '',
    fechaDesde: document.getElementById('report-filtro-fecha-desde')?.value || '',
    fechaHasta: document.getElementById('report-filtro-fecha-hasta')?.value || ''
  };
}

function abrirVistaPreviaReporte() {
  if (!window._reportePdfData) {
    showToast('Primero genera un reporte con filtros válidos para previsualizarlo.', 'error');
    return;
  }

  const modalEl = document.getElementById('modalPreviewReporte');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  const { resumen = {}, detalle = [], detalle_por_grupo = [] } = window._reportePdfData;
  const filtros = obtenerFiltrosActivos();
  const modo = obtenerModoReporteActivo();
  const labels = {
    matricula: 'Reporte de matrícula',
    estudiantes: 'Reporte de estudiantes',
    grupos: 'Reporte de grupos',
    profesores: 'Reporte de profesores'
  };

  document.getElementById('preview-reporte-titulo').textContent = labels[modo] || 'Reporte académico';
  const chipArea = document.getElementById('preview-reporte-filtros');
  const metricsArea = document.getElementById('preview-reporte-metricas');
  const body = document.getElementById('preview-reporte-detalle-body');
  const previewHeader = document.querySelector('#preview-reporte-tabla thead tr');

  chipArea.innerHTML = '';
  const chips = [
    `Grupo: ${document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos'}`,
    `Estado: ${filtros.estado || 'Todos'}`,
    `Desde: ${filtros.fechaDesde || '—'}`,
    `Hasta: ${filtros.fechaHasta || '—'}`,
    `Búsqueda: ${filtros.busqueda || '—'}`
  ];
  chips.forEach((chip) => {
    const span = document.createElement('span');
    span.className = 'preview-reporte-chip';
    span.textContent = chip;
    chipArea.appendChild(span);
  });

  if (previewHeader) {
    if (modo === 'estudiantes') {
      previewHeader.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
    } else if (modo === 'profesores') {
      previewHeader.innerHTML = '<th>Fecha</th><th>Profesor</th><th>Estudiante</th><th>Grupo</th><th>Estado</th><th>Observaciones</th>';
    } else {
      previewHeader.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
    }
  }

  if (modo === 'grupos') {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Grupos</span>
          <div class="stat-value">${resumen.total_grupos ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Matrículas</span>
          <div class="stat-value">${resumen.total_matriculas ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Asistencias</span>
          <div class="stat-value">${resumen.total_asistencias ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentismo</span>
          <div class="stat-value">${resumen.tasa_presentismo ?? 0}%</div>
        </div>
      </div>
    `;
  } else if (modo === 'estudiantes') {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Estudiantes</span>
          <div class="stat-value">${resumen.total_estudiantes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Asistencias</span>
          <div class="stat-value">${resumen.total_asistencias ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentes</span>
          <div class="stat-value">${resumen.presentes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentismo</span>
          <div class="stat-value">${resumen.tasa_presentismo ?? 0}%</div>
        </div>
      </div>
    `;
  } else if (modo === 'profesores') {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Profesores</span>
          <div class="stat-value">${resumen.total_profesores ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Asistencias</span>
          <div class="stat-value">${resumen.total_asistencias ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentes</span>
          <div class="stat-value">${resumen.presentes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentismo</span>
          <div class="stat-value">${resumen.tasa_presentismo ?? 0}%</div>
        </div>
      </div>
    `;
  } else {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Presentes</span>
          <div class="stat-value">${resumen.presentes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Ausentes</span>
          <div class="stat-value">${resumen.ausentes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Tardías</span>
          <div class="stat-value">${resumen.tardias ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Tasa de presentismo</span>
          <div class="stat-value">${resumen.tasa_presentismo ?? 0}%</div>
        </div>
      </div>
    `;
  }

  if (!detalle.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay registros detallados para esta vista previa.</td></tr>';
  } else {
    body.innerHTML = '';
    const etiquetasEstado = {
      presente: 'Presente',
      ausente: 'Ausente',
      tardia: 'Tardía',
      justificada: 'Justificada'
    };

    detalle.slice(0, 12).forEach((r) => {
      const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
      const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
      const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
      const estado = (r.estado_asistencia || '').toLowerCase();
      const tr = document.createElement('tr');
      tr.innerHTML = modo === 'profesores'
        ? `
          <td>${fecha}</td>
          <td>${profesor || '-'}</td>
          <td>${estudiante || '-'}</td>
          <td>${r.nombre_grupo ?? '-'}</td>
          <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
          <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
        `
        : `
          <td>${fecha}</td>
          <td>${estudiante || '-'}</td>
          <td>${r.nombre_grupo ?? '-'}</td>
          <td>${profesor || '-'}</td>
          <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
          <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
        `;
      body.appendChild(tr);
    });
  }

  modal.show();
}

function imprimirReportePdf() {
  const docConstructor = window.jspdf?.jsPDF;
  if (!docConstructor || !window._reportePdfData) {
    document.title = 'Reporte administrativo - PDF';
    window.print();
    return;
  }

  const modo = obtenerModoReporteActivo();
  const labels = {
    matricula: 'Reporte de matrícula',
    estudiantes: 'Reporte de estudiantes',
    grupos: 'Reporte de grupos',
    profesores: 'Reporte de profesores'
  };

  const { resumen = {}, detalle_por_grupo = [], detalle = [] } = window._reportePdfData;
  const doc = new docConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lineHeight = 6;
  const pageHeight = 290;
  let y = 18;

  const nuevaPagina = () => {
    doc.addPage();
    y = 18;
  };

  const agregarBloque = (titulo, lineas) => {
    if (y > pageHeight - 30) nuevaPagina();
    doc.setFillColor(236, 244, 255);
    doc.rect(12, y - 6, 186, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(titulo, 14, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(24, 24, 24);
    lineas.forEach((linea) => {
      if (y > pageHeight - 15) nuevaPagina();
      doc.text(linea, 14, y);
      y += lineHeight;
    });
    y += 2;
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(labels[modo] || 'Reporte administrativo - EduControl', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 14, 20);

  y = 36;
  doc.setTextColor(0, 0, 0);
  const filtros = {
    Grupo: document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos',
    Estado: document.getElementById('report-filtro-estado')?.value || 'Todos',
    FechaInicio: document.getElementById('report-filtro-fecha-desde')?.value || '—',
    FechaFin: document.getElementById('report-filtro-fecha-hasta')?.value || '—',
    Busqueda: document.getElementById('report-filtro-busqueda')?.value || '—'
  };

  const lineasFiltros = Object.entries(filtros).map(([label, value]) => `${label}: ${value}`);
  agregarBloque('Filtros aplicados', lineasFiltros);

  const metricas = modo === 'grupos'
    ? [
        `Grupos: ${resumen.total_grupos ?? 0}`,
        `Matrículas: ${resumen.total_matriculas ?? 0}`,
        `Asistencias: ${resumen.total_asistencias ?? 0}`,
        `Presentes: ${resumen.presentes ?? 0}`,
        `Ausentes: ${resumen.ausentes ?? 0}`,
        `Tasa de presentismo: ${resumen.tasa_presentismo ?? 0}%`
      ]
    : modo === 'estudiantes'
      ? [
          `Estudiantes: ${resumen.total_estudiantes ?? 0}`,
          `Asistencias: ${resumen.total_asistencias ?? 0}`,
          `Presentes: ${resumen.presentes ?? 0}`,
          `Ausentes: ${resumen.ausentes ?? 0}`,
          `Tardías: ${resumen.tardias ?? 0}`,
          `Tasa de presentismo: ${resumen.tasa_presentismo ?? 0}%`
        ]
      : modo === 'profesores'
        ? [
            `Profesores: ${resumen.total_profesores ?? 0}`,
            `Asistencias: ${resumen.total_asistencias ?? 0}`,
            `Presentes: ${resumen.presentes ?? 0}`,
            `Ausentes: ${resumen.ausentes ?? 0}`,
            `Tardías: ${resumen.tardias ?? 0}`,
            `Tasa de presentismo: ${resumen.tasa_presentismo ?? 0}%`
          ]
        : [
            `Estudiantes: ${resumen.total_estudiantes ?? 0}`,
            `Profesores: ${resumen.total_profesores ?? 0}`,
            `Grupos: ${resumen.total_grupos ?? 0}`,
            `Matrículas: ${resumen.total_matriculas ?? 0}`,
            `Presentes: ${resumen.presentes ?? 0}`,
            `Ausentes: ${resumen.ausentes ?? 0}`,
            `Tardías: ${resumen.tardias ?? 0}`,
            `Justificadas: ${resumen.justificadas ?? 0}`,
            `Tasa de presentismo: ${resumen.tasa_presentismo ?? 0}%`
          ];

  agregarBloque('Resumen general', metricas);

  if (detalle_por_grupo?.length && modo !== 'estudiantes' && modo !== 'profesores') {
    const lineasGrupo = detalle_por_grupo.map((grupo) => {
      return `• ${grupo.nombre_grupo ?? '-'} | Sección: ${grupo.nombre_seccion ?? '-'} | Ocupados: ${grupo.ocupados ?? 0} | Capacidad: ${grupo.capacidad ?? 0} | Asistencias: ${grupo.asistencias_registradas ?? 0}`;
    });
    agregarBloque('Detalle por grupo', lineasGrupo);
  }

  if (detalle?.length) {
    const lineasDetalle = detalle.slice(0, 32).map((registro) => {
      const estudiante = `${registro.estudiante_nombre ?? ''} ${registro.estudiante_apellido1 ?? ''} ${registro.estudiante_apellido2 ?? ''}`.trim() || '-';
      const profesor = `${registro.profesor_nombre ?? ''} ${registro.profesor_apellido1 ?? ''}`.trim() || '-';
      const fecha = registro.fecha ? String(registro.fecha).split('T')[0] : '-';
      return modo === 'profesores'
        ? `${fecha} | ${profesor} | ${estudiante} | ${registro.nombre_grupo ?? '-'} | ${registro.estado_asistencia ?? '-'}`
        : `${fecha} | ${estudiante} | ${registro.nombre_grupo ?? '-'} | ${profesor} | ${registro.estado_asistencia ?? '-'}`;
    });
    agregarBloque('Detalle de asistencias', lineasDetalle);
  }

  doc.save('reporte-administrativo.pdf');
}

function poblarFiltroGrupoReportes() {
  const sel = document.getElementById('report-filtro-grupo');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  allGrupos.forEach((g) => {
    const id = g.id_grupo ?? g.id;
    sel.add(new Option(g.nombre_grupo ?? `Grupo ${id}`, id));
  });
  sel.value = valorActual || '';
}

async function cargarReporteResumen() {
  const filtros = obtenerFiltrosActivos();
  const params = new URLSearchParams();
  const modo = obtenerModoReporteActivo();
  const { idGrupo, busqueda, tipoReporte, estado, fechaDesde, fechaHasta } = filtros;

  params.set('modo', modo);
  if (idGrupo) params.set('id_grupo', idGrupo);
  if (busqueda) params.set('busqueda', busqueda);
  if (tipoReporte) params.set('tipo_reporte', tipoReporte);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);

  try {
    const casoRes = await apiFetch(`/api/procesos/reportes/caso?${params.toString()}`);

    if (!casoRes.ok) throw new Error('No se pudo cargar el reporte solicitado');

    const casoJson = await casoRes.json();
    window._reportePdfData = {
      modo,
      resumen: casoJson?.resumen || {},
      detalle_por_grupo: casoJson?.detalle_por_grupo || [],
      detalle: Array.isArray(casoJson?.detalle) ? casoJson.detalle : []
    };
    renderReporteResumen(casoJson);
    renderReporteDetalle(casoJson?.detalle || []);
  } catch (error) {
    console.error('Error cargando reportes', error);
    document.getElementById('report-grupos-body').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar el resumen.</td></tr>';
    document.getElementById('report-detalle-body').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error al cargar el detalle.</td></tr>';
  }
}

function renderReporteResumen(data) {
  const resumen = data?.resumen || {};
  const grupos = data?.detalle_por_grupo || [];
  const modo = obtenerModoReporteActivo();

  document.getElementById('report-total-estudiantes').textContent = resumen.total_estudiantes ?? 0;
  document.getElementById('report-total-profesores').textContent = resumen.total_profesores ?? 0;
  document.getElementById('report-total-grupos').textContent = resumen.total_grupos ?? 0;
  document.getElementById('report-tasa-presentismo').textContent = `${resumen.tasa_presentismo ?? 0}%`;
  document.getElementById('report-presentes').textContent = resumen.presentes ?? 0;
  document.getElementById('report-ausentes').textContent = resumen.ausentes ?? 0;
  document.getElementById('report-tardias').textContent = resumen.tardias ?? 0;
  document.getElementById('report-justificadas').textContent = resumen.justificadas ?? 0;

  const header = document.querySelector('#reportes-view thead tr');
  if (header) {
    if (modo === 'estudiantes') {
      header.innerHTML = `
        <th>Estudiante</th>
        <th>Grupo</th>
        <th>Asistencias</th>
        <th>Presentes</th>
        <th>Ausentes</th>
        <th>Tardías</th>
        <th>Justificadas</th>
      `;
    } else if (modo === 'profesores') {
      header.innerHTML = `
        <th>Profesor</th>
        <th>Grupo</th>
        <th>Asistencias</th>
        <th>Presentes</th>
        <th>Ausentes</th>
        <th>Tardías</th>
        <th>Justificadas</th>
      `;
    } else {
      header.innerHTML = `
        <th>Grupo</th>
        <th>Sección</th>
        <th>Ocupados</th>
        <th>Capacidad</th>
        <th>Asistencias</th>
        <th>Presentes</th>
        <th>Ausentes</th>
      `;
    }
  }

  const body = document.getElementById('report-grupos-body');
  if (!body) return;
  body.innerHTML = '';

  if (!grupos.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No hay registros con los filtros aplicados.</td></tr>';
    return;
  }

  if (modo === 'estudiantes') {
    grupos.forEach((g) => {
      const nombre = `${g.estudiante_nombre ?? ''} ${g.estudiante_apellido1 ?? ''} ${g.estudiante_apellido2 ?? ''}`.trim();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nombre || '-'}</td>
        <td>${g.grupo ?? '-'}</td>
        <td>${g.asistencias_registradas ?? 0}</td>
        <td>${g.presentes ?? 0}</td>
        <td>${g.ausentes ?? 0}</td>
        <td>${g.tardias ?? 0}</td>
        <td>${g.justificadas ?? 0}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'profesores') {
    grupos.forEach((g) => {
      const nombre = `${g.profesor_nombre ?? ''} ${g.profesor_apellido1 ?? ''} ${g.profesor_apellido2 ?? ''}`.trim();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nombre || '-'}</td>
        <td>${g.grupo ?? '-'}</td>
        <td>${g.asistencias_registradas ?? 0}</td>
        <td>${g.presentes ?? 0}</td>
        <td>${g.ausentes ?? 0}</td>
        <td>${g.tardias ?? 0}</td>
        <td>${g.justificadas ?? 0}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  grupos.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.nombre_grupo ?? '-'}</td>
      <td>${g.nombre_seccion ?? '-'}</td>
      <td>${g.ocupados ?? 0}</td>
      <td>${g.capacidad ?? 0}</td>
      <td>${g.asistencias_registradas ?? 0}</td>
      <td>${g.presentes ?? 0}</td>
      <td>${g.ausentes ?? 0}</td>
    `;
    body.appendChild(tr);
  });
}

function renderReporteDetalle(registros) {
  const body = document.getElementById('report-detalle-body');
  const modo = obtenerModoReporteActivo();
  if (!body) return;
  body.innerHTML = '';

  if (!registros.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No hay registros detallados con estos filtros.</td></tr>';
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  if (modo === 'estudiantes') {
    registros.forEach((r) => {
      const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
      const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
      const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
      const estado = (r.estado_asistencia || '').toLowerCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${estudiante || '-'}</td>
        <td>${r.nombre_grupo ?? '-'}</td>
        <td>${profesor || '-'}</td>
        <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
        <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'profesores') {
    registros.forEach((r) => {
      const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
      const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
      const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
      const estado = (r.estado_asistencia || '').toLowerCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${profesor || '-'}</td>
        <td>${estudiante || '-'}</td>
        <td>${r.nombre_grupo ?? '-'}</td>
        <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
        <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  registros.forEach((r) => {
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const estado = (r.estado_asistencia || '').toLowerCase();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${estudiante || '-'}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor || '-'}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
      <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
    `;
    body.appendChild(tr);
  });
}

(function () {
  const moduleName = 'consultas';

let estudiantes = [];
let estudiantesMatriculados = [];
let profesores = [];
let matriculas = [];
let asistencias = [];

// Registro que se está mostrando en la vista previa
let documentoActual = null;
let tipoDocumentoActual = null;
  window.EduControlModules = window.EduControlModules || {};

  window.EduControlModules[moduleName] = {
    name: moduleName,

    init() {
      const section = document.getElementById('consultas-view');
      if (!section || section.dataset.wired === '1') return;

      section.dataset.wired = '1';

      conectarEventos();
      cargarConsultas();
    }
  };

  function conectarEventos() {
    const tipo = document.getElementById('consulta-tipo');
    const busqueda = document.getElementById('consulta-busqueda');
    const estado = document.getElementById('consulta-estado');
    const grupo = document.getElementById('consulta-grupo');
    const seccion = document.getElementById('consulta-seccion');
    const nivel = document.getElementById('consulta-nivel');
    const fecha = document.getElementById('consulta-fecha');
    const limpiar = document.getElementById('consulta-limpiar');
    const refrescar = document.getElementById('consulta-refrescar');
    const tablaBody = document.getElementById('consulta-tabla-body');
    const modificarDetalle = document.getElementById('consulta-detalle-modificar');
    const descargarPdf = document.getElementById('consulta-descargar-pdf');

    tipo?.addEventListener('change', actualizarConsulta);
    busqueda?.addEventListener('input', actualizarConsulta);
    estado?.addEventListener('change', actualizarConsulta);
    grupo?.addEventListener('change', actualizarConsulta);
    seccion?.addEventListener('change', actualizarConsulta);
    nivel?.addEventListener('change', actualizarConsulta);
    fecha?.addEventListener('change', actualizarConsulta);
    refrescar?.addEventListener('click', cargarConsultas);

    tablaBody?.addEventListener('click', manejarAccionesTabla);

    modificarDetalle?.addEventListener(
      'click',
      modificarDesdeDetalle
    );
    descargarPdf?.addEventListener(
  'click',
  descargarDocumentoPDF
);

    limpiar?.addEventListener('click', () => {
      if (busqueda) busqueda.value = '';
      if (estado) estado.value = '';
      if (grupo) grupo.value = '';
      if (seccion) seccion.value = '';
      if (nivel) nivel.value = '';
      if (fecha) fecha.value = '';

      actualizarConsulta();
    });
  }

  async function cargarConsultas() {
    mostrarCargando();

    try {
      const [
        resEstudiantes,
        resEstudiantesMatriculados,
        resProfesores,
        resMatriculas,
        resAsistencias
      ] = await Promise.all([
        apiFetch('/api/estudiantes'),
        apiFetch('/api/estudiantes/matriculados'),
        apiFetch('/api/profesores'),
        apiFetch('/api/procesos/matricula'),
        apiFetch('/api/procesos/asistencia')
      ]);

      estudiantes = resEstudiantes.ok
        ? await resEstudiantes.json()
        : [];

      estudiantesMatriculados =
        resEstudiantesMatriculados.ok
          ? await resEstudiantesMatriculados.json()
          : [];

      profesores = resProfesores.ok
        ? await resProfesores.json()
        : [];

      matriculas = resMatriculas.ok
        ? await resMatriculas.json()
        : [];

      asistencias = resAsistencias.ok
        ? await resAsistencias.json()
        : [];

      if (!resEstudiantesMatriculados.ok) {
        console.warn(
          'No se pudieron cargar los estudiantes matriculados.'
        );
      }

      if (!resMatriculas.ok) {
        console.warn(
          'No se pudieron cargar las matrículas.'
        );
      }

      if (!resAsistencias.ok) {
        console.warn(
          'No se pudieron cargar los registros de asistencia.'
        );
      }

      actualizarResumen();
      cargarFiltroGrupos();
      cargarFiltrosMatriculados();
      actualizarConsulta();
    } catch (error) {
      console.error('Error cargando consultas:', error);

      mostrarError(
        error.message ||
        'No se pudo cargar la información.'
      );
    }
  }

  /* ==========================================
     RESUMEN GENERAL DE CONSULTAS
     ========================================== */

  function actualizarResumen() {
    const totalEstudiantes = document.getElementById(
      'consulta-total-estudiantes'
    );

    const totalMatriculados = document.getElementById(
      'consulta-total-matriculados'
    );

    const totalProfesores = document.getElementById(
      'consulta-total-profesores'
    );

    const totalMatriculas = document.getElementById(
      'consulta-total-matriculas'
    );

    const totalAsistencias = document.getElementById(
      'consulta-total-asistencias'
    );

    if (totalEstudiantes) {
      totalEstudiantes.textContent = estudiantes.length;
    }

    if (totalMatriculados) {
      totalMatriculados.textContent =
        estudiantesMatriculados.length;
    }

    if (totalProfesores) {
      totalProfesores.textContent = profesores.length;
    }

    if (totalMatriculas) {
      totalMatriculas.textContent = matriculas.length;
    }

    if (totalAsistencias) {
      totalAsistencias.textContent = asistencias.length;
    }
  }

  /* ==========================================
     CAMBIO DEL TIPO DE CONSULTA
     ========================================== */

  function actualizarConsulta() {
    const tipo =
      document.getElementById('consulta-tipo')?.value ||
      'prematriculados';

    actualizarFiltroEstado(tipo);
    actualizarTextoBusqueda(tipo);
    actualizarFiltrosVisibles(tipo);

    if (tipo === 'prematriculados') {
      mostrarEstudiantesPrematriculados();
      return;
    }

    if (tipo === 'matriculados') {
      mostrarEstudiantesMatriculados();
      return;
    }

    if (tipo === 'profesores') {
      mostrarProfesores();
      return;
    }

    if (tipo === 'matriculas') {
      mostrarMatriculas();
      return;
    }

    if (tipo === 'asistencia') {
      mostrarAsistencias();
    }
  }

  /* ==========================================
     FILTROS DINÁMICOS
     ========================================== */

  function actualizarFiltroEstado(tipo) {
    const select = document.getElementById('consulta-estado');

    if (!select) return;

    const valorActual = select.value;

    if (tipo === 'asistencia') {
      select.innerHTML = `
        <option value="">Todos</option>
        <option value="presente">Presente</option>
        <option value="ausente">Ausente</option>
        <option value="tardia">Tardía</option>
        <option value="justificada">Justificada</option>
      `;
          } else if (
      tipo === 'matriculas' ||
      tipo === 'matriculados'
    ) {
      select.innerHTML = `
        <option value="">Todos</option>
        <option value="activa">Activa</option>
        <option value="inactiva">Inactiva</option>
        <option value="retirada">Retirada</option>
        <option value="finalizada">Finalizada</option>
      `;
    } else {
      select.innerHTML = `
        <option value="">Todos</option>
        <option value="activo">Activo</option>
        <option value="inactivo">Inactivo</option>
      `;
    }

    const opcionExiste = Array.from(select.options).some(
      (opcion) => opcion.value === valorActual
    );

    select.value = opcionExiste ? valorActual : '';
  }

  function actualizarTextoBusqueda(tipo) {
    const input = document.getElementById(
      'consulta-busqueda'
    );

    if (!input) return;

    const textos = {
      prematriculados:
        'Buscar estudiante pendiente...',

      matriculados:
        'Buscar por estudiante, grupo, sección o nivel...',

      profesores:
        'Buscar por nombre o materia...',

      matriculas:
        'Buscar por estudiante o grupo...',

      asistencia:
        'Buscar por estudiante, grupo o profesor...'
    };

    input.placeholder =
      textos[tipo] || 'Buscar...';
  }

  function actualizarFiltrosVisibles(tipo) {
    const filtroGrupo = document.querySelector(
      '.consulta-filtro-grupo'
    );

    const filtroFecha = document.querySelector(
      '.consulta-filtro-fecha'
    );

    const filtroSeccion = document.querySelector(
      '.consulta-filtro-seccion'
    );

    const filtroNivel = document.querySelector(
      '.consulta-filtro-nivel'
    );

    const usaGrupo =
      tipo === 'matriculados' ||
      tipo === 'matriculas' ||
      tipo === 'asistencia';

    const usaFecha =
      tipo === 'matriculas' ||
      tipo === 'asistencia';

    const usaInformacionAcademica =
      tipo === 'matriculados';

    filtroGrupo?.classList.toggle(
      'hidden',
      !usaGrupo
    );

    filtroFecha?.classList.toggle(
      'hidden',
      !usaFecha
    );

    filtroSeccion?.classList.toggle(
      'hidden',
      !usaInformacionAcademica
    );

    filtroNivel?.classList.toggle(
      'hidden',
      !usaInformacionAcademica
    );
  }

  /* ==========================================
     ESTUDIANTES EN PRE-MATRÍCULA
     ========================================== */

  function mostrarEstudiantesPrematriculados() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const resultados = estudiantes.filter(
      (estudiante) => {
        const texto =
          formarNombre(estudiante).toLowerCase();

        const activo =
          estudiante.estado == 1 ||
          estudiante.estado === true ||
          estudiante.estado === undefined;

        const coincideBusqueda =
          !busqueda ||
          texto.includes(busqueda);

        const coincideEstado =
          !estadoSeleccionado ||
          (
            estadoSeleccionado === 'activo' &&
            activo
          ) ||
          (
            estadoSeleccionado === 'inactivo' &&
            !activo
          );

        return (
          coincideBusqueda &&
          coincideEstado
        );
      }
    );

    actualizarTitulo(
      'Estudiantes pendientes de matrícula',
      resultados.length
    );

    cambiarEncabezado(`
      <tr>
        <th>ID</th>
        <th>Nombre completo</th>
        <th>Nacimiento</th>
        <th>Ingreso</th>
        <th>Estado</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(6);
      return;
    }

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((estudiante) => {
      const id =
        estudiante.id_estudiante ??
        estudiante.id ??
        '';

      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true ||
        estudiante.estado === undefined;

      const fila = document.createElement('tr');

      fila.innerHTML = `
  <td>${id}</td>

  <td>
    <div class="fw-semibold">
      ${formarNombre(estudiante) || '-'}
    </div>

    <small class="text-muted">
      Matrícula #${estudiante.id_matricula ?? '-'}
    </small>
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_nacimiento
    )}
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_ingreso
    )}
  </td>

  <td>
    <span
      class="badge ${
        activo
          ? 'bg-success'
          : 'bg-secondary'
      }">
      ${activo ? 'Activo' : 'Inactivo'}
    </span>
  </td>

    
<td class="text-end">
  <button
    type="button"
    class="btn btn-sm btn-outline-primary consulta-ver-estudiante"
    data-id="${id}">
    <i class="bi bi-file-earmark-text"></i>
    Vista previa
  </button>

  <button
    type="button"
    class="btn btn-sm btn-outline-secondary consulta-editar-estudiante"
    data-id="${id}">
    <i class="bi bi-pencil"></i>
    Modificar
  </button>
</td>
`;

      body.appendChild(fila);
    });
  }

  /* ==========================================
     ESTUDIANTES MATRICULADOS
     ========================================== */

  function mostrarEstudiantesMatriculados() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const grupoSeleccionado =
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const seccionSeleccionada =
      document.getElementById(
        'consulta-seccion'
      )?.value || '';

    const nivelSeleccionado =
      document.getElementById(
        'consulta-nivel'
      )?.value || '';

    const resultados =
      estudiantesMatriculados.filter(
        (estudiante) => {
          const nombre =
            formarNombre(estudiante)
              .toLowerCase();

          const grupo = String(
            estudiante.nombre_grupo ?? ''
          ).toLowerCase();

          const seccion = String(
            estudiante.nombre_seccion ?? ''
          );

          const nivel = String(
            estudiante.nivel ?? ''
          );
                    const estado = String(
            estudiante.estado_matricula ?? 'activa'
          ).toLowerCase();

          const textoCompleto =
            `${nombre} ${grupo} ${seccion} ${nivel}`;

          const coincideBusqueda =
            !busqueda ||
            textoCompleto.includes(busqueda);

          const coincideGrupo =
            !grupoSeleccionado ||
            String(estudiante.id_grupo) ===
              String(grupoSeleccionado);

          const coincideSeccion =
            !seccionSeleccionada ||
            String(estudiante.id_seccion) ===
              String(seccionSeleccionada);

          const coincideNivel =
            !nivelSeleccionado ||
            nivel === nivelSeleccionado;

          const coincideEstado =
            !estadoSeleccionado ||
            estado === estadoSeleccionado;

          return (
            coincideBusqueda &&
            coincideGrupo &&
            coincideSeccion &&
            coincideNivel &&
            coincideEstado
          );
        }
      );

    actualizarTitulo(
      'Estudiantes matriculados',
      resultados.length
    );

    cambiarEncabezado(`
  <tr>
    <th>ID</th>
    <th>Estudiante</th>
    <th>Grupo</th>
    <th>Sección</th>
    <th>Nivel</th>
    <th>Fecha de matrícula</th>
    <th>Estado</th>
    <th class="text-end">Acciones</th>
  </tr>
`);

    if (!resultados.length) {
      mostrarSinResultados(8);
      return;
    }

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((estudiante) => {
      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true;

      const fila = document.createElement('tr');

      fila.innerHTML = `
  <td>
    ${estudiante.id_estudiante ?? '-'}
  </td>

  <td>
    <div class="fw-semibold">
      ${formarNombre(estudiante) || '-'}
    </div>

    <small class="text-muted">
      Matrícula #${estudiante.id_matricula ?? '-'}
    </small>
  </td>

  <td>
    ${estudiante.nombre_grupo ?? '-'}
  </td>

  <td>
    ${estudiante.nombre_seccion ?? '-'}
  </td>

  <td>
    ${estudiante.nivel ?? '-'}
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_matricula ||
      estudiante.fecha_asignacion
    )}
  </td>

  <td>
    <span
      class="badge ${
        activo
          ? 'bg-success'
          : 'bg-secondary'
      }">
      ${activo ? 'Activo' : 'Inactivo'}
    </span>
  </td>

  <td class="text-end">
    <button
      type="button"
      class="btn btn-sm btn-outline-primary consulta-ver-matriculado"
      data-estudiante="${estudiante.id_estudiante}"
      data-matricula="${estudiante.id_matricula ?? ''}">
      <i class="bi bi-file-earmark-text"></i>
      Vista previa
    </button>
  </td>
`;

      body.appendChild(fila);
    });
  }

  /* ==========================================
     CONSULTA DE PROFESORES
     ========================================== */

  function mostrarProfesores() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const resultados = profesores.filter(
      (profesor) => {
        const texto =
          `${formarNombre(profesor)} ${
            profesor.materia ?? ''
          }`.toLowerCase();

        const activo =
          profesor.estado == 1 ||
          profesor.estado === true;

        const coincideBusqueda =
          !busqueda ||
          texto.includes(busqueda);

        const coincideEstado =
          !estadoSeleccionado ||
          (
            estadoSeleccionado === 'activo' &&
            activo
          ) ||
          (
            estadoSeleccionado === 'inactivo' &&
            !activo
          );

        return (
          coincideBusqueda &&
          coincideEstado
        );
      }
    );

    actualizarTitulo(
      'Profesores registrados',
      resultados.length
    );

    cambiarEncabezado(`
      <tr>
        <th>ID</th>
        <th>Nombre completo</th>
        <th>Materia</th>
        <th>Ingreso</th>
        <th>Estado</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(6);
      return;
    }

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((profesor) => {
      const id =
        profesor.id_profesor ??
        profesor.id ??
        '';

      const nombre =
        formarNombre(profesor);

      const materia =
        profesor.materia ??
        'Sin asignar';

      const ingreso =
        limpiarFecha(
          profesor.fecha_ingreso
        );

      const activo =
        profesor.estado == 1 ||
        profesor.estado === true;

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>${id}</td>

        <td>${nombre || '-'}</td>

        <td>${materia}</td>

        <td>${ingreso}</td>

        <td>
          <span
            class="badge ${
              activo
                ? 'bg-success'
                : 'bg-danger'
            }">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary consulta-ver-profesor"
            data-id="${id}">
           <i class="bi bi-file-earmark-text"></i>
             Vista previa
          </button>
        </td>
      `;

      body.appendChild(fila);
    });
  }

  /* ==========================================
     CONSULTA DE MATRÍCULAS
     ========================================== */

  function mostrarMatriculas() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const grupoSeleccionado =
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const fechaSeleccionada =
      document.getElementById(
        'consulta-fecha'
      )?.value || '';

    const resultados = matriculas.filter(
      (registro) => {
        const estudiante = `${
          registro.estudiante_nombre ?? ''
        } ${
          registro.estudiante_apellido1 ?? ''
        } ${
          registro.estudiante_apellido2 ?? ''
        }`
          .trim()
          .toLowerCase();

        const grupo = String(
          registro.nombre_grupo ?? ''
        ).toLowerCase();

        const estado = String(
          registro.estado_matricula ?? ''
        ).toLowerCase();
                const fecha = limpiarFecha(
          registro.fecha
        );

        const coincideBusqueda =
          !busqueda ||
          `${estudiante} ${grupo}`.includes(
            busqueda
          );

        const coincideEstado =
          !estadoSeleccionado ||
          estado === estadoSeleccionado;

        const coincideGrupo =
          !grupoSeleccionado ||
          String(registro.id_grupo) ===
            String(grupoSeleccionado);

        const coincideFecha =
          !fechaSeleccionada ||
          fecha === fechaSeleccionada;

        return (
          coincideBusqueda &&
          coincideEstado &&
          coincideGrupo &&
          coincideFecha
        );
      }
    );

    actualizarTitulo(
      'Matrículas registradas',
      resultados.length
    );

    cambiarEncabezado(`
      <tr>
        <th>ID</th>
        <th>Fecha</th>
        <th>Estudiante</th>
        <th>Grupo</th>
        <th>Período</th>
        <th>Tipo</th>
        <th>Estado</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(8);
      return;
    }

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((registro) => {
      const estudiante = `${
        registro.estudiante_nombre ?? ''
      } ${
        registro.estudiante_apellido1 ?? ''
      } ${
        registro.estudiante_apellido2 ?? ''
      }`.trim();

      const estado =
        registro.estado_matricula ||
        'Sin estado';

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>
          ${registro.id_matricula ?? '-'}
        </td>

        <td>
          ${limpiarFecha(registro.fecha)}
        </td>

        <td>
          ${estudiante || '-'}
        </td>

        <td>
          ${registro.nombre_grupo ?? '-'}
        </td>

        <td>
          ${registro.periodo_lectivo ?? '-'} /
          ${registro.anio_lectivo ?? '-'}
        </td>

        <td>
          ${registro.tipo_matricula ?? '-'}
        </td>

        <td>
          <span class="badge bg-primary">
            ${estado}
          </span>
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary consulta-ver-matricula"
            data-id="${registro.id_matricula}">
            <i class="bi bi-file-earmark-text"></i>
              Vista previa
          </button>
        </td>
      `;

      body.appendChild(fila);
    });
  }

  /* ==========================================
     CONSULTA DE ASISTENCIA
     ========================================== */

  function mostrarAsistencias() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const grupoSeleccionado =
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const fechaSeleccionada =
      document.getElementById(
        'consulta-fecha'
      )?.value || '';

    const resultados = asistencias.filter(
      (registro) => {
        const estudiante = `${
          registro.estudiante_nombre ?? ''
        } ${
          registro.estudiante_apellido1 ?? ''
        } ${
          registro.estudiante_apellido2 ?? ''
        }`
          .trim()
          .toLowerCase();

        const profesor = `${
          registro.profesor_nombre ?? ''
        } ${
          registro.profesor_apellido1 ?? ''
        }`
          .trim()
          .toLowerCase();

        const grupo = String(
          registro.nombre_grupo ?? ''
        ).toLowerCase();

        const estado = String(
          registro.estado_asistencia ?? ''
        ).toLowerCase();

        const fecha = limpiarFecha(
          registro.fecha
        );

        const textoCompleto =
          `${estudiante} ${profesor} ${grupo}`;

        const coincideBusqueda =
          !busqueda ||
          textoCompleto.includes(busqueda);

        const coincideEstado =
          !estadoSeleccionado ||
          estado === estadoSeleccionado;

        const coincideGrupo =
          !grupoSeleccionado ||
          String(registro.id_grupo) ===
            String(grupoSeleccionado);

        const coincideFecha =
          !fechaSeleccionada ||
          fecha === fechaSeleccionada;

        return (
          coincideBusqueda &&
          coincideEstado &&
          coincideGrupo &&
          coincideFecha
        );
      }
    );

    actualizarTitulo(
      'Registros de asistencia',
      resultados.length
    );

    cambiarEncabezado(`
      <tr>
        <th>Fecha</th>
        <th>Estudiante</th>
        <th>Grupo</th>
        <th>Profesor</th>
        <th>Estado</th>
        <th>Observaciones</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(7);
      return;
    }

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((registro) => {
      const estudiante = `${
        registro.estudiante_nombre ?? ''
      } ${
        registro.estudiante_apellido1 ?? ''
      } ${
        registro.estudiante_apellido2 ?? ''
      }`.trim();

      const profesor = `${
        registro.profesor_nombre ?? ''
      } ${
        registro.profesor_apellido1 ?? ''
      }`.trim();

      const estado = String(
        registro.estado_asistencia ?? ''
      ).toLowerCase();

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>
          ${limpiarFecha(registro.fecha)}
        </td>

        <td>
          ${estudiante || '-'}
        </td>

        <td>
          ${registro.nombre_grupo ?? '-'}
        </td>

        <td>
          ${profesor || '-'}
        </td>

        <td>
          ${crearBadgeAsistencia(estado)}
        </td>

        <td>
          ${registro.observaciones || '—'}
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary consulta-ver-asistencia"
            data-id="${registro.id_asistencia}">
            <i class="bi bi-file-earmark-text"></i>
              Vista previa
          </button>
        </td>
      `;

      body.appendChild(fila);
    });
  }

  function crearBadgeAsistencia(estado) {
    const configuracion = {
      presente: {
        texto: 'Presente',
        clase: 'bg-success'
      },

      ausente: {
        texto: 'Ausente',
        clase: 'bg-danger'
      },

      tardia: {
        texto: 'Tardía',
        clase: 'bg-warning text-dark'
      },

      justificada: {
        texto: 'Justificada',
        clase: 'bg-primary'
      }
    };

    const opcion =
      configuracion[estado] || {
        texto: estado || 'Sin estado',
        clase: 'bg-secondary'
      };

    return `
      <span class="badge ${opcion.clase}">
        ${opcion.texto}
      </span>
    `;
  }

  /* ==========================================
     FILTROS DE GRUPO, SECCIÓN Y NIVEL
     ========================================== */

  function cargarFiltroGrupos() {
    const select = document.getElementById(
      'consulta-grupo'
    );

    if (!select) return;

    const valorActual = select.value;
    const grupos = new Map();

    estudiantesMatriculados.forEach(
      (registro) => {
        if (
          registro.id_grupo &&
          registro.nombre_grupo
        ) {
          grupos.set(
            String(registro.id_grupo),
            registro.nombre_grupo
          );
        }
      }
    );

    matriculas.forEach((registro) => {
      if (
        registro.id_grupo &&
        registro.nombre_grupo
      ) {
        grupos.set(
          String(registro.id_grupo),
          registro.nombre_grupo
        );
      }
    });

    asistencias.forEach((registro) => {
      if (
        registro.id_grupo &&
        registro.nombre_grupo
      ) {
        grupos.set(
          String(registro.id_grupo),
          registro.nombre_grupo
        );
      }
    });

    select.innerHTML =
      '<option value="">Todos los grupos</option>';

    grupos.forEach((nombre, id) => {
      select.add(
        new Option(nombre, id)
      );
    });

    if (
      grupos.has(String(valorActual))
    ) {
      select.value = valorActual;
    }
  }
    function cargarFiltrosMatriculados() {
    const selectSeccion = document.getElementById(
      'consulta-seccion'
    );

    const selectNivel = document.getElementById(
      'consulta-nivel'
    );

    const valorSeccionActual =
      selectSeccion?.value || '';

    const valorNivelActual =
      selectNivel?.value || '';

    const secciones = new Map();
    const niveles = new Set();

    estudiantesMatriculados.forEach(
      (estudiante) => {
        if (
          estudiante.id_seccion &&
          estudiante.nombre_seccion
        ) {
          secciones.set(
            String(estudiante.id_seccion),
            estudiante.nombre_seccion
          );
        }

        if (estudiante.nivel) {
          niveles.add(
            String(estudiante.nivel)
          );
        }
      }
    );

    if (selectSeccion) {
      selectSeccion.innerHTML =
        '<option value="">Todas las secciones</option>';

      Array.from(secciones.entries())
        .sort((a, b) =>
          a[1].localeCompare(b[1])
        )
        .forEach(([id, nombre]) => {
          selectSeccion.add(
            new Option(nombre, id)
          );
        });

      if (
        secciones.has(
          String(valorSeccionActual)
        )
      ) {
        selectSeccion.value =
          valorSeccionActual;
      }
    }

    if (selectNivel) {
      selectNivel.innerHTML =
        '<option value="">Todos los niveles</option>';

      Array.from(niveles)
        .sort((a, b) =>
          a.localeCompare(
            b,
            'es',
            { numeric: true }
          )
        )
        .forEach((nivel) => {
          selectNivel.add(
            new Option(nivel, nivel)
          );
        });

      if (
        niveles.has(
          String(valorNivelActual)
        )
      ) {
        selectNivel.value =
          valorNivelActual;
      }
    }
  }

  /* ==========================================
     ACCIONES DE LAS TABLAS
     ========================================== */

  async function manejarAccionesTabla(evento) {
    const verEstudiante =
      evento.target.closest(
        '.consulta-ver-estudiante'
      );
    const verMatriculado =
  evento.target.closest(
    '.consulta-ver-matriculado'
  );

    const editarEstudiante =
      evento.target.closest(
        '.consulta-editar-estudiante'
      );

    const verProfesor =
      evento.target.closest(
        '.consulta-ver-profesor'
      );

    const verMatricula =
      evento.target.closest(
        '.consulta-ver-matricula'
      );

    const verAsistencia =
      evento.target.closest(
        '.consulta-ver-asistencia'
      );

    if (verEstudiante) {
      await mostrarDetalleEstudiante(
        verEstudiante.dataset.id
      );
      return;
    }

    if (editarEstudiante) {
      await abrirEdicionEstudiante(
        editarEstudiante.dataset.id
      );
      return;
    }

  if (verMatriculado) {
     mostrarDetalleMatriculado(
    verMatriculado.dataset.estudiante,
    verMatriculado.dataset.matricula
  );
  return;
    }

    if (verProfesor) {
      mostrarDetalleProfesor(
        verProfesor.dataset.id
      );
      return;
    }

    if (verMatricula) {
      mostrarDetalleMatricula(
        verMatricula.dataset.id
      );
      return;
    }

    if (verAsistencia) {
      mostrarDetalleAsistencia(
        verAsistencia.dataset.id
      );
    }
  }

  async function mostrarDetalleEstudiante(id) {
    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
      'Vista previa del estudiante';

    contenido.innerHTML = `
      <div class="text-center py-4 text-muted">
        <span
          class="spinner-border spinner-border-sm me-2">
        </span>
        Cargando información...
      </div>
    `;

    modificar.classList.add('hidden');
    modificar.dataset.id = '';

    abrirModalDetalle();

    try {
      const respuesta = await apiFetch(
        `/api/estudiantes/${id}`
      );

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo obtener la información del estudiante.'
        );
      }

      const estudiante =
        await respuesta.json();
       
      documentoActual = estudiante;
tipoDocumentoActual = 'estudiante';

prepararEncabezadoDocumento(
  'Ficha del estudiante'
);

      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true ||
        estudiante.estado === undefined;

      contenido.innerHTML = `
        <div class="row g-3">


          ${crearCampoDetalle(
            'Identificación',
            estudiante.id_estudiante ??
            estudiante.id ??
            '-'
          )}

          ${crearCampoDetalle(
            'Nombre completo',
            formarNombre(estudiante) || '-'
          )}

          ${crearCampoDetalle(
            'Fecha de nacimiento',
            limpiarFecha(
              estudiante.fecha_nacimiento
            )
          )}

          ${crearCampoDetalle(
            'Fecha de ingreso',
            limpiarFecha(
              estudiante.fecha_ingreso
            )
          )}

          ${crearCampoDetalle(
            'Género',
            mostrarGenero(
              estudiante.genero
            )
          )}

          ${crearCampoDetalle(
            'Estado',
            activo
              ? '<span class="badge bg-success">Activo</span>'
              : '<span class="badge bg-secondary">Inactivo</span>'
          )}

        </div>
      `;

      modificar.dataset.id = id;
      modificar.classList.remove('hidden');
    } catch (error) {
      contenido.innerHTML = `
        <div class="text-center py-4 text-danger">
          <i
            class="bi bi-exclamation-circle fs-2 d-block mb-2">
          </i>
          ${error.message}
        </div>
      `;
    }
  }

  function mostrarDetalleMatriculado(
  idEstudiante,
  idMatricula,
) {
  const registro =
    estudiantesMatriculados.find(
      (item) => {
        const coincideEstudiante =
          String(item.id_estudiante) ===
          String(idEstudiante);

        const coincideMatricula =
          !idMatricula ||
          String(item.id_matricula) ===
          String(idMatricula);

        return (
          coincideEstudiante &&
          coincideMatricula
        );
      }
    );

  const contenido = document.getElementById(
    'consulta-detalle-contenido'
  );

  const titulo = document.getElementById(
    'consulta-detalle-titulo'
  );

  const modificar = document.getElementById(
    'consulta-detalle-modificar'
  );

  if (!contenido || !titulo || !modificar) {
    return;
  }

  titulo.textContent =
    'Vista previa del estudiante matriculado';

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  if (!registro) {
    contenido.innerHTML = `
      <div class="text-center py-5 text-danger">
        <i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>
        No se encontró la información del estudiante matriculado.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  documentoActual = registro;
  tipoDocumentoActual = 'matriculado';

  prepararEncabezadoDocumento(
    'Constancia de estudiante matriculado'
  );

  const activo =
    registro.estado == 1 ||
    registro.estado === true;

  contenido.innerHTML = `
    <div class="consulta-documento-seccion">

      <h3 class="consulta-documento-seccion-titulo">
        Información del estudiante
      </h3>

      <div class="consulta-documento-grid">

        ${crearCampoDetalleDocumento(
          'Identificación',
          registro.id_estudiante ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Nombre completo',
          formarNombre(registro) || '-'
        )}

        ${crearCampoDetalleDocumento(
          'Número de matrícula',
          registro.id_matricula ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Fecha de matrícula',
          limpiarFecha(
            registro.fecha_matricula ||
            registro.fecha_asignacion
          )
        )}

      </div>
    </div>

    <div class="consulta-documento-seccion">

      <h3 class="consulta-documento-seccion-titulo">
        Información académica
      </h3>

      <div class="consulta-documento-grid">

        ${crearCampoDetalleDocumento(
          'Grupo',
          registro.nombre_grupo ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Sección',
          registro.nombre_seccion ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Nivel',
          registro.nivel ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Período lectivo',
          registro.periodo_lectivo ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Estado',
          activo ? 'Activo' : 'Inactivo'
        )}

      </div>
    </div>
  `;

  abrirModalDetalle();
}

  function mostrarDetalleProfesor(id) {
    const profesor = profesores.find(
      (item) => {
        return String(
          item.id_profesor ?? item.id
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
     'Vista previa del profesor';

    modificar.classList.add('hidden');
    modificar.dataset.id = '';

    if (!profesor) {
      contenido.innerHTML = `
        <div class="text-center py-4 text-danger">
          No se encontró la información del profesor.
        </div>
      `;

      abrirModalDetalle();
      return;
    }

    documentoActual = profesor;
tipoDocumentoActual = 'profesor';

prepararEncabezadoDocumento(
  'Ficha del profesor'
);

    const activo =
      profesor.estado == 1 ||
      profesor.estado === true;

    contenido.innerHTML = `
      <div class="row g-3">

        ${crearCampoDetalle(
          'Identificación',
          profesor.id_profesor ??
          profesor.id ??
          '-'
        )}

        ${crearCampoDetalle(
          'Nombre completo',
          formarNombre(profesor) || '-'
        )}

        ${crearCampoDetalle(
          'Materia',
          profesor.materia ??
          'Sin asignar'
        )}

        ${crearCampoDetalle(
          'Fecha de ingreso',
          limpiarFecha(
            profesor.fecha_ingreso
          )
        )}

        ${crearCampoDetalle(
          'Estado',
          activo
            ? '<span class="badge bg-success">Activo</span>'
            : '<span class="badge bg-danger">Inactivo</span>'
        )}

      </div>

      <div class="alert alert-light border mt-4 mb-0 small">
        <i class="bi bi-info-circle me-1"></i>
        La gestión del profesor se realiza desde
        el módulo de Profesores.
      </div>
    `;

    abrirModalDetalle();
  }

  function mostrarDetalleMatricula(id) {
    const registro = matriculas.find(
      (item) => {
        return String(
          item.id_matricula
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
      'Vista previa de la matrícula';

    modificar.classList.add('hidden');
    modificar.dataset.id = '';

    if (!registro) {
      contenido.innerHTML = `
        <div class="text-center py-4 text-danger">
          No se encontró la matrícula.
        </div>
      `;

      abrirModalDetalle();
      return;
    }

    documentoActual = registro;
tipoDocumentoActual = 'matricula';

prepararEncabezadoDocumento(
  'Comprobante de matrícula'
);

    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`.trim();

        contenido.innerHTML = `
      <div class="row g-3">

        ${crearCampoDetalle(
          'Identificación',
          registro.id_matricula ?? '-'
        )}

        ${crearCampoDetalle(
          'Fecha',
          limpiarFecha(registro.fecha)
        )}

        ${crearCampoDetalle(
          'Estudiante',
          estudiante || '-'
        )}

        ${crearCampoDetalle(
          'Grupo',
          registro.nombre_grupo ?? '-'
        )}

        ${crearCampoDetalle(
          'Período',
          `${registro.periodo_lectivo ?? '-'} / ${
            registro.anio_lectivo ?? '-'
          }`
        )}

        ${crearCampoDetalle(
          'Tipo',
          registro.tipo_matricula ?? '-'
        )}

        ${crearCampoDetalle(
          'Estado',
          registro.estado_matricula ?? '-'
        )}

        <div class="col-12">
          <div class="bg-white border rounded p-3">
            <span class="text-muted small d-block mb-1">
              Observaciones
            </span>

            <div class="fw-semibold">
              ${registro.observaciones || 'Sin observaciones'}
            </div>
          </div>
        </div>

      </div>
    `;

    abrirModalDetalle();
  }

  function mostrarDetalleAsistencia(id) {
    const registro = asistencias.find(
      (item) => {
        return String(
          item.id_asistencia
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
     'Vista previa de la asistencia';

    modificar.classList.add('hidden');
    modificar.dataset.id = '';

    if (!registro) {
      contenido.innerHTML = `
        <div class="text-center py-4 text-danger">
          No se encontró el registro de asistencia.
        </div>
      `;

      abrirModalDetalle();
      return;
    }

    documentoActual = registro;
tipoDocumentoActual = 'asistencia';

prepararEncabezadoDocumento(
  'Registro de asistencia'
);

    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`.trim();

    const profesor = `${
      registro.profesor_nombre ?? ''
    } ${
      registro.profesor_apellido1 ?? ''
    }`.trim();

    const estado = String(
      registro.estado_asistencia ?? ''
    ).toLowerCase();

    contenido.innerHTML = `
      <div class="row g-3">

        ${crearCampoDetalle(
          'Identificación',
          registro.id_asistencia ?? '-'
        )}

        ${crearCampoDetalle(
          'Fecha',
          limpiarFecha(registro.fecha)
        )}

        ${crearCampoDetalle(
          'Estudiante',
          estudiante || '-'
        )}

        ${crearCampoDetalle(
          'Grupo',
          registro.nombre_grupo ?? '-'
        )}

        ${crearCampoDetalle(
          'Profesor',
          profesor || '-'
        )}

        ${crearCampoDetalle(
          'Estado',
          crearBadgeAsistencia(estado)
        )}

        <div class="col-12">
          <div class="bg-white border rounded p-3">
            <span class="text-muted small d-block mb-1">
              Observaciones
            </span>

            <div class="fw-semibold">
              ${registro.observaciones || 'Sin observaciones'}
            </div>
          </div>
        </div>

      </div>
    `;

    abrirModalDetalle();
  }

  async function abrirEdicionEstudiante(id) {
    try {
      const respuesta = await apiFetch(
        `/api/estudiantes/${id}`
      );

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo obtener la información del estudiante.'
        );
      }

      const estudiante =
        await respuesta.json();

      const campoId =
        document.getElementById(
          'persona-id'
        );

      if (campoId) {
        campoId.value =
          estudiante.id_estudiante ??
          estudiante.id ??
          '';
      }

      const campoNombre =
        document.getElementById(
          'nombre'
        );

      if (campoNombre) {
        campoNombre.value =
          estudiante.nombre ?? '';
      }

      const campoApellido1 =
        document.getElementById(
          'apellido1'
        );

      if (campoApellido1) {
        campoApellido1.value =
          estudiante.apellido1 ?? '';
      }

      const campoApellido2 =
        document.getElementById(
          'apellido2'
        );

      if (campoApellido2) {
        campoApellido2.value =
          estudiante.apellido2 ?? '';
      }

      const campoNacimiento =
        document.getElementById(
          'fecha_nacimiento'
        );

      if (campoNacimiento) {
        campoNacimiento.value =
          estudiante.fecha_nacimiento
            ? String(
                estudiante.fecha_nacimiento
              ).split('T')[0]
            : '';
      }

      const campoGenero =
        document.getElementById(
          'genero'
        );

      if (campoGenero) {
        campoGenero.value =
          estudiante.genero ?? '';
      }

      const ingreso =
        document.getElementById(
          'persona-fecha-ingreso'
        );

      if (ingreso) {
        ingreso.value =
          estudiante.fecha_ingreso
            ? String(
                estudiante.fecha_ingreso
              ).split('T')[0]
            : '';
      }

      const titulo =
        document.getElementById(
          'persona-form-title'
        );

      if (titulo) {
        titulo.textContent =
          'Editar Estudiante';
      }

      const botonGuardar =
        document.getElementById(
          'persona-submit'
        );

      if (botonGuardar) {
        botonGuardar.innerHTML =
          '<i class="bi bi-check2-circle"></i> Guardar Cambios';
      }

      const modalDetalle =
        document.getElementById(
          'modalDetalleConsulta'
        );

      if (modalDetalle) {
        bootstrap.Modal
          .getInstance(modalDetalle)
          ?.hide();
      }

      const modalEstudiante =
        document.getElementById(
          'modalEstudiante'
        );

      if (modalEstudiante) {
        const instancia =
          bootstrap.Modal.getInstance(
            modalEstudiante
          ) ||
          new bootstrap.Modal(
            modalEstudiante
          );

        instancia.show();
      }
    } catch (error) {
      mostrarMensajeConsulta(
        error.message
      );
    }
  }

  function modificarDesdeDetalle() {
    const boton =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    const id = boton?.dataset.id;

    if (id) {
      abrirEdicionEstudiante(id);
    }
  }

  function abrirModalDetalle() {
    const modal =
      document.getElementById(
        'modalDetalleConsulta'
      );

    if (!modal) return;

    const instancia =
      bootstrap.Modal.getInstance(modal) ||
      new bootstrap.Modal(modal);

    instancia.show();
  }

  function descargarDocumentoPDF() {
  if (!documentoActual || !tipoDocumentoActual) {
    mostrarMensajeConsulta(
      'No hay un documento preparado para descargar.'
    );
    return;
  }

  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {
    mostrarMensajeConsulta(
      'La herramienta para generar PDF no está disponible.'
    );
    return;
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margenIzquierdo = 20;
  const anchoPagina = 210;
  const anchoContenido =
    anchoPagina - margenIzquierdo * 2;

  let posicionY = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(
    'EDUCONTROL',
    margenIzquierdo,
    posicionY
  );

  posicionY += 8;

  pdf.setFontSize(12);
  pdf.text(
    obtenerTituloDocumento(),
    margenIzquierdo,
    posicionY
  );

  posicionY += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Fecha de emisión: ${obtenerFechaActual()}`,
    margenIzquierdo,
    posicionY
  );

  posicionY += 5;

  pdf.line(
    margenIzquierdo,
    posicionY,
    anchoPagina - margenIzquierdo,
    posicionY
  );

  posicionY += 10;

  const campos =
    obtenerCamposDocumentoPDF();

  campos.forEach((campo) => {
    const etiqueta = String(
      campo.etiqueta ?? ''
    );

    const valor = String(
      campo.valor ?? '-'
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(
      `${etiqueta}:`,
      margenIzquierdo,
      posicionY
    );

    posicionY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const lineas = pdf.splitTextToSize(
      limpiarTextoPDF(valor),
      anchoContenido
    );

    pdf.text(
      lineas,
      margenIzquierdo,
      posicionY
    );

    posicionY +=
      lineas.length * 5 + 5;

    if (posicionY > 270) {
      pdf.addPage();
      posicionY = 20;
    }
  });

  pdf.setFontSize(8);
  pdf.setTextColor(100);

  pdf.text(
    'Documento generado digitalmente por EduControl.',
    margenIzquierdo,
    287
  );

  const nombreArchivo =
    obtenerNombreArchivoPDF();

  pdf.save(nombreArchivo);
}

function obtenerTituloDocumento() {
  const titulos = {
    estudiante:
      'Ficha del estudiante',

    matriculado:
    'Constancia de estudiante matriculado',

    profesor:
      'Ficha del profesor',

    matricula:
      'Comprobante de matrícula',

    asistencia:
      'Registro de asistencia'
  };

  return (
    titulos[tipoDocumentoActual] ||
    'Documento académico'
  );
}

function obtenerCamposDocumentoPDF() {
  const registro =
    documentoActual || {};

  if (tipoDocumentoActual === 'estudiante') {
    const activo =
      registro.estado == 1 ||
      registro.estado === true ||
      registro.estado === undefined;

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_estudiante ??
          registro.id ??
          '-'
      },
      {
        etiqueta: 'Nombre completo',
        valor:
          formarNombre(registro) ||
          '-'
      },
      {
        etiqueta: 'Fecha de nacimiento',
        valor:
          limpiarFecha(
            registro.fecha_nacimiento
          )
      },
      {
        etiqueta: 'Fecha de ingreso',
        valor:
          limpiarFecha(
            registro.fecha_ingreso
          )
      },
      {
        etiqueta: 'Género',
        valor:
          mostrarGenero(
            registro.genero
          )
      },
      {
        etiqueta: 'Estado',
        valor:
          activo
            ? 'Activo'
            : 'Inactivo'
      }
    ];if (tipoDocumentoActual === 'matriculado') {
  const activo =
    registro.estado == 1 ||
    registro.estado === true;

  return [
    {
      etiqueta: 'Identificación',
      valor:
        registro.id_estudiante ??
        '-'
    },
    {
      etiqueta: 'Nombre completo',
      valor:
        formarNombre(registro) ||
        '-'
    },
    {
      etiqueta: 'Número de matrícula',
      valor:
        registro.id_matricula ??
        '-'
    },
    {
      etiqueta: 'Fecha de matrícula',
      valor:
        limpiarFecha(
          registro.fecha_matricula ||
          registro.fecha_asignacion
        )
    },
    {
      etiqueta: 'Grupo',
      valor:
        registro.nombre_grupo ??
        '-'
    },
    {
      etiqueta: 'Sección',
      valor:
        registro.nombre_seccion ??
        '-'
    },
    {
      etiqueta: 'Nivel',
      valor:
        registro.nivel ??
        '-'
    },
    {
      etiqueta: 'Período lectivo',
      valor:
        registro.periodo_lectivo ??
        '-'
    },
    {
      etiqueta: 'Estado',
      valor:
        activo
          ? 'Activo'
          : 'Inactivo'
    }
  ];
}
  }


  if (tipoDocumentoActual === 'profesor') {
    const activo =
      registro.estado == 1 ||
      registro.estado === true;

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_profesor ??
          registro.id ??
          '-'
      },
      {
        etiqueta: 'Nombre completo',
        valor:
          formarNombre(registro) ||
          '-'
      },
      {
        etiqueta: 'Materia',
        valor:
          registro.materia ??
          'Sin asignar'
      },
      {
        etiqueta: 'Fecha de ingreso',
        valor:
          limpiarFecha(
            registro.fecha_ingreso
          )
      },
      {
        etiqueta: 'Estado',
        valor:
          activo
            ? 'Activo'
            : 'Inactivo'
      }
    ];
  }

  if (tipoDocumentoActual === 'matricula') {
    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_matricula ??
          '-'
      },
      {
        etiqueta: 'Fecha',
        valor:
          limpiarFecha(
            registro.fecha
          )
      },
      {
        etiqueta: 'Estudiante',
        valor:
          estudiante || '-'
      },
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Período',
        valor:
          `${registro.periodo_lectivo ?? '-'} / ${
            registro.anio_lectivo ?? '-'
          }`
      },
      {
        etiqueta: 'Tipo',
        valor:
          registro.tipo_matricula ??
          '-'
      },
      {
        etiqueta: 'Estado',
        valor:
          registro.estado_matricula ??
          '-'
      },
      {
        etiqueta: 'Observaciones',
        valor:
          registro.observaciones ||
          'Sin observaciones'
      }
    ];
  }

  if (tipoDocumentoActual === 'asistencia') {
    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    const profesor = `${
      registro.profesor_nombre ?? ''
    } ${
      registro.profesor_apellido1 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_asistencia ??
          '-'
      },
      {
        etiqueta: 'Fecha',
        valor:
          limpiarFecha(
            registro.fecha
          )
      },
      {
        etiqueta: 'Estudiante',
        valor:
          estudiante || '-'
      },
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Profesor',
        valor:
          profesor || '-'
      },
      {
        etiqueta: 'Estado',
        valor:
          registro.estado_asistencia ??
          '-'
      },
      {
        etiqueta: 'Observaciones',
        valor:
          registro.observaciones ||
          'Sin observaciones'
      }
    ];
  }

  return [];
}

function obtenerNombreArchivoPDF() {
  const registro =
    documentoActual || {};

  const nombres = {
    estudiante:
      `estudiante-${
        registro.id_estudiante ??
        registro.id ??
        'documento'
      }.pdf`,
    matriculado:
  `estudiante-matriculado-${
    registro.id_estudiante ??
    'documento'
  }.pdf`,

    profesor:
      `profesor-${
        registro.id_profesor ??
        registro.id ??
        'documento'
      }.pdf`,

    matricula:
      `matricula-${
        registro.id_matricula ??
        'documento'
      }.pdf`,

    asistencia:
      `asistencia-${
        registro.id_asistencia ??
        'documento'
      }.pdf`
  };

  return (
    nombres[tipoDocumentoActual] ||
    'documento-academico.pdf'
  );
}

function limpiarTextoPDF(valor) {
  const contenedor =
    document.createElement('div');

  contenedor.innerHTML =
    String(valor ?? '');

  return (
    contenedor.textContent ||
    contenedor.innerText ||
    '-'
  );
}

function obtenerFechaActual() {
  return new Date().toLocaleDateString(
    'es-CR'
  );
}

function prepararEncabezadoDocumento(titulo) {
  const tituloDocumento = document.getElementById(
    'consulta-documento-titulo'
  );

  const subtituloDocumento = document.getElementById(
    'consulta-documento-subtitulo'
  );

  const fechaDocumento = document.getElementById(
    'consulta-documento-fecha'
  );

  if (tituloDocumento) {
    tituloDocumento.textContent =
      titulo || 'Documento académico';
  }

  if (subtituloDocumento) {
    subtituloDocumento.textContent =
      'Sistema de Gestión Escolar';
  }

  if (fechaDocumento) {
    fechaDocumento.textContent =
      obtenerFechaActual();
  }
}

    function crearCampoDetalle(etiqueta, valor) {
    return `
      <div class="col-md-6">
        <div class="bg-white border rounded p-3 h-100">
          <span class="text-muted small d-block mb-1">
            ${etiqueta}
          </span>

          <div class="fw-semibold">
            ${valor}
          </div>
        </div>
      </div>
    `;
  }

  function crearCampoDetalleDocumento(
  etiqueta,
  valor,
  completo = false
) {
  return `
    <div
      class="consulta-documento-campo ${
        completo ? 'completo' : ''
      }">

      <span class="consulta-documento-etiqueta">
        ${etiqueta}
      </span>

      <div class="consulta-documento-valor">
        ${valor ?? '-'}
      </div>

    </div>
  `;
}

  function mostrarGenero(genero) {
    const generos = {
      M: 'Masculino',
      F: 'Femenino',
      O: 'Otro'
    };

    return (
      generos[genero] ||
      genero ||
      '-'
    );
  }

  function mostrarMensajeConsulta(mensaje) {
    if (
      typeof showResultModal ===
      'function'
    ) {
      showResultModal(
        'error',
        'No se pudo realizar la acción',
        mensaje
      );

      return;
    }

    alert(mensaje);
  }

  /* ==========================================
     ESTADOS DE LA TABLA
     ========================================== */

  function mostrarCargando() {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="text-center py-5 text-muted">

          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true">
          </span>

          Cargando información...
        </td>
      </tr>
    `;
  }

  function mostrarError(mensaje) {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="text-center py-5 text-danger">

          <i
            class="bi bi-exclamation-circle fs-2 d-block mb-2">
          </i>

          ${mensaje}
        </td>
      </tr>
    `;
  }

  function mostrarSinResultados(columnas) {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="${columnas}"
          class="text-center py-5 text-muted">

          <i
            class="bi bi-search fs-2 d-block mb-2">
          </i>

          No se encontraron resultados.
        </td>
      </tr>
    `;
  }

  /* ==========================================
     FUNCIONES AUXILIARES
     ========================================== */

  function actualizarTitulo(
    titulo,
    cantidad
  ) {
    const tituloTabla =
      document.getElementById(
        'consulta-titulo-tabla'
      );

    const cantidadTexto =
      document.getElementById(
        'consulta-cantidad'
      );

    if (tituloTabla) {
      tituloTabla.textContent = titulo;
    }

    if (cantidadTexto) {
      const plural =
        cantidad === 1
          ? ''
          : 's';

      cantidadTexto.textContent =
        `${cantidad} resultado${plural} ` +
        `encontrado${plural}`;
    }
  }

  function cambiarEncabezado(contenido) {
    const head =
      document.getElementById(
        'consulta-tabla-head'
      );

    if (head) {
      head.innerHTML = contenido;
    }
  }

  function obtenerBusqueda() {
    return (
      document.getElementById(
        'consulta-busqueda'
      )?.value
        .trim()
        .toLowerCase() ||
      ''
    );
  }

  function obtenerEstado() {
    return (
      document.getElementById(
        'consulta-estado'
      )?.value ||
      ''
    );
  }

  function formarNombre(persona) {
    if (!persona) return '';

    return `${
      persona.nombre ?? ''
    } ${
      persona.apellido1 ?? ''
    } ${
      persona.apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
  }

  function limpiarFecha(fecha) {
    if (!fecha) return '-';

    return String(fecha).split('T')[0];
  }

  /* ==========================================
     NOTIFICAR QUE EL MÓDULO ESTÁ LISTO
     ========================================== */

  if (
    document.readyState !==
    'loading'
  ) {
    window.dispatchEvent(
      new CustomEvent(
        'app:module-ready',
        {
          detail: {
            module: moduleName
          }
        }
      )
    );
  }
})();

(function () {
  const moduleName = 'perfil';
  window.EduControlModules = window.EduControlModules || {};

  let fotoPerfilTemporal = null;
  let perfilActual = null;
  let claveCamposModificados = false;

  window.EduControlModules[moduleName] = {
    name: moduleName,

    init() {
      const section =
        document.getElementById(
          `${moduleName}-view`
        );

      if (!section) {
        return;
      }

      const usuarioSesionId =
        typeof currentUser !== 'undefined'
          ? currentUser?.id_usuario
          : null;

      if (
        section.dataset.usuarioId !==
        String(usuarioSesionId)
      ) {
        section.dataset.wired = '';
      }

      if (
        section.dataset.wired === '1' &&
        section.dataset.usuarioId ===
          String(usuarioSesionId)
      ) {
        return;
      }

      section.dataset.wired = '1';
      section.dataset.usuarioId =
        usuarioSesionId
          ? String(usuarioSesionId)
          : '';
      section.dataset.module =
        moduleName;

      fotoPerfilTemporal = null;
      perfilActual = null;
      window.tempNuevaFoto = null;
      claveCamposModificados = false;

      conectarEventosPerfil();
      cargarMiPerfil();
    }
  };

  function cargarDatosPerfil() {
    const user =
      typeof currentUser !== 'undefined'
        ? currentUser
        : null;

    if (!user) {
      return;
    }

    const inputNombre =
      document.getElementById(
        'perfil-nombre'
      );

    const inputApellido1 =
      document.getElementById(
        'perfil-apellido1'
      );

    const inputApellido2 =
      document.getElementById(
        'perfil-apellido2'
      );

    const inputCorreo =
      document.getElementById(
        'perfil-correo'
      );

    if (inputNombre) {
      inputNombre.value =
        user.nombre || '';
    }

    if (inputApellido1) {
      inputApellido1.value =
        user.apellido1 || '';
    }

    if (inputApellido2) {
      inputApellido2.value =
        user.apellido2 || '';
    }

    if (inputCorreo) {
      inputCorreo.value =
        user.correo || '';
    }

    if (user.foto) {
      actualizarImagenPerfil(
        user.foto
      );
    } else {
      generarAvatarIniciales(
        user
      );
    }
  }

  function actualizarVistaFoto(
    fotoUrlOrBase64
  ) {
    actualizarImagenPerfil(
      fotoUrlOrBase64
    );
  }

  function configurarVisorContrasenas(
    inputId,
    toggleId
  ) {
    const input =
      document.getElementById(
        inputId
      );

    const toggleBtn =
      document.getElementById(
        toggleId
      );

    if (input && toggleBtn) {
      toggleBtn.onclick = () => {
        const esPassword =
          input.type === 'password';

        input.type = esPassword
          ? 'text'
          : 'password';

        const icono =
          toggleBtn.querySelector(
            'i'
          );

        if (icono) {
          icono.className =
            esPassword
              ? 'bi bi-eye-slash'
              : 'bi bi-eye';
        }
      };
    }
  }

  function conectarEventosPerfil() {
    const formulario =
      document.getElementById(
        'perfil-form'
      );

    const inputFoto =
      document.getElementById(
        'perfil-foto-input'
      );

    if (
      formulario &&
      !formulario.dataset.listenerWired
    ) {
      formulario.dataset.listenerWired =
        'true';
      formulario.addEventListener(
        'submit',
        guardarCambiosPerfil
      );
    }

    if (
      inputFoto &&
      !inputFoto.dataset.listenerWired
    ) {
      inputFoto.dataset.listenerWired =
        'true';
      inputFoto.addEventListener(
        'change',
        cambiarVistaPreviaFoto
      );
    }

    [
      'perfil-clave-actual',
      'perfil-clave-nueva',
      'perfil-clave-confirmar'
    ].forEach((id) => {
      const el =
        document.getElementById(
          id
        );
      if (
        el &&
        !el.dataset.listenerWired
      ) {
        el.dataset.listenerWired =
          'true';
        el.addEventListener(
          'input',
          () => {
            claveCamposModificados =
              true;
          }
        );
      }
    });

    configurarVisorContrasenas(
      'perfil-clave-actual',
      'toggle-clave-actual'
    );

    configurarVisorContrasenas(
      'perfil-clave-nueva',
      'toggle-clave-nueva'
    );

    configurarVisorContrasenas(
      'perfil-clave-confirmar',
      'toggle-clave-confirmar'
    );
  }

  async function cargarMiPerfil() {
    mostrarEstadoFormulario(true);

    try {
      const respuesta =
        await apiFetch(
          '/api/usuarios/perfil'
        );

      const datos =
        await obtenerRespuestaJson(
          respuesta
        );

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo cargar la información del perfil.'
        );
      }

      perfilActual = datos;

      llenarFormularioPerfil(
        datos
      );

      actualizarResumenPerfil(
        datos
      );

      cargarFotoSegunUsuario(
        datos
      );
    } catch (error) {
      mostrarMensajePerfil(
        'error',
        'No se pudo cargar el perfil',
        error.message
      );
    } finally {
      mostrarEstadoFormulario(
        false
      );
    }
  }

  function llenarFormularioPerfil(
    perfil
  ) {
    asignarValor(
      'perfil-nombre',
      perfil.nombre
    );

    asignarValor(
      'perfil-apellido1',
      perfil.apellido1
    );

    asignarValor(
      'perfil-apellido2',
      perfil.apellido2
    );

    asignarValor(
      'perfil-correo',
      perfil.correo
    );
  }

  function actualizarResumenPerfil(
    perfil
  ) {
    const nombreCompleto =
      formarNombrePerfil(
        perfil
      ) || 'Usuario';

    const rol =
      perfil.rol ||
      perfil.nom_rol ||
      'Usuario';

    const correo =
      perfil.correo || '-';

    const nombreElemento =
      document.getElementById(
        'perfil-nombre-completo'
      );

    const rolElemento =
      document.getElementById(
        'perfil-rol'
      );

    const correoElemento =
      document.getElementById(
        'perfil-correo-info'
      );

    if (nombreElemento) {
      nombreElemento.textContent =
        nombreCompleto;
    }

    if (rolElemento) {
      rolElemento.textContent =
        rol;
    }

    if (correoElemento) {
      correoElemento.textContent =
        correo;
    }
  }

  async function guardarCambiosPerfil(
    evento
  ) {
    if (
      evento &&
      evento.preventDefault
    ) {
      evento.preventDefault();
    }

    const datosPerfil =
      obtenerDatosFormularioPerfil();

    if (
      !validarDatosPerfil(
        datosPerfil
      )
    ) {
      return;
    }

    const datosClave =
      obtenerDatosSeguridad();

    const deseaCambiarClave =
      claveCamposModificados &&
      Boolean(
        datosClave.claveActual ||
          datosClave.claveNueva ||
          datosClave.claveConfirmar
      );

    mostrarEstadoFormulario(
      true
    );

    try {
      if (
        fotoPerfilTemporal
      ) {
        datosPerfil.foto =
          fotoPerfilTemporal;
      } else if (
        window.tempNuevaFoto
      ) {
        datosPerfil.foto =
          window.tempNuevaFoto;
      }

      const resultadoPerfil =
        await actualizarDatosPersonales(
          datosPerfil
        );

      perfilActual =
        resultadoPerfil.perfil || {
          ...perfilActual,
          ...datosPerfil
        };

      actualizarResumenPerfil(
        perfilActual
      );

      if (deseaCambiarClave) {
        await actualizarClave(
          datosClave
        );

        limpiarCamposClave();
      }

      guardarFotoPerfil();

      if (
        fotoPerfilTemporal
      ) {
        actualizarImagenPerfil(
          fotoPerfilTemporal
        );
      }

      actualizarUsuarioGlobal(
        perfilActual
      );

      mostrarMensajePerfil(
        'success',
        'Perfil actualizado',
        deseaCambiarClave
          ? 'Tus datos y tu clave se actualizaron correctamente.'
          : 'Tus datos se actualizaron correctamente.'
      );
    } catch (error) {
      mostrarMensajePerfil(
        'error',
        'No se pudieron guardar los cambios',
        error.message
      );
    } finally {
      mostrarEstadoFormulario(
        false
      );
    }
  }

  async function actualizarDatosPersonales(
    datosPerfil
  ) {
    const respuesta =
      await apiFetch(
        '/api/usuarios/perfil',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(
            datosPerfil
          )
        }
      );

    const datos =
      await obtenerRespuestaJson(
        respuesta
      );

    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje ||
          'No se pudo actualizar el perfil.'
      );
    }

    return datos;
  }

  async function actualizarClave(
    datosClave
  ) {
    validarDatosClave(
      datosClave
    );

    const respuesta =
      await apiFetch(
        '/api/usuarios/perfil/clave',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(
            datosClave
          )
        }
      );

    const datos =
      await obtenerRespuestaJson(
        respuesta
      );

    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje ||
          'No se pudo actualizar la clave.'
      );
    }

    return datos;
  }

  function obtenerDatosFormularioPerfil() {
    return {
      nombre: obtenerValor(
        'perfil-nombre'
      ).trim(),

      apellido1: obtenerValor(
        'perfil-apellido1'
      ).trim(),

      apellido2: obtenerValor(
        'perfil-apellido2'
      ).trim(),

      correo: obtenerValor(
        'perfil-correo'
      ).trim()
    };
  }

  function obtenerDatosSeguridad() {
    return {
      claveActual: obtenerValor(
        'perfil-clave-actual'
      ),

      claveNueva: obtenerValor(
        'perfil-clave-nueva'
      ),

      claveConfirmar:
        obtenerValor(
          'perfil-clave-confirmar'
        )
    };
  }

  function validarDatosPerfil(
    datos
  ) {
    if (
      !datos.nombre ||
      !datos.apellido1 ||
      !datos.correo
    ) {
      mostrarMensajePerfil(
        'warning',
        'Campos incompletos',
        'Completa el nombre, el primer apellido y el correo.'
      );

      return false;
    }

    const correoValido =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !correoValido.test(
        datos.correo
      )
    ) {
      mostrarMensajePerfil(
        'warning',
        'Correo no válido',
        'Escribe una dirección de correo válida.'
      );

      return false;
    }

    return true;
  }

  function validarDatosClave(
    datos
  ) {
    if (
      !datos.claveActual ||
      !datos.claveNueva ||
      !datos.claveConfirmar
    ) {
      throw new Error(
        'Para cambiar la clave debes completar los tres campos de seguridad.'
      );
    }

    if (
      datos.claveNueva !==
      datos.claveConfirmar
    ) {
      throw new Error(
        'La nueva clave y la confirmación no coinciden.'
      );
    }

    if (
      datos.claveNueva.length <
      8
    ) {
      throw new Error(
        'La nueva clave debe tener al menos 8 caracteres.'
      );
    }
  }

  function cambiarVistaPreviaFoto(
    evento
  ) {
    const archivo =
      evento.target.files?.[0];

    if (!archivo) return;

    if (
      !archivo.type.startsWith(
        'image/'
      )
    ) {
      mostrarMensajePerfil(
        'warning',
        'Archivo no válido',
        'Selecciona una imagen válida.'
      );

      evento.target.value = '';
      return;
    }

    const limiteBytes =
      2 * 1024 * 1024;

    if (
      archivo.size > limiteBytes
    ) {
      mostrarMensajePerfil(
        'warning',
        'Imagen demasiado grande',
        'La fotografía no puede superar 2 MB.'
      );

      evento.target.value = '';
      return;
    }

    const lector =
      new FileReader();

    lector.onload = () => {
      fotoPerfilTemporal =
        lector.result;

      const preview =
        document.getElementById(
          'perfil-foto-preview'
        );

      if (preview) {
        preview.src =
          fotoPerfilTemporal;
      }
    };

    lector.readAsDataURL(
      archivo
    );
  }

  function guardarFotoPerfil() {
    if (
      !fotoPerfilTemporal ||
      !perfilActual?.id_usuario
    ) {
      return;
    }

    try {
      localStorage.setItem(
        obtenerClaveFoto(
          perfilActual.id_usuario
        ),
        fotoPerfilTemporal
      );
    } catch (error) {
      console.warn(
        'No se pudo guardar la fotografía del perfil:',
        error
      );
    }
  }

  function cargarFotoSegunUsuario(perfil) {
    if (!perfil?.id_usuario) {
      return;
    }

    // 1. Prioridad: Foto que devolvió el backend en el perfil
    if (perfil.foto) {
      fotoPerfilTemporal = perfil.foto;
      actualizarImagenPerfil(perfil.foto);
      return;
    }

    // 2. Segunda opción: Foto guardada en localStorage
    try {
      const fotoGuardada = localStorage.getItem(obtenerClaveFoto(perfil.id_usuario));
      if (fotoGuardada) {
        fotoPerfilTemporal = fotoGuardada;
        actualizarImagenPerfil(fotoGuardada);
        return;
      }
    } catch (error) {
      console.warn('No se pudo cargar la fotografía del perfil:', error);
    }

    // 3. Tercera opción: Foto en la sesión global (currentUser)
    if (typeof currentUser !== 'undefined' && currentUser?.foto) {
      fotoPerfilTemporal = currentUser.foto;
      actualizarImagenPerfil(currentUser.foto);
      return;
    }

    // 4. Último recurso: Iniciales
    generarAvatarIniciales(perfil);
  }

  function generarAvatarIniciales(
    perfil
  ) {
    fotoPerfilTemporal = null;
    window.tempNuevaFoto = null;

    const inicialNombre =
      perfil?.nombre?.charAt(
        0
      ) || 'U';

    const inicialApellido =
      perfil?.apellido1?.charAt(
        0
      ) || '';

    const iniciales =
      `${inicialNombre}${inicialApellido}`.toUpperCase();

    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="200"
        height="200">

        <rect
          width="100%"
          height="100%"
          fill="#0f3d6e">
        </rect>

        <text
          x="50%"
          y="53%"
          dominant-baseline="middle"
          text-anchor="middle"
          fill="#ffffff"
          font-family="Arial, sans-serif"
          font-size="72"
          font-weight="700">
          ${iniciales}
        </text>
      </svg>
    `;

    const avatar = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      svg
    )}`;

    const avatarContenedores =
      document.querySelectorAll(
        '#topbar-avatar, #sidebar-avatar, .user-avatar'
      );

    avatarContenedores.forEach(
      (el) => {
        if (
          el.tagName !== 'IMG'
        ) {
          el.style.backgroundImage =
            '';
        }
      }
    );

    actualizarImagenPerfil(
      avatar
    );
  }

  function actualizarImagenPerfil(
    imagen
  ) {
    const preview =
      document.getElementById(
        'perfil-foto-preview'
      );

    if (preview) {
      preview.src = imagen;
    }

    const avatarContenedores =
      document.querySelectorAll(
        '#topbar-avatar, #sidebar-avatar, .user-avatar'
      );

    avatarContenedores.forEach(
      (el) => {
        if (
          el.tagName === 'IMG'
        ) {
          el.src = imagen;
        } else if (el) {
          el.style.backgroundImage = `url(${imagen})`;
          el.style.backgroundSize =
            'cover';
          el.style.backgroundPosition =
            'center';
          el.textContent = '';
        }
      }
    );
  }

  function actualizarUsuarioGlobal(
    perfil
  ) {
    if (
      typeof currentUser ===
        'undefined' ||
      !currentUser
    ) {
      return;
    }

    currentUser.nombre =
      perfil.nombre;

    currentUser.apellido1 =
      perfil.apellido1;

    currentUser.apellido2 =
      perfil.apellido2;

    currentUser.correo =
      perfil.correo;

    if (fotoPerfilTemporal) {
      currentUser.foto =
        fotoPerfilTemporal;
    }

    try {
      localStorage.setItem(
        'currentUser',
        JSON.stringify(
          currentUser
        )
      );

      sessionStorage.setItem(
        'educontrol_usuario',
        JSON.stringify(
          currentUser
        )
      );
    } catch (error) {
      console.warn(
        'No se pudo actualizar el usuario local:',
        error
      );
    }

    actualizarNombreEnInterfaz(
      perfil
    );

    if (
      typeof renderUserInfo ===
      'function'
    ) {
      renderUserInfo();
    }
  }

  function actualizarNombreEnInterfaz(
    perfil
  ) {
    const nombreCompleto =
      formarNombrePerfil(
        perfil
      );

    const selectores = [
      '#user-name',
      '#usuario-nombre',
      '#sidebar-user-name',
      '[data-user-name]'
    ];

    selectores.forEach(
      (selector) => {
        document
          .querySelectorAll(
            selector
          )
          .forEach((elemento) => {
            elemento.textContent =
              nombreCompleto;
          });
      }
    );
  }

  function limpiarCamposClave() {
    claveCamposModificados =
      false;

    asignarValor(
      'perfil-clave-actual',
      ''
    );

    asignarValor(
      'perfil-clave-nueva',
      ''
    );

    asignarValor(
      'perfil-clave-confirmar',
      ''
    );
  }

  function mostrarEstadoFormulario(
    cargando
  ) {
    const formulario =
      document.getElementById(
        'perfil-form'
      );

    const boton =
      formulario?.querySelector(
        'button[type="submit"]'
      );

    formulario
      ?.querySelectorAll(
        'input, button'
      )
      .forEach((elemento) => {
        elemento.disabled =
          cargando;
      });

    if (!boton) return;

    boton.innerHTML = cargando
      ? `
          <span
            class="spinner-border spinner-border-sm me-2">
          </span>
          Guardando...
        `
      : `
          <i class="bi bi-check2-circle"></i>
          Guardar cambios
        `;
  }

  function formarNombrePerfil(
    perfil
  ) {
    return `${
      perfil?.nombre ?? ''
    } ${
      perfil?.apellido1 ?? ''
    } ${
      perfil?.apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
  }

  function obtenerValor(id) {
    return (
      document.getElementById(id)
        ?.value || ''
    );
  }

  function asignarValor(
    id,
    valor
  ) {
    const elemento =
      document.getElementById(
        id
      );

    if (elemento) {
      elemento.value =
        valor ?? '';
    }
  }

  function obtenerClaveFoto(
    idUsuario
  ) {
    return `educontrol-perfil-foto-${idUsuario}`;
  }

  async function obtenerRespuestaJson(
    respuesta
  ) {
    try {
      return (
        await respuesta.json()
      );
    } catch {
      return {};
    }
  }

  function mostrarMensajePerfil(
    tipo,
    titulo,
    mensaje
  ) {
    if (
      typeof showResultModal ===
      'function'
    ) {
      showResultModal(
        tipo,
        titulo,
        mensaje
      );

      return;
    }

    if (
      typeof showToast ===
      'function'
    ) {
      showToast(
        mensaje,
        tipo === 'success'
          ? 'success'
          : 'error'
      );

      return;
    }

    alert(mensaje);
  }

  if (
    document.readyState !==
    'loading'
  ) {
    window.dispatchEvent(
      new CustomEvent(
        'app:module-ready',
        {
          detail: {
            module: moduleName
          }
        }
      )
    );
  }
})();

/* ===== React migration bootstrap ===== */
export function bootLegacyRuntime() {
  try {
    wireLoginScreen();
    restoreAccessibilitySettings();
    initAccessibilityWidget();
    appViewsReady = true;
    restoreSession();
    window.dispatchEvent(new CustomEvent('app:views-ready'));
  } catch (error) {
    console.error('EduControl: no se pudo iniciar el runtime:', error);
  }
}
