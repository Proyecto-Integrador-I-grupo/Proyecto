import { apiFetch, showToast, currentUser } from './ui.js';
import { populateGruposSelects, allGrupos } from './matricula.js';

const MODOS = {
  matricula: { tipo: 'resumen', filtros: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Estudiante / ID', placeholder: 'Nombre, apellido o ID', titulo: 'Reporte de matrícula' },
  estudiantes: { tipo: 'individual', filtros: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'], label: 'Estudiante / ID', placeholder: 'Nombre, apellido o ID del estudiante', titulo: 'Reporte de estudiantes' },
  grupos: { tipo: 'grupo', filtros: ['grupo', 'fecha-desde', 'fecha-hasta'], label: 'Grupo', placeholder: 'Grupo', titulo: 'Reporte de grupos' },
  profesores: { tipo: 'resumen', filtros: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Profesor / ID', placeholder: 'Nombre, apellido o ID del profesor', titulo: 'Reporte de profesores' },
  pre_matricula: { tipo: 'resumen', filtros: ['busqueda'], label: 'Estudiante / ID', placeholder: 'Nombre, apellido o ID del pre-registro', titulo: 'Reporte de pre-matrículas' },
  pagos: { tipo: 'resumen', filtros: ['estado', 'busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Estudiante / Factura', placeholder: 'Nombre del estudiante o número de factura', titulo: 'Reporte de pagos' },
  auditoria: { tipo: 'detalle', filtros: ['busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Auditoría / Acción', placeholder: 'Tabla, usuario, acción o contenido del cambio', titulo: 'Reporte de auditoría' }
};

const ESTADOS_ASISTENCIA = ['presente', 'ausente', 'tardia', 'justificada'];
const ESTADOS_ACTIVO = ['activo', 'inactivo'];
const ESTADOS_PAGO = ['pendiente', 'parcial', 'pagado', 'facturado', 'anulado'];
const TIPOS_REPORTE = ['resumen', 'detalle', 'individual', 'grupo'];
const REPORTE_LOGO_SRC = '/images/logo1.jpg';
let consultaAplicada = false;
let reporteActual = null;
let reporteLogoDataUrlPromise = null;
let reporteCargando = false;
let timerCargaAutomatica = null;

const MODOS_POR_ROL = {
  administrador: ['matricula', 'estudiantes', 'grupos', 'profesores', 'pre_matricula', 'pagos', 'auditoria'],
  asistente: ['matricula', 'estudiantes', 'grupos', 'pre_matricula', 'pagos'],
  profesor: ['estudiantes', 'grupos']
};


function textoPdfSeguro(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/₡/g, 'CRC ')
    .replace(/[•·]/g, ' - ')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function monedaPdf(value) {
  const number = Number(value || 0);
  return `CRC ${number.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function obtenerRolActual() {
  return String(currentUser?.rol || '').toLowerCase().trim();
}

function esProfesorActual() {
  return obtenerRolActual() === 'profesor';
}

function etiquetaGrupo(grupo = {}) {
  const nombre = String(grupo.nombre_grupo || grupo.grupo || 'Grupo').trim();
  const seccion = String(grupo.nombre_seccion || '').trim();
  const nivel = String(grupo.nivel || '').trim();
  const seccionTexto = seccion
    ? (/secci[oó]n/i.test(seccion) ? seccion : `Sección ${seccion}`)
    : '';

  if (seccionTexto && nivel && seccion.toLowerCase() !== nivel.toLowerCase()) {
    return `${nombre} · ${seccionTexto} · Nivel ${nivel}`;
  }
  if (seccionTexto) return `${nombre} · ${seccionTexto}`;
  if (nivel) return `${nombre} · Nivel ${nivel}`;
  return nombre;
}

function modosPermitidosActuales() {
  return MODOS_POR_ROL[obtenerRolActual()] || [];
}

function aplicarPermisosReportes() {
  const permitidos = modosPermitidosActuales();

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    const permitido = permitidos.includes(button.dataset.reportMode);
    button.hidden = !permitido;
    button.disabled = !permitido;
  });

  const actual = obtenerModoReporteActivo();
  if (!permitidos.includes(actual)) {
    const inicial = permitidos[0] || 'estudiantes';
    cambiarModoReporte(inicial);
    return inicial;
  }

  return actual;
}

(function registerModule() {
  const moduleName = 'reportes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = { name: moduleName, init: wireReportesEvents, load: loadReportesData };
  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

async function loadReportesData() {
  aplicarPermisosReportes();

  try {
    await populateGruposSelects();
  } catch (error) {
    console.warn('No se pudieron cargar los grupos para reportes:', error);
  }

  poblarFiltroGrupoReportes();

  const permitidos = modosPermitidosActuales();
  const inicial = permitidos.includes(obtenerModoReporteActivo())
    ? obtenerModoReporteActivo()
    : (permitidos[0] || 'estudiantes');

  limpiarFiltrosReporte(inicial);
  cambiarModoReporte(inicial);
  resetearDatosReporte();
  window.setTimeout(() => {
    if (!reporteCargando) cargarReporte();
  }, 0);
}

function wireReportesEvents() {
  wireClick('report-limpiar', limpiarReporte);
  wireClick('report-vista-previa', abrirVistaPreviaReporte);
  wireClick('report-imprimir-pdf', imprimirReportePdf);

  activarCargaAutomaticaReportes();

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      const modo = button.dataset.reportMode || 'matricula';
      if (!modosPermitidosActuales().includes(modo)) {
        showToast('No tienes permiso para este tipo de reporte.', 'error');
        return;
      }
      limpiarFiltrosReporte(modo);
      cambiarModoReporte(modo);
      resetearDatosReporte();
      window.setTimeout(() => {
        if (!reporteCargando) cargarReporte();
      }, 0);
    });
  });

  const previewPdf = document.getElementById('preview-generar-pdf');
  if (previewPdf && !previewPdf.dataset.wired) {
    previewPdf.dataset.wired = '1';
    previewPdf.addEventListener('click', () => {
      const modalEl = document.getElementById('modalPreviewReporte');
      if (modalEl && window.bootstrap?.Modal) window.bootstrap.Modal.getInstance(modalEl)?.hide();
      imprimirReportePdf();
    });
  }

  ['report-filtro-fecha-desde', 'report-filtro-fecha-hasta'].forEach((id) => {
    const input = document.getElementById(id);
    if (input && !input.dataset.wired) {
      input.dataset.wired = '1';
      input.addEventListener('change', () => {
        validarRangoFechasEnUI();
      });
    }
  });

  ['report-filtro-grupo', 'report-filtro-tipo', 'report-filtro-estado'].forEach((id) => {
    const select = document.getElementById(id);
    if (select && !select.dataset.wired) {
      select.dataset.wired = '1';
      select.addEventListener('change', () => {
        limpiarError();
      });
    }
  });

  const search = document.getElementById('report-filtro-busqueda');
  if (search && !search.dataset.wired) {
    search.dataset.wired = '1';
    search.addEventListener('input', () => {
      if (search.value.length > 120) search.value = search.value.slice(0, 120);
      limpiarError();
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') cargarReporte();
    });
  }
}

function wireClick(id, handler) {
  const el = document.getElementById(id);
  if (!el || el.dataset.wired) return;
  el.dataset.wired = '1';
  el.addEventListener('click', handler);
}

function activarCargaAutomaticaReportes() {
  const ids = ['report-filtro-grupo', 'report-filtro-busqueda', 'report-filtro-tipo', 'report-filtro-estado', 'report-filtro-fecha-desde', 'report-filtro-fecha-hasta'];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.autoWire === '1') return;
    el.dataset.autoWire = '1';

    const manejarCambio = () => {
      if (id === 'report-filtro-busqueda' && el.value.length > 120) {
        el.value = el.value.slice(0, 120);
      }

      limpiarError();
      if (timerCargaAutomatica) window.clearTimeout(timerCargaAutomatica);
      timerCargaAutomatica = window.setTimeout(() => {
        if (reporteCargando) return;
        cargarReporte();
      }, 350);
    };

    if (el.tagName === 'INPUT') {
      el.addEventListener('input', manejarCambio);
    }
    el.addEventListener('change', manejarCambio);
  });
}

function cambiarModoReporte(modo = 'matricula') {
  const permitidos = modosPermitidosActuales();
  const solicitado = MODOS[modo] ? modo : (permitidos[0] || 'estudiantes');
  const actual = permitidos.includes(solicitado) ? solicitado : (permitidos[0] || 'estudiantes');
  const config = MODOS[actual];

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === actual);
    button.setAttribute('aria-pressed', String(button.dataset.reportMode === actual));
  });

  document.querySelectorAll('.report-filter-field').forEach((field) => {
    field.classList.toggle('is-hidden', !config.filtros.includes(field.dataset.filter));
  });

  const tipo = document.getElementById('report-filtro-tipo');
  if (tipo) tipo.value = '';
  const label = document.getElementById('report-busqueda-label');
  if (label) label.textContent = config.label;
  const input = document.getElementById('report-filtro-busqueda');
  if (input) input.placeholder = config.placeholder;
  actualizarOpcionesEstado(actual);
  const title = document.querySelector('#reportes-view .card-title-serif');
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${config.titulo}`;

  actualizarResumenTexto();
  limpiarError();
  return actual;
}

function actualizarOpcionesEstado(modo = obtenerModoReporteActivo()) {
  const select = document.getElementById('report-filtro-estado');
  const label = document.getElementById('report-estado-label');
  if (!select) return;

  const valorActual = String(select.value || '').toLowerCase();
  const esMatricula = modo === 'matricula';
  const esPagos = modo === 'pagos';
  const opciones = esMatricula
    ? [
      { value: '', label: '--Seleccionar--' },
      { value: 'activo', label: 'Activo' },
      { value: 'inactivo', label: 'Inactivo' }
    ]
    : esPagos
      ? [
        { value: '', label: 'Todos los movimientos' },
        { value: 'pendiente', label: 'Pendiente de pago' },
        { value: 'parcial', label: 'Pago parcial' },
        { value: 'pagado', label: 'En facturación automática' },
        { value: 'facturado', label: 'Facturado' },
        { value: 'anulado', label: 'Anulado' }
      ]
      : [
        { value: '', label: 'Todos los estados' },
        { value: 'presente', label: 'Presente' },
        { value: 'ausente', label: 'Ausente' },
        { value: 'tardia', label: 'Tardía' },
        { value: 'justificada', label: 'Justificada' }
      ];

  if (label) {
    label.textContent = esMatricula ? 'Estado del estudiante' : esPagos ? 'Estado del pago' : 'Estado de asistencia';
  }

  select.innerHTML = opciones.map((opcion) => `<option value="${opcion.value}">${opcion.label}</option>`).join('');
  if (opciones.some((opcion) => opcion.value === valorActual)) {
    select.value = valorActual;
  } else {
    select.value = '';
  }
}

function obtenerModoReporteActivo() {
  return document.querySelector('[data-report-mode].active')?.dataset.reportMode || 'matricula';
}

function obtenerFiltrosActivos() {
  const modo = obtenerModoReporteActivo();
  const estadoValor = document.getElementById('report-filtro-estado')?.value || '';
  return {
    id_grupo: document.getElementById('report-filtro-grupo')?.value || '',
    busqueda: document.getElementById('report-filtro-busqueda')?.value.trim() || '',
    tipo_reporte: document.getElementById('report-filtro-tipo')?.value || '',
    estado_asistencia: estadoValor,
    estado_pago: modo === 'pagos' ? estadoValor : '',
    fecha_inicio: document.getElementById('report-filtro-fecha-desde')?.value || '',
    fecha_fin: document.getElementById('report-filtro-fecha-hasta')?.value || '',
    modo
  };
}

function validarFiltros(filtros) {
  const modo = filtros.modo || obtenerModoReporteActivo();
  const estadoValor = modo === 'pagos' ? (filtros.estado_pago || filtros.estado_asistencia || '') : (filtros.estado_asistencia || '');

  if (filtros.fecha_inicio && filtros.fecha_fin && filtros.fecha_inicio > filtros.fecha_fin) return 'La fecha de inicio no puede ser mayor que la fecha fin.';
  if ((filtros.busqueda || '').length > 120) return 'La búsqueda no puede superar 120 caracteres.';
  if (estadoValor) {
    if (modo === 'matricula' && !ESTADOS_ACTIVO.includes(estadoValor)) return 'El estado del estudiante seleccionado no es válido.';
    if (modo === 'pagos' && !ESTADOS_PAGO.includes(estadoValor)) return 'El estado del pago seleccionado no es válido.';
    if (modo !== 'matricula' && modo !== 'pagos' && !ESTADOS_ASISTENCIA.includes(estadoValor)) return 'El estado de asistencia seleccionado no es válido.';
  }
  if (filtros.tipo_reporte && !TIPOS_REPORTE.includes(filtros.tipo_reporte)) return 'El tipo de reporte seleccionado no es válido.';
  if (!MODOS[filtros.modo]) return 'El modo de reporte seleccionado no es válido.';
  return '';
}

function validarRangoFechasEnUI() {
  const error = validarFiltros(obtenerFiltrosActivos());
  if (error) mostrarError(error); else limpiarError();
}

function mostrarError(message) {
  const box = document.getElementById('report-filtro-error');
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

function limpiarError() {
  const box = document.getElementById('report-filtro-error');
  if (!box) return;
  box.textContent = '';
  box.hidden = true;
}

async function cargarReporte() {
  const filtros = obtenerFiltrosActivos();
  const error = validarFiltros(filtros);
  if (error) { mostrarError(error); showToast(error, 'error'); return; }

  limpiarError();
  reporteCargando = true;

  try {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
    const response = await apiFetch(`/api/procesos/reportes/caso?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.mensaje || data.message || 'No se pudo generar el reporte.');

    reporteActual = {
      modo: data?.modo || filtros.modo,
      resumen: data?.resumen || {},
      detalle_por_grupo: Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [],
      detalle: Array.isArray(data?.detalle) ? data.detalle : [],
      filtros: data?.filtros || filtros
    };
    window._reportePdfData = reporteActual;
    consultaAplicada = true;
    renderTablaPrincipal(reporteActual);
    renderEmptyState(reporteActual);
    actualizarResumenTexto(reporteActual);
    showToast('Reporte generado correctamente.', 'success');
  } catch (error) {
    consultaAplicada = false;
    reporteActual = null;
    window._reportePdfData = null;
    renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
    renderEmptyState({ detalle_por_grupo: [], detalle: [] }, error.message);
    actualizarResumenTexto(null, error.message);
    showToast(error.message || 'No se pudo generar el reporte.', 'error');
  } finally {
    reporteCargando = false;
  }
}

function limpiarFiltrosReporte(modo = obtenerModoReporteActivo()) {
  const values = {
    'report-filtro-grupo': '', 'report-filtro-busqueda': '', 'report-filtro-tipo': '',
    'report-filtro-estado': '', 'report-filtro-fecha-desde': '', 'report-filtro-fecha-hasta': ''
  };
  Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
  limpiarError();
}

function limpiarReporte() {
  const modo = obtenerModoReporteActivo();
  limpiarFiltrosReporte(modo);
  cambiarModoReporte(modo);
  resetearDatosReporte();
}

function resetearDatosReporte() {
  consultaAplicada = false;
  reporteActual = null;
  window._reportePdfData = null;
  renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
  renderEmptyState(null);
  actualizarResumenTexto();
}

function obtenerFilasReporte(data = reporteActual, modo = obtenerModoReporteActivo()) {
  if (['profesores', 'estudiantes', 'grupos'].includes(modo)) {
    return Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  }
  return Array.isArray(data?.detalle) ? data.detalle : [];
}

function actualizarResumenTexto(data = reporteActual, error = '') {
  const el = document.getElementById('report-result-summary');
  if (!el) return;

  if (error) {
    el.textContent = error;
    return;
  }

  if (!consultaAplicada || !data) {
    el.textContent = 'Selecciona los filtros para una búsqueda más precisa.';
    return;
  }

  const count = obtenerFilasReporte(data).length;
  el.textContent = `${count} resultado${count === 1 ? '' : 's'} con los filtros aplicados.`;
}

function renderEmptyState(data, errorMessage = '') {
  const box = document.getElementById('report-empty-state');
  const message = document.getElementById('report-empty-message');
  if (box) box.hidden = true;
  if (message) message.textContent = '';

  if (!consultaAplicada && !errorMessage) return;

  if (errorMessage) {
    const el = document.getElementById('report-result-summary');
    if (el) el.textContent = errorMessage;
    return;
  }

  if (!obtenerFilasReporte(data).length) {
    const el = document.getElementById('report-result-summary');
    if (el) el.textContent = obtenerMensajeSinDatos();
  }
}

function obtenerMensajeSinDatos() {
  const modo = obtenerModoReporteActivo();
  const busqueda = document.getElementById('report-filtro-busqueda')?.value.trim() || '';
  if (!consultaAplicada) return 'Aún no hay consulta.';
  if (modo === 'pre_matricula' && !busqueda) return 'No hay estudiantes pendientes de matrícula.';
  if (modo === 'auditoria' && !busqueda) return 'No hay registros de auditoría disponibles.';
  if (modo === 'matricula' && busqueda) return 'No se encontraron estudiantes matriculados con ese criterio.';
  if (modo === 'estudiantes' && busqueda) return 'No se encontraron estudiantes ni relaciones con profesores para ese criterio.';
  if (modo === 'profesores' && busqueda) return 'No se encontraron profesores con ese criterio.';
  return busqueda ? 'No se encontraron registros con el criterio de búsqueda.' : 'No se encontraron resultados con esos filtros.';
}

function renderTablaPrincipal(data = {}) {
  const body = document.getElementById('report-grupos-body');
  const head = document.getElementById('report-tabla-head');
  if (!body || !head) return;
  const modo = obtenerModoReporteActivo();
  const agrupado = obtenerFilasReporte(data, 'grupos');
  const detalle = obtenerFilasReporte(data, 'matricula');

  if (modo === 'pre_matricula') {
    head.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>';
    renderRows(body, detalle, r => [fullName(r), r.id_estudiante ?? '-', normalizarEstadoActivo(r.estado), 'Pre-matrícula']); return;
  }
  if (modo === 'pagos') {
    head.innerHTML = '<th>Estudiante</th><th>Concepto / servicio</th><th>Factura</th><th>Fecha</th><th>Monto</th><th>Saldo</th><th>Estado</th>';
    renderRows(body, detalle, r => [fullName(r), r.descripcion || '-', r.id_factura_externa ?? '-', formatDate(r.fecha || r.fecha_emision), monedaPdf(r.total ?? 0), monedaPdf(r.saldo ?? 0), formatearEstadoPago(r.estado_pago || r.estado_cargo)]); return;
  }
  if (modo === 'auditoria') { renderAuditoria(body, head, detalle, false); return; }
  if (modo === 'estudiantes') {
    renderEstudiantesReporte(body, head, agrupado);
    return;
  }
  if (modo === 'profesores') {
    head.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Estudiantes</th><th>Estado</th>';
    renderRows(body, agrupado, r => [fullName(r, 'profesor'), r.materia ?? r.materia_curso ?? '-', r.grupos ?? r.grupo ?? '-', r.secciones ?? r.seccion ?? '-', r.estudiantes_asociados ?? 0, normalizarEstadoActivo(r.estado ?? r.profesor_estado)]); return;
  }
  if (modo === 'grupos') {
    head.innerHTML = '<th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderRows(body, agrupado, r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0, r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]); return;
  }
  head.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor(es)</th><th>Estado estudiante</th>';
  renderRows(body, detalle, r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), normalizarEstadoActivo(r.estudiante_estado ?? r.estado_estudiante ?? r.estado)]);
}

function renderEstudiantesReporte(body, head, rows = []) {
  const profesor = esProfesorActual();
  head.innerHTML = `<th>Estudiante</th><th>Grupo / Sección</th><th>Profesor(es)</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th><th>Tardías</th><th>Justificadas</th>${profesor ? '<th>Boleta</th>' : ''}`;
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${profesor ? 9 : 8}" class="text-center py-5 text-muted">${obtenerMensajeSinDatos()}</td></tr>`;
    return;
  }

  rows.slice(0, 500).forEach((r) => {
    const tr = document.createElement('tr');
    const valores = [
      fullName(r),
      r.grupo_etiqueta || r.grupo || etiquetaGrupo(r),
      r.profesor || '-',
      r.asistencias_registradas ?? 0,
      r.presentes ?? 0,
      r.ausentes ?? 0,
      r.tardias ?? 0,
      r.justificadas ?? 0
    ];

    valores.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value == null || value === '' ? '-' : String(value);
      tr.appendChild(td);
    });

    if (profesor) {
      const td = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-outline-primary btn-sm text-nowrap';
      button.innerHTML = '<i class="bi bi-file-earmark-person"></i> Boleta';
      button.addEventListener('click', () => generarBoletaEstudiante(r));
      td.appendChild(button);
      tr.appendChild(td);
    }

    body.appendChild(tr);
  });
}

function renderRows(body, rows, mapper) {
  body.innerHTML = '';
  if (!rows.length) {
    const colspan = document.querySelector('#report-tabla-head')?.children.length || 1;
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-5 text-muted">${obtenerMensajeSinDatos()}</td></tr>`;
    return;
  }
  rows.slice(0, 500).forEach(row => {
    const tr = document.createElement('tr');
    mapper(row).forEach(value => { const td = document.createElement('td'); td.textContent = value == null || value === '' ? '-' : String(value); tr.appendChild(td); });
    body.appendChild(tr);
  });
}

function renderAuditoria(body, head, rows, preview = false) {
  head.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Cambio</th>';
  body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No hay registros de auditoría con los filtros aplicados.</td></tr>';
    return;
  }
  rows.slice(0, preview ? 15 : 500).forEach((r) => {
    const tr = document.createElement('tr');
    appendTextCell(tr, formatDateTime(r.fecha_creacion));
    appendTextCell(tr, r.nombre_tabla || '-');

    const accionTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'audit-action-badge';
    badge.textContent = r.accion_usuario || '-';
    accionTd.appendChild(badge);
    tr.appendChild(accionTd);
    appendTextCell(tr, r.usuario_nombre || r.id_usuario || '-');

    const detailTd = document.createElement('td');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.className = 'audit-detail-btn';
    summary.textContent = 'Ver cambio';
    const pre = document.createElement('div');
    pre.className = 'audit-json mt-2';
    pre.textContent = formatearCambioAuditoria(r);
    details.append(summary, pre);
    detailTd.appendChild(details);
    tr.appendChild(detailTd);
    body.appendChild(tr);
  });
}

function appendTextCell(tr, value) {
  const td = document.createElement('td');
  td.textContent = value == null || value === '' ? '-' : String(value);
  tr.appendChild(td);
}

function formatearCambioAuditoria(registro) {
  const anterior = formatearJson(registro.datos_anteriores);
  const nuevo = formatearJson(registro.datos_nuevos);
  if (anterior !== '—' && nuevo !== '—') return `ANTES\n${anterior}\n\nDESPUÉS\n${nuevo}`;
  if (nuevo !== '—') return `DATOS\n${nuevo}`;
  if (anterior !== '—') return `DATOS ANTERIORES\n${anterior}`;
  return 'Sin detalle almacenado.';
}

function formatearJson(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  const text = String(value);
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

function abrirVistaPreviaReporte() {
  if (!reporteActual) { showToast('Primero genera un reporte con filtros válidos para previsualizarlo.', 'error'); return; }
  const modalEl = document.getElementById('modalPreviewReporte');
  if (!modalEl) return;
  const modo = obtenerModoReporteActivo();
  const title = document.getElementById('preview-reporte-titulo');
  if (title) title.textContent = MODOS[modo]?.titulo || 'Reporte académico';
  const previewLogo = document.getElementById('preview-reporte-logo');
  if (previewLogo) previewLogo.src = REPORTE_LOGO_SRC;
  const auditNote = document.getElementById('preview-auditoria-note');
  if (auditNote) auditNote.hidden = modo !== 'auditoria';
  renderPreviewFilters(obtenerFiltrosActivos());
  renderPreviewMetrics(reporteActual.resumen || {}, reporteActual);
  renderPreviewTable(reporteActual);
  if (window.bootstrap?.Modal) (window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).show();
}

function renderPreviewFilters(filtros) {
  const area = document.getElementById('preview-reporte-filtros');
  if (!area) return;
  area.innerHTML = '';
  const config = MODOS[filtros.modo] || MODOS.matricula;
  const grupoTexto = document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos los grupos';
  const chips = [];
  if (config.filtros.includes('grupo')) chips.push(`Grupo: ${grupoTexto}`);
  if (config.filtros.includes('estado')) {
    const estadoValue = filtros.modo === 'pagos' ? (filtros.estado_pago || filtros.estado_asistencia || '') : (filtros.estado_asistencia || '');
    const textoEstado = estadoValue
      ? (filtros.modo === 'matricula'
        ? normalizarEstadoActivo(estadoValue)
        : filtros.modo === 'pagos'
          ? formatearEstadoPago(estadoValue)
          : formatearEstadoAsistencia(estadoValue))
      : 'Todos';
    chips.push(`Estado: ${textoEstado}`);
  }
  if (filtros.fecha_inicio) chips.push(`Desde: ${formatDate(filtros.fecha_inicio)}`);
  if (filtros.fecha_fin) chips.push(`Hasta: ${formatDate(filtros.fecha_fin)}`);
  if (filtros.busqueda) chips.push(`Búsqueda: ${filtros.busqueda}`);
  if (!chips.length) chips.push('Sin filtros adicionales');
  chips.forEach(text => { const span = document.createElement('span'); span.className = 'preview-reporte-chip'; span.textContent = text; area.appendChild(span); });
}

function renderPreviewMetrics(resumen, data = reporteActual) {
  const area = document.getElementById('preview-reporte-metricas');
  if (!area) return;
  const modo = obtenerModoReporteActivo();
  let metrics = [];
  if (modo === 'auditoria') metrics = [['Auditorías', resumen.total_auditorias ?? 0], ['Registros', resumen.total_registros ?? 0]];
  else if (modo === 'pagos') metrics = [['Movimientos', resumen.total_movimientos ?? 0], ['Facturados', resumen.total_facturados ?? 0], ['En facturación automática', resumen.total_pagados ?? 0], ['Parciales', resumen.total_parciales ?? 0], ['Pendientes', resumen.total_pendientes ?? 0], ['Anulados', resumen.total_anulados ?? 0]];
  else if (modo === 'pre_matricula') metrics = [['Pre-matrículas', resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0], ['Estudiantes', resumen.total_estudiantes ?? 0]];
  else if (modo === 'profesores') {
    const profesores = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
    const activos = profesores.filter((p) => normalizarEstadoActivo(p.estado ?? p.profesor_estado) === 'Activo').length;
    const inactivos = Math.max(0, profesores.length - activos);
    metrics = [['Profesores', profesores.length], ['Activos', activos], ['Inactivos', inactivos]];
  }
  else metrics = [['Estudiantes', resumen.total_estudiantes ?? 0], ['Profesores', resumen.total_profesores ?? 0], ['Grupos', resumen.total_grupos ?? 0], ['Presentismo', `${resumen.tasa_presentismo ?? 0}%`]];
  area.innerHTML = metrics.map(([label, value]) => `<div class="col-6 col-lg-3"><div class="report-preview-metric"><span>${label}</span><strong>${value}</strong></div></div>`).join('');
}

function renderPreviewTable(data) {
  const modo = obtenerModoReporteActivo();
  const header = document.querySelector('#preview-reporte-tabla thead tr');
  const body = document.getElementById('preview-reporte-detalle-body');
  if (!header || !body) return;
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
  const agrupado = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  if (modo === 'auditoria') { renderAuditoria(body, header, detalle, true); return; }
  if (modo === 'pre_matricula') { header.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>'; renderPreviewRows(body, detalle, r => [fullName(r), r.id_estudiante ?? '-', normalizarEstadoActivo(r.estado), 'Pre-matrícula']); return; }
  if (modo === 'pagos') { header.innerHTML = '<th>Estudiante</th><th>Concepto / servicio</th><th>Factura</th><th>Fecha</th><th>Monto</th><th>Saldo</th><th>Estado</th>'; renderPreviewRows(body, detalle, r => [fullName(r), r.descripcion || '-', r.id_factura_externa ?? '-', formatDate(r.fecha || r.fecha_emision), monedaPdf(r.total ?? 0), monedaPdf(r.saldo ?? 0), formatearEstadoPago(r.estado_pago || r.estado_cargo)]); return; }
  if (modo === 'estudiantes') { header.innerHTML = '<th>Estudiante</th><th>Grupo / Sección</th><th>Profesor(es)</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>'; renderPreviewRows(body, agrupado, r => [fullName(r), r.grupo_etiqueta || r.grupo || etiquetaGrupo(r), r.profesor ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]); return; }
  if (modo === 'profesores') { header.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Estado</th>'; renderPreviewRows(body, agrupado, r => [fullName(r, 'profesor'), r.materia ?? '-', r.grupos ?? '-', r.secciones ?? '-', normalizarEstadoActivo(r.estado ?? r.profesor_estado)]); return; }
  if (modo === 'grupos') { header.innerHTML = '<th>Grupo</th><th>Sección</th><th>Matriculados</th><th>Capacidad</th>'; renderPreviewRows(body, agrupado, r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0]); return; }
  header.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor(es)</th><th>Estado estudiante</th>';
  renderPreviewRows(body, detalle, r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), normalizarEstadoActivo(r.estudiante_estado ?? r.estado_estudiante ?? r.estado)]);
}

function renderPreviewRows(body, rows, mapper) {
  body.innerHTML = '';
  if (!rows.length) { const colspan = document.querySelector('#preview-reporte-tabla thead tr')?.children.length || 1; body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4 text-muted">No hay registros detallados.</td></tr>`; return; }
  rows.slice(0, 15).forEach(row => { const tr = document.createElement('tr'); mapper(row).forEach(value => appendTextCell(tr, value)); body.appendChild(tr); });
}

async function imprimirReportePdf() {
  if (!reporteActual) { showToast('Primero genera un reporte.', 'error'); return; }
  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) { window.print(); return; }

  const modo = obtenerModoReporteActivo();
  const filtros = obtenerFiltrosActivos();
  const titulo = MODOS[modo]?.titulo || 'Reporte EduControl';
  const landscape = modo === 'auditoria' || modo === 'estudiantes' || modo === 'profesores';
  const doc = new JsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = landscape ? 297 : 210;
  const pageHeight = landscape ? 205 : 290;
  let y = 36;

  const nuevaPagina = () => { doc.addPage(); y = 18; };
  const headerPagina = async () => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(textoPdfSeguro(titulo), 14, 12);
    const logo = await obtenerLogoReporteDataUrl();
    if (logo) {
      try { doc.addImage(logo, 'JPEG', pageWidth - 28, 3, 22, 22); } catch (error) { console.warn('No se pudo incrustar el logo en el PDF:', error); }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(textoPdfSeguro(`Generado: ${new Date().toLocaleString('es-CR')}`), 14, 20);
    doc.text(textoPdfSeguro(`Filtros: ${descripcionFiltrosPdf(filtros)}`), 14, 24, { maxWidth: pageWidth - 50 });
  };

  await headerPagina();
  doc.setTextColor(0, 0, 0);

  const resumen = construirResumenPdf(modo, reporteActual.resumen || {});
  if (resumen.length) {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(12, y - 5, pageWidth - 24, 13, 2, 2, 'F');
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(textoPdfSeguro(resumen.join('   -   ')), 16, y + 2, { maxWidth: pageWidth - 32 });
    y += 17;
  }

  const { columnas, filas } = construirDatosPdf(modo, reporteActual, filtros, pageWidth);
  agregarTablaAcademica(doc, 'Detalle del reporte', columnas, filas, { pageWidth, pageHeight, getY: () => y, setY: value => { y = value; }, nuevaPagina });
  doc.save(`${titulo.replace(/\s+/g, '_')}.pdf`);
}

function construirResumenPdf(modo, resumen) {
  if (modo === 'auditoria') return [`Auditorías: ${resumen.total_auditorias ?? 0}`];
  if (modo === 'pagos') return [`Movimientos: ${resumen.total_movimientos ?? 0}`, `Facturados: ${resumen.total_facturados ?? 0}`, `En facturación automática: ${resumen.total_pagados ?? 0}`, `Parciales: ${resumen.total_parciales ?? 0}`, `Pendientes: ${resumen.total_pendientes ?? 0}`, `Anulados: ${resumen.total_anulados ?? 0}`];
  if (modo === 'pre_matricula') return [`Pre-matrículas: ${resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0}`];
  return [`Estudiantes: ${resumen.total_estudiantes ?? 0}`, `Profesores: ${resumen.total_profesores ?? 0}`, `Grupos: ${resumen.total_grupos ?? 0}`, `Presentismo: ${resumen.tasa_presentismo ?? 0}%`];
}

function descripcionFiltrosPdf(filtros) {
  const items = [];
  const config = MODOS[filtros.modo] || MODOS.matricula;
  if (config.filtros.includes('grupo')) items.push(`Grupo ${document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos'}`);
  if (filtros.busqueda) items.push(`Búsqueda "${filtros.busqueda}"`);
  if (filtros.estado_asistencia) {
    const textoEstado = filtros.modo === 'matricula'
      ? normalizarEstadoActivo(filtros.estado_asistencia)
      : filtros.modo === 'pagos'
        ? formatearEstadoPago(filtros.estado_asistencia)
        : formatearEstadoAsistencia(filtros.estado_asistencia);
    items.push(`Estado ${textoEstado}`);
  }
  if (filtros.fecha_inicio || filtros.fecha_fin) items.push(obtenerRangoFechaAplicado(filtros));
  return items.length ? items.join(' · ') : 'Sin filtros adicionales';
}

function construirDatosPdf(modo, data, filtros, pageWidth) {
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
  const agrupado = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  const usable = pageWidth - 24;

  if (modo === 'auditoria') return {
    columnas: [{ label: 'Fecha', width: 29 }, { label: 'Tabla', width: 32 }, { label: 'Acción', width: 28 }, { label: 'Usuario', width: 34 }, { label: 'Cambio', width: usable - 123 }],
    filas: detalle.map(r => [formatDateTime(r.fecha_creacion), r.nombre_tabla ?? '-', r.accion_usuario ?? '-', r.usuario_nombre || r.id_usuario || '-', resumenCambioAuditoria(r)])
  };
  if (modo === 'pagos') return {
    columnas: [{ label: 'Estudiante', width: 44 }, { label: 'Concepto / servicio', width: 44 }, { label: 'Factura', width: 28 }, { label: 'Fecha', width: 24 }, { label: 'Monto', width: 22 }, { label: 'Saldo', width: 22 }, { label: 'Estado', width: usable - 184 }],
    filas: detalle.map(r => [fullName(r), r.descripcion || '-', r.id_factura_externa ?? '-', formatDate(r.fecha || r.fecha_emision), monedaPdf(r.total ?? 0), monedaPdf(r.saldo ?? 0), formatearEstadoPago(r.estado_pago || r.estado_cargo)])
  };
  if (modo === 'pre_matricula') return {
    columnas: [{ label: 'Estudiante', width: 85 }, { label: 'Cédula', width: 30 }, { label: 'Estado', width: 30 }, { label: 'Tipo', width: usable - 145 }],
    filas: detalle.map(r => [fullName(r), r.id_estudiante ?? '-', normalizarEstadoActivo(r.estado), 'Pre-matrícula'])
  };
  if (modo === 'estudiantes') return {
    columnas: [{ label: 'Estudiante', width: 50 }, { label: 'Grupo', width: 30 }, { label: 'Profesor(es)', width: 55 }, { label: 'Asist.', width: 24 }, { label: 'Pres.', width: 22 }, { label: 'Aus.', width: 22 }, { label: 'Tard.', width: 22 }, { label: 'Just.', width: usable - 225 }],
    filas: agrupado.map(r => [fullName(r), r.grupo_etiqueta || r.grupo || etiquetaGrupo(r), r.profesor ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0, r.tardias ?? 0, r.justificadas ?? 0])
  };
  if (modo === 'profesores') return {
    columnas: [{ label: 'Profesor', width: 56 }, { label: 'Materia', width: 42 }, { label: 'Grupo(s)', width: 46 }, { label: 'Sección(es)', width: 52 }, { label: 'Estudiantes', width: 30 }, { label: 'Estado', width: usable - 226 }],
    filas: agrupado.map(r => [fullName(r, 'profesor'), r.materia ?? '-', r.grupos ?? '-', r.secciones ?? '-', r.estudiantes_asociados ?? 0, normalizarEstadoActivo(r.estado ?? r.profesor_estado)])
  };
  if (modo === 'grupos') return {
    columnas: [{ label: 'Grupo', width: 45 }, { label: 'Sección', width: 35 }, { label: 'Matriculados', width: 32 }, { label: 'Capacidad', width: 32 }, { label: '', width: usable - 144 }],
    filas: agrupado.map(r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0, ''])
  };
  return {
    columnas: [{ label: 'Fecha', width: 26 }, { label: 'Estudiante', width: 56 }, { label: 'Grupo', width: 26 }, { label: 'Profesor', width: 50 }, { label: 'Estado estudiante', width: usable - 158 }],
    filas: detalle.map(r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), normalizarEstadoActivo(r.estudiante_estado ?? r.estado_estudiante ?? r.estado)])
  };
}

function agregarTablaAcademica(doc, titulo, columnas, filas, ctx) {
  let y = ctx.getY();
  const left = 12;
  const totalWidth = columnas.reduce((sum, c) => sum + c.width, 0);
  const dibujarTitulo = (continuacion = false) => {
    doc.setFillColor(236, 244, 255);
    doc.rect(left, y - 6, totalWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(textoPdfSeguro(continuacion ? `${titulo} (continuación)` : titulo), left + 2, y);
    y += 8;
  };
  const dibujarHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(left, y - 5, totalWidth, 7, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(left, y - 5, totalWidth, 7);
    let x = left;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(45, 55, 72);
    columnas.forEach(col => { doc.text(textoPdfSeguro(col.label), x + 1.2, y); x += col.width; });
    y += 3;
  };
  const nuevaPaginaTabla = () => { ctx.nuevaPagina(); y = 18; dibujarTitulo(true); dibujarHeader(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(25, 25, 25); };

  dibujarTitulo(false);
  if (!filas.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80, 80, 80); doc.text('No hay datos para imprimir con los filtros aplicados.', left + 2, y); ctx.setY(y + 8); return; }
  dibujarHeader();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(25, 25, 25);

  filas.slice(0, 500).forEach(fila => {
    const cellPadding = 1.2;
    const lineHeight = 3.5;
    const lineas = columnas.map((col, idx) => {
      const valor = textoPdfSeguro(fila[idx] ?? '-');
      const parsed = doc.splitTextToSize(valor, Math.max(col.width - cellPadding * 2, 2));
      return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 7) : ['-'];
    });
    const maxLines = Math.max(...lineas.map(v => v.length));
    const rowHeight = Math.max(7, maxLines * lineHeight + 2.4);
    if (y + rowHeight > ctx.pageHeight - 8) nuevaPaginaTabla();
    let x = left;
    lineas.forEach((cell, idx) => { cell.forEach((line, n) => doc.text(line, x + cellPadding, y + 2.6 + n * lineHeight)); x += columnas[idx].width; });
    doc.setDrawColor(235, 235, 235);
    doc.line(left, y + rowHeight, left + totalWidth, y + rowHeight);
    y += rowHeight;
  });
  ctx.setY(y + 4);
}

function resumenCambioAuditoria(r) {
  const nuevo = compactarJson(r.datos_nuevos);
  const anterior = compactarJson(r.datos_anteriores);
  if (nuevo !== '—' && anterior !== '—') return `Antes: ${anterior} | Después: ${nuevo}`;
  if (nuevo !== '—') return nuevo;
  if (anterior !== '—') return anterior;
  return 'Sin detalle';
}

function compactarJson(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

async function generarBoletaEstudiante(estudiante) {
  if (!esProfesorActual()) {
    showToast('La boleta individual está disponible únicamente para profesores.', 'error');
    return;
  }

  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) {
    showToast('No se pudo iniciar el generador de PDF.', 'error');
    return;
  }

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const nombre = fullName(estudiante);
  const grupo = estudiante.grupo_etiqueta || estudiante.grupo || etiquetaGrupo(estudiante);
  const profesor = estudiante.profesor || `${currentUser?.nombre || ''} ${currentUser?.apellido1 || ''} ${currentUser?.apellido2 || ''}`.trim() || 'Profesor';
  const asistencias = Number(estudiante.asistencias_registradas || 0);
  const presentes = Number(estudiante.presentes || 0);
  const ausentes = Number(estudiante.ausentes || 0);
  const tardias = Number(estudiante.tardias || 0);
  const justificadas = Number(estudiante.justificadas || 0);
  const presentismo = asistencias ? Math.round((presentes / asistencias) * 100) : 0;
  const filtros = reporteActual?.filtros || obtenerFiltrosActivos();
  const detalleAsistencia = (Array.isArray(reporteActual?.detalle) ? reporteActual.detalle : [])
    .filter((r) => Number(r.id_estudiante) === Number(estudiante.id_estudiante)
      && (!estudiante.id_grupo || Number(r.id_grupo) === Number(estudiante.id_grupo))
      && r.id_asistencia)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  doc.setFillColor(15, 29, 53);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Boleta de seguimiento del estudiante', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('EduControl - Seguimiento académico y de asistencia', 14, 21);
  doc.text(`Emitida: ${new Date().toLocaleString('es-CR')}`, 14, 27);

  const logo = await obtenerLogoReporteDataUrl();
  if (logo) {
    try { doc.addImage(logo, 'JPEG', 178, 4, 24, 24); } catch (error) { console.warn(error); }
  }

  let y = 46;
  doc.setTextColor(31, 41, 55);
  doc.setFillColor(242, 246, 252);
  doc.roundedRect(12, y - 6, 186, 37, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Información del estudiante', 18, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(textoPdfSeguro(`Estudiante: ${nombre}`), 18, y + 9);
  doc.text(textoPdfSeguro(`Grupo / sección: ${grupo}`), 18, y + 16);
  doc.text(textoPdfSeguro(`Profesor: ${profesor}`), 18, y + 23);
  y += 45;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Resumen de asistencia', 14, y);
  y += 8;

  const tarjetas = [
    ['Asistencias', asistencias],
    ['Presentes', presentes],
    ['Ausentes', ausentes],
    ['Tardías', tardias],
    ['Justificadas', justificadas],
    ['Presentismo', `${presentismo}%`]
  ];

  tarjetas.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 14 + col * 62;
    const yy = y + row * 24;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 226, 234);
    doc.roundedRect(x, yy, 56, 18, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 101, 115);
    doc.text(label, x + 4, yy + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(String(value), x + 4, yy + 14);
  });

  y += 57;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.text(textoPdfSeguro(`Periodo consultado: ${obtenerRangoFechaAplicado(filtros)}`), 14, y);
  y += 10;

  if (!asistencias) {
    doc.setFillColor(255, 248, 230);
    doc.roundedRect(12, y, 186, 18, 2, 2, 'F');
    doc.setTextColor(120, 84, 20);
    doc.text('El estudiante pertenece al grupo, pero todavía no tiene asistencias registradas en el periodo consultado.', 17, y + 7, { maxWidth: 176 });
    y += 26;
  } else {
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Detalle reciente', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    detalleAsistencia.slice(0, 8).forEach((registro) => {
      const estado = String(registro.estado_asistencia || '-');
      const observacion = String(registro.observaciones || 'Sin observación');
      const texto = textoPdfSeguro(`${formatDate(registro.fecha)} - ${estado} - ${observacion}`);
      const lineas = doc.splitTextToSize(texto, 176);
      const alto = Math.max(5, lineas.length * 4);
      if (y + alto > 245) return;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, y - 3.5, 182, alto + 2, 1.5, 1.5, 'F');
      doc.setTextColor(55, 65, 81);
      doc.text(lineas, 18, y);
      y += alto + 4;
    });
  }

  const firmaY = Math.max(265, y + 18);
  if (firmaY > 276) {
    doc.addPage();
  }
  const finalFirmaY = firmaY > 276 ? 245 : firmaY;
  doc.setDrawColor(190, 198, 210);
  doc.line(28, finalFirmaY, 88, finalFirmaY);
  doc.line(122, finalFirmaY, 182, finalFirmaY);
  doc.setTextColor(80, 90, 105);
  doc.setFontSize(9);
  doc.text('Firma del profesor', 46, finalFirmaY + 6);
  doc.text('Firma del encargado', 140, finalFirmaY + 6);

  const safeName = nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, '_');
  doc.save(`Boleta_${safeName}.pdf`);
}

