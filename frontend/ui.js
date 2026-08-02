// frontend/ui.js

const baseUrl = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://proyecto-vcz6.onrender.com";
const SESSION_KEY = "educontrol_usuario";

let currentUser = null;
let views = [];
let personaForm = null;
let personaTableBody = null;
let appViewsReady = false;

let allPersonas = [];
let allProfesores = [];
let allGrupos = [];
let profesorPendienteId = null;
let estudiantePendienteId = null;
let profesorReintegrarId = null;
let profesorFiltroEstado = 'todos';
let profesorBusqueda = '';

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

  document.body.classList.toggle('is-admin', esAdmin);
  document.body.classList.toggle('is-asistente', !esAdmin && !esProfesor);
  document.body.classList.toggle('is-profesor', esProfesor);

  const assistantBanner = document.getElementById('assistant-permission-notice');
  if (assistantBanner) {
    assistantBanner.classList.toggle('hidden', esAdmin);
  }

  aplicarRestriccionesModulos(rolNormalizado);
}

// Oculta del sidebar los módulos que el rol actual no puede usar todavía.
// Por ahora solo el Profesor tiene módulos apagados; queda listo para sumar más roles/vistas después.
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
   ========================================== */

function initApp() {
  views = document.querySelectorAll('.sidebar button[data-view]');

  personaForm = document.getElementById('persona-form');
  personaTableBody = document.querySelector('#personas-table tbody');
  views.forEach((button) => {
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  });

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

  const gestionGrupoBtn = document.querySelector('[data-bs-target="#modalGestionGrupo"]');
  if (gestionGrupoBtn && !gestionGrupoBtn.dataset.wired) {
    gestionGrupoBtn.dataset.wired = '1';
    gestionGrupoBtn.addEventListener('click', async () => {
      await populateGestionGrupoModal();
      await populateProfesoresSelects(true);
    });
  }

  const grupoProfSearch = document.getElementById('grupo-profesor-search');
  if (grupoProfSearch && !grupoProfSearch.dataset.wired) {
    grupoProfSearch.dataset.wired = '1';
    grupoProfSearch.addEventListener('input', () => {
      filtrarProfesoresGrupo(grupoProfSearch.value);
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
      await cargarDetalleGestionGrupo(Number(gestionGrupoSelect.value));
    });
  }

  const grupoSeccionSearch = document.getElementById('grupo-seccion-search');
  if (grupoSeccionSearch && !grupoSeccionSearch.dataset.wired) {
    grupoSeccionSearch.dataset.wired = '1';
    grupoSeccionSearch.addEventListener('input', () => {
      filtrarSeccionesGrupo(grupoSeccionSearch.value);
    });
  }

  const grupoSeccionSel = document.getElementById('grupo-seccion');
  if (grupoSeccionSel && !grupoSeccionSel.dataset.wired) {
    grupoSeccionSel.dataset.wired = '1';
    grupoSeccionSel.addEventListener('change', () => {
      const hint = document.getElementById('grupo-seccion-empty-hint');
      if (hint) {
        hint.textContent = 'La sección elegida quedará asociada al grupo que crearás.';
      }
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
    btnBorrarSeccion.addEventListener('click', async () => {
      const idSeccion = document.getElementById('seccion-delete-select')?.value;
      if (!idSeccion) {
        showToast('Selecciona una sección para borrar.', 'error');
        return;
      }
      await borrarSeccion(idSeccion);
    });
  }
  setDefaultSeccionPeriodo();

  const asisForm = document.getElementById('asistencia-form');
  if (asisForm && !asisForm.dataset.wired) {
    asisForm.dataset.wired = '1';
    asisForm.addEventListener('submit', handleAsistenciaSubmit);
  }

  const asisGrupoSelEl = document.getElementById('asis-id-grupo');
  if (asisGrupoSelEl && !asisGrupoSelEl.dataset.wired) {
    asisGrupoSelEl.dataset.wired = '1';
    asisGrupoSelEl.addEventListener('change', cargarRosterGrupoAsistencia);
  }

  // --- Filtros del historial de asistencia ---
  const histGrupoSel = document.getElementById('hist-filtro-grupo');
  if (histGrupoSel && !histGrupoSel.dataset.wired) {
    histGrupoSel.dataset.wired = '1';
    histGrupoSel.addEventListener('change', cargarHistorialAsistencia);
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
    histLimpiar.addEventListener('click', () => {
      if (histGrupoSel) histGrupoSel.value = '';
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
      cargarReporteResumen();
    });
  }

  const reportPrint = document.getElementById('report-imprimir-pdf');
  if (reportPrint && !reportPrint.dataset.wired) {
    reportPrint.dataset.wired = '1';
    reportPrint.addEventListener('click', imprimirReportePdf);
  }

  // Ninguno de los dos triggers de BD permite fecha futura (matrícula por
  // sentido común, asistencia por trigger explícito), así que se limita
  // también en el input para no dejar que el usuario ni lo intente.
  const hoyISO = new Date().toISOString().split('T')[0];
  const matFechaInput = document.getElementById('mat-fecha');
  if (matFechaInput) matFechaInput.max = hoyISO;
  const asisFechaInput = document.getElementById('asis-fecha');
  if (asisFechaInput) { asisFechaInput.max = hoyISO; if (!asisFechaInput.value) asisFechaInput.value = hoyISO; }

  const btnAbrirModalGrupo = document.querySelector('[data-bs-target="#modalGrupo"]');
  if (btnAbrirModalGrupo && !btnAbrirModalGrupo.dataset.wired) {
    btnAbrirModalGrupo.dataset.wired = '1';
    btnAbrirModalGrupo.addEventListener('click', () => {
      populateProfesoresSelects();
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

/* ==========================================
   3. MÓDULO DE ESTUDIANTES (PERSONAS)
   ========================================== */

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

/* ==========================================
   4. MÓDULO DE PROFESORES
   ========================================== */

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
        <div class="profesor-actions-inline d-flex justify-content-end align-items-center gap-2 flex-wrap">
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

  if (btnDestituir || btnEliminar || btnReintegrar || btnSustituto) {
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

/* ==========================================
   5. POBLADO DE SELECTS Y OTROS MÓDULOS
   ========================================== */

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

async function loadAsistenciaData() {
  await populateGruposSelects();
  // Si ya había un grupo elegido de una visita anterior a esta vista, refresca su roster;
  // si no, deja los selects de estudiante/profesor deshabilitados hasta que se elija uno.
  await cargarRosterGrupoAsistencia();
  poblarFiltroGrupoHistorial();
  await cargarHistorialAsistencia();
}

async function loadReportesData() {
  await populateGruposSelects();
  poblarFiltroGrupoReportes();
  await cargarReporteResumen();
}

function imprimirReportePdf() {
  const docConstructor = window.jspdf?.jsPDF;
  if (!docConstructor || !window._reportePdfData) {
    document.title = 'Reporte administrativo - PDF';
    window.print();
    return;
  }

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
  doc.text('Reporte administrativo - EduControl', 14, 12);
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

  const metricas = [
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

  if (detalle_por_grupo?.length) {
    const lineasGrupo = detalle_por_grupo.map((grupo) => {
      return `• ${grupo.nombre_grupo ?? '-'} | Sección: ${grupo.nombre_seccion ?? '-'} | Ocupados: ${grupo.ocupados ?? 0} | Capacidad: ${grupo.capacidad ?? 0} | Asistencias: ${grupo.asistencias_registradas ?? 0}`;
    });
    agregarBloque('Detalle por grupo', lineasGrupo);
  }

  if (detalle?.length) {
    const lineasDetalle = detalle.slice(0, 32).map((registro) => {
      const estudiante = `${registro.estudiante_nombre ?? ''} ${registro.estudiante_apellido1 ?? ''} ${registro.estudiante_apellido2 ?? ''}`.trim() || '-';
      const fecha = registro.fecha ? String(registro.fecha).split('T')[0] : '-';
      return `${fecha} | ${estudiante} | ${registro.nombre_grupo ?? '-'} | ${registro.estado_asistencia ?? '-'}`;
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
  const params = new URLSearchParams();
  const idGrupo = document.getElementById('report-filtro-grupo')?.value || '';
  const busqueda = document.getElementById('report-filtro-busqueda')?.value.trim() || '';
  const tipoReporte = document.getElementById('report-filtro-tipo')?.value || 'resumen';
  const estado = document.getElementById('report-filtro-estado')?.value || '';
  const fechaDesde = document.getElementById('report-filtro-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('report-filtro-fecha-hasta')?.value || '';

  if (idGrupo) params.set('id_grupo', idGrupo);
  if (busqueda) params.set('busqueda', busqueda);
  if (tipoReporte) params.set('tipo_reporte', tipoReporte);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);

  try {
    const resumenRes = await apiFetch(`/api/procesos/reportes/resumen?${params.toString()}`);
    const detalleRes = await apiFetch(`/api/procesos/reportes/detalle?${params.toString()}`);

    if (!resumenRes.ok) throw new Error('No se pudo cargar el resumen del reporte');
    if (!detalleRes.ok) throw new Error('No se pudo cargar el detalle del reporte');

    const resumenJson = await resumenRes.json();
    const detalleJson = await detalleRes.json();
    window._reportePdfData = {
      resumen: resumenJson?.resumen || {},
      detalle_por_grupo: resumenJson?.detalle_por_grupo || [],
      detalle: Array.isArray(detalleJson) ? detalleJson : []
    };
    renderReporteResumen(resumenJson);
    renderReporteDetalle(detalleJson);
  } catch (error) {
    console.error('Error cargando reportes', error);
    document.getElementById('report-grupos-body').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar el resumen.</td></tr>';
    document.getElementById('report-detalle-body').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error al cargar el detalle.</td></tr>';
  }
}

function renderReporteResumen(data) {
  const resumen = data?.resumen || {};
  const grupos = data?.detalle_por_grupo || [];

  document.getElementById('report-total-estudiantes').textContent = resumen.total_estudiantes ?? 0;
  document.getElementById('report-total-profesores').textContent = resumen.total_profesores ?? 0;
  document.getElementById('report-total-grupos').textContent = resumen.total_grupos ?? 0;
  document.getElementById('report-tasa-presentismo').textContent = `${resumen.tasa_presentismo ?? 0}%`;
  document.getElementById('report-presentes').textContent = resumen.presentes ?? 0;
  document.getElementById('report-ausentes').textContent = resumen.ausentes ?? 0;
  document.getElementById('report-tardias').textContent = resumen.tardias ?? 0;
  document.getElementById('report-justificadas').textContent = resumen.justificadas ?? 0;

  const body = document.getElementById('report-grupos-body');
  if (!body) return;
  body.innerHTML = '';

  if (!grupos.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No hay grupos con registros en el periodo filtrado.</td></tr>';
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

/**
 * Llena el select "Grupo" de la barra de filtros del historial, reutilizando
 * los grupos ya cargados en allGrupos por populateGruposSelects().
 */
function poblarFiltroGrupoHistorial() {
  const sel = document.getElementById('hist-filtro-grupo');
  if (!sel) return;
  const valorActual = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  allGrupos.forEach((g) => {
    const id = g.id_grupo ?? g.id;
    sel.add(new Option(g.nombre_grupo ?? `Grupo ${id}`, id));
  });
  sel.value = valorActual || '';
}

/**
 * Construye el query string a partir de los valores actuales de la barra
 * de filtros y consulta GET /api/procesos/asistencia, luego renderiza la
 * tabla y las tarjetas de resumen.
 */
async function cargarHistorialAsistencia() {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;

  const idGrupo = document.getElementById('hist-filtro-grupo')?.value || '';
  const estado = document.getElementById('hist-filtro-estado')?.value || '';
  const fechaDesde = document.getElementById('hist-filtro-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('hist-filtro-fecha-hasta')?.value || '';
  const busqueda = document.getElementById('hist-filtro-busqueda')?.value.trim() || '';

  const params = new URLSearchParams();
  if (idGrupo) params.set('id_grupo', idGrupo);
  if (estado) params.set('estado_asistencia', estado);
  if (fechaDesde) params.set('fecha_inicio', fechaDesde);
  if (fechaHasta) params.set('fecha_fin', fechaHasta);
  if (busqueda) params.set('busqueda', busqueda);

  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Cargando historial...</td></tr>';

  try {
    const res = await apiFetch(`/api/procesos/asistencia?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo cargar el historial de asistencia');
    const registros = await res.json();
    renderHistorialAsistencia(registros);
    actualizarStatsHistorial(registros);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Error al cargar el historial.</td></tr>';
    actualizarStatsHistorial([]);
    console.error('Error cargando historial de asistencia', error);
  }
}

function renderHistorialAsistencia(registros) {
  const tbody = document.getElementById('asistencia-historial-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!registros.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5">
          <i class="bi bi-calendar-x display-6 text-muted d-block mb-2"></i>
          <span class="text-muted">No hay registros de asistencia con estos filtros.</span>
        </td>
      </tr>
    `;
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  registros.forEach((r) => {
    const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
    const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''}`.trim();
    const fecha = r.fecha ? String(r.fecha).split('T')[0] : '-';
    const estado = (r.estado_asistencia || '').toLowerCase();
    const etiqueta = etiquetasEstado[estado] || r.estado_asistencia || '-';
    const observaciones = r.observaciones ? r.observaciones : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${estudiante || '-'}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor || '-'}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiqueta}</span></td>
      <td class="observaciones-cell" title="${observaciones}">${observaciones}</td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarStatsHistorial(registros) {
  const total = registros.length;
  const presentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'presente').length;
  const ausentes = registros.filter((r) => (r.estado_asistencia || '').toLowerCase() === 'ausente').length;
  const otros = total - presentes - ausentes; // tardía + justificada

  const setTexto = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  setTexto('hist-stat-total', total);
  setTexto('hist-stat-presente', presentes);
  setTexto('hist-stat-ausente', ausentes);
  setTexto('hist-stat-otros', otros);
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
        const text = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
        matSel.add(new Option(text, id));
      });
    }
  } catch (error) {
    console.error('Error poblando estudiantes', error);
  }
}

/**
 * Carga el roster real de un grupo (estudiantes matriculados + profesor(es)
 * asignados) y llena los selects de Asistencia. /api/estudiantes NO sirve aquí
 * porque esa lista es solo el pre-registro de pendientes de matricular.
 */
async function cargarRosterGrupoAsistencia() {
  const grupoSel = document.getElementById('asis-id-grupo');
  const personaSel = document.getElementById('asis-persona');
  const profesorSel = document.getElementById('asis-id-profesor');
  const hint = document.getElementById('asis-grupo-hint');
  if (!grupoSel || !personaSel || !profesorSel) return;

  const idGrupo = parseInt(grupoSel.value, 10);
  if (!idGrupo) {
    personaSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Primero selecciona un grupo</option>';
    personaSel.disabled = true;
    profesorSel.disabled = true;
    return;
  }

  personaSel.innerHTML = '<option value="" disabled selected>Cargando...</option>';
  profesorSel.innerHTML = '<option value="" disabled selected>Cargando...</option>';

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}/detalle`);
    if (!res.ok) throw new Error('No se pudo cargar el grupo');
    const detalle = await res.json();

    personaSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
    (detalle.estudiantes || []).forEach((e) => {
      const texto = `${e.nombre ?? ''} ${e.apellido1 ?? ''} ${e.apellido2 ?? ''}`.trim();
      personaSel.add(new Option(texto, e.id_estudiante));
    });
    personaSel.disabled = (detalle.estudiantes || []).length === 0;

    profesorSel.innerHTML = '<option value="" disabled selected>Seleccionar profesor</option>';
    (detalle.profesores || []).forEach((p) => {
      const texto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} (${p.materia || 'General'})`.trim();
      profesorSel.add(new Option(texto, p.id_profesor));
    });
    profesorSel.disabled = (detalle.profesores || []).length === 0;
    // Si solo hay un profesor asignado al grupo (lo normal), se autoselecciona.
    if ((detalle.profesores || []).length === 1) {
      profesorSel.value = detalle.profesores[0].id_profesor;
    }

    if (hint) {
      if ((detalle.estudiantes || []).length === 0) {
        hint.textContent = 'Este grupo todavía no tiene estudiantes matriculados.';
        hint.classList.add('text-danger');
      } else if ((detalle.profesores || []).length === 0) {
        hint.textContent = 'Este grupo no tiene un profesor asignado activo.';
        hint.classList.add('text-danger');
      } else {
        hint.textContent = '';
        hint.classList.remove('text-danger');
      }
    }
  } catch (error) {
    console.error('Error cargando roster del grupo', error);
    personaSel.innerHTML = '<option value="" disabled selected>Error al cargar</option>';
    profesorSel.innerHTML = '<option value="" disabled selected>Error al cargar</option>';
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
    const nombre = (option.dataset.nombre || option.textContent || '').toLowerCase();
    const coincide = !busqueda || nombre.includes(busqueda);
    option.hidden = !coincide;
  });

  const primerVisible = Array.from(select.options).find((option) => !option.hidden && option.value !== '');
  if (primerVisible) {
    select.value = primerVisible.value;
  }
}

function actualizarInfoCupoGrupo() {
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
}

async function borrarSeccion(idSeccion) {
  try {
    const res = await apiFetch(`/api/procesos/secciones/${idSeccion}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo borrar la sección.', 'error');
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

    const profesorActivo = (json.profesores || []).find((p) => p?.id_profesor);
    if (profesorActivo) {
      profSelect.value = String(profesorActivo.id_profesor);
    }
  } catch (error) {
    console.error('Error cargando detalle del grupo', error);
  }
}

async function handleGestionGrupoSubmit(e) {
  e.preventDefault();

  const idGrupo = Number(document.getElementById('gestion-grupo-select')?.value || 0);
  const capacidad = Number(document.getElementById('gestion-grupo-capacidad')?.value || 0);
  const aula = document.getElementById('gestion-grupo-aula')?.value.trim() || null;
  const idProfesor = Number(document.getElementById('gestion-grupo-profesor')?.value || 0);

  if (!idGrupo || !capacidad || !idProfesor) {
    showToast('Selecciona un grupo, capacidad y profesor.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacidad, aula, id_profesor: idProfesor })
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
  const id_grupo = parseInt(grupoSelect.value, 10);
  const grupoSeleccionado = allGrupos.find((g) => (g.id_grupo ?? g.id) === id_grupo);

  const fechaInput = document.getElementById('mat-fecha').value;
  const fecha = fechaInput || new Date().toISOString().split('T')[0];

  // El año lectivo se toma del grupo elegido (ligado a su sección), no de la
  // fecha del día: una matrícula debe registrarse en el año lectivo del
  // grupo/sección, que no siempre coincide con el año calendario actual.
  const anio = grupoSeleccionado?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

  const payload = {
    fecha,
    // sp_registrar_matricula espera periodo_lectivo como SMALLINT (trimestre), no el nombre del mes.
    periodo: parseInt(document.getElementById('mat-periodo').value, 10),
    anio,
    tipo: document.getElementById('mat-tipo').value,
    // estado_matricula es VARCHAR(20): se fija un valor real de negocio, no un número.
    estado: 'activa',
    // p_observaciones del SP es VARCHAR(20): el input ya tiene maxlength=20,
    // pero se recorta también aquí por seguridad si el navegador lo ignora.
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
      await populatePersonaSelects(); // el estudiante ya matriculado debe salir del select
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
  const payload = {
    nombre_grupo: document.getElementById('grupo-nombre').value.trim(),
    capacidad: parseInt(document.getElementById('grupo-capacidad').value, 10),
    aula: document.getElementById('grupo-aula').value.trim() || null,
    id_profesor: parseInt(document.getElementById('grupo-profesor').value, 10),
    id_seccion: parseInt(document.getElementById('grupo-seccion').value, 10)
  };

  try {
    const res = await apiFetch('/api/procesos/grupos', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      showToast('Grupo creado correctamente');
      const modalEl = document.getElementById('modalGrupo');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('grupo-form').reset();
      await populateGruposSelects();
    } else {
      const json = await res.json().catch(() => ({}));
      showToast(json.error || json.mensaje || 'Error creando grupo', 'error');
    }
  } catch {
    showToast('Error creando grupo', 'error');
  }
}

async function handleSeccionSubmit(e) {
  e.preventDefault();
  // seccionService.js espera { nombre, nivel, anio_lectivo, descripcion } — NO
  // { nombre_seccion, periodo_lectivo } como en mi primera versión de este módulo.
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
    
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Asistencia guardada correctamente');
      // Se conserva el grupo elegido (lo normal es pasar lista a varios
      // estudiantes seguidos del mismo grupo) y solo se limpian estudiante y observaciones.
      document.getElementById('asis-observaciones').value = '';
      personaSel.value = '';
      await cargarHistorialAsistencia();
    } else {
      showToast(json.error || json.mensaje || 'Error guardando asistencia', 'error');
    }
  } catch {
    showToast('Error guardando asistencia', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Guardar Asistencia'; }
  }
}

/* ==========================================
   6. UI Y NOTIFICACIONES
   ========================================== */

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