function obtenerLogoReporteDataUrl() {
  if (!reporteLogoDataUrlPromise) {
    reporteLogoDataUrlPromise = fetch(REPORTE_LOGO_SRC)
      .then(response => { if (!response.ok) throw new Error('No se pudo cargar el logo para el PDF.'); return response.blob(); })
      .then(blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo convertir el logo para el PDF.')); reader.readAsDataURL(blob); }))
      .catch(error => { console.warn(error.message || error); reporteLogoDataUrlPromise = null; return null; });
  }
  return reporteLogoDataUrlPromise;
}

function obtenerRangoFechaAplicado(filtros = {}) {
  const desde = filtros.fecha_inicio || '';
  const hasta = filtros.fecha_fin || '';
  if (desde && hasta) return `${formatDate(desde)} a ${formatDate(hasta)}`;
  if (desde) return `Desde ${formatDate(desde)}`;
  if (hasta) return `Hasta ${formatDate(hasta)}`;
  return 'Sin rango de fechas';
}

function poblarFiltroGrupoReportes() {
  const select = document.getElementById('report-filtro-grupo');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Todos los grupos</option>';
  const grupos = Array.isArray(allGrupos) ? allGrupos : [];
  grupos.forEach((grupo) => {
    const id = grupo.id_grupo ?? grupo.id;
    if (id == null) return;
    select.add(new Option(etiquetaGrupo(grupo), id));
  });
  select.value = current || '';
}

function fullName(record, type = 'estudiante') {
  const prefix = type === 'profesor' ? 'profesor_' : 'estudiante_';
  const value = `${record?.[`${prefix}nombre`] ?? ''} ${record?.[`${prefix}apellido1`] ?? ''} ${record?.[`${prefix}apellido2`] ?? ''}`.trim();
  return value || '-';
}

function formatDate(value) {
  if (!value) return '—';
  const text = String(value);
  const base = text.includes('T') ? text.split('T')[0] : text;
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toLocaleDateString('es-CR');
}

function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatearEstadoAsistencia(value) {
  const estado = String(value || '').toLowerCase().trim();
  return ({ presente: 'Presente', ausente: 'Ausente', tardia: 'Tardía', justificada: 'Justificada' })[estado] || value || '-';
}

function formatearEstadoPago(value) {
  const texto = String(value || '').toLowerCase().trim();
  const etiquetas = {
    pendiente: 'Pendiente de pago',
    parcial: 'Pago parcial',
    pagado: 'Facturación automática',
    facturado: 'Facturado',
    anulado: 'Anulado'
  };
  return etiquetas[texto] || value || '-';
}

function moneda(valor) {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 }).format(numero);
}

function normalizarEstadoActivo(value) {
  if (value === false || value === 0 || String(value).toLowerCase() === 'inactivo') return 'Inactivo';
  return 'Activo';
}
