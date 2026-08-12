import { apiFetch, showToast } from './ui.js';
import { populateGruposSelects, allGrupos } from './matricula.js';

const MODOS = {
  matricula: { tipo: 'resumen', filtros: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'], label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula', hint: 'Busca únicamente estudiantes matriculados.', titulo: 'Reporte de matrícula' },
  estudiantes: { tipo: 'individual', filtros: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'], label: 'Estudiante o profesor', placeholder: 'Estudiante, cédula o profesor relacionado', hint: 'Puedes buscar al estudiante directamente o escribir el nombre del profesor que le registra asistencia.', titulo: 'Reporte de estudiantes' },
  grupos: { tipo: 'grupo', filtros: ['grupo', 'fecha-desde', 'fecha-hasta'], label: 'Grupo', placeholder: 'Grupo', hint: '', titulo: 'Reporte de grupos' },
  profesores: { tipo: 'resumen', filtros: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Profesor / Cédula', placeholder: 'Nombre, apellido o cédula del profesor', hint: 'Muestra grupos, secciones y estudiantes asociados al profesor.', titulo: 'Reporte de profesores' },
  pre_matricula: { tipo: 'resumen', filtros: ['busqueda'], label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula del pre-registro', hint: 'Lista estudiantes activos que todavía no tienen grupo asignado.', titulo: 'Reporte de pre-matrículas' },
  auditoria: { tipo: 'detalle', filtros: ['busqueda', 'fecha-desde', 'fecha-hasta'], label: 'Auditoría / Acción', placeholder: 'Tabla, usuario, acción o contenido del cambio', hint: 'Puedes buscar por tabla, acción, usuario o contenido registrado.', titulo: 'Reporte de auditoría' }
};

const ESTADOS = ['presente', 'ausente', 'tardia', 'justificada'];
const TIPOS_REPORTE = ['resumen', 'detalle', 'individual', 'grupo'];
const REPORTE_LOGO_SRC = '/images/logo.jpg';
let consultaAplicada = false;
let reporteActual = null;
let reporteLogoDataUrlPromise = null;

(function registerModule() {
  const moduleName = 'reportes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = { name: moduleName, init: wireReportesEvents, load: loadReportesData };
  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

async function loadReportesData() {
  try { await populateGruposSelects(); } catch (error) { console.warn('No se pudieron cargar los grupos para reportes:', error); }
  poblarFiltroGrupoReportes();
  limpiarFiltrosReporte('matricula');
  cambiarModoReporte('matricula');
  resetearDatosReporte();
}

function wireReportesEvents() {
  wireClick('report-aplicar', cargarReporte);
  wireClick('report-limpiar', limpiarReporte);
  wireClick('report-vista-previa', abrirVistaPreviaReporte);
  wireClick('report-imprimir-pdf', imprimirReportePdf);

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      const modo = button.dataset.reportMode || 'matricula';
      limpiarFiltrosReporte(modo);
      cambiarModoReporte(modo);
      resetearDatosReporte();
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
      input.addEventListener('change', validarRangoFechasEnUI);
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

function cambiarModoReporte(modo = 'matricula') {
  const actual = MODOS[modo] ? modo : 'matricula';
  const config = MODOS[actual];

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === actual);
    button.setAttribute('aria-pressed', String(button.dataset.reportMode === actual));
  });

  document.querySelectorAll('.report-filter-field').forEach((field) => {
    field.classList.toggle('is-hidden', !config.filtros.includes(field.dataset.filter));
  });

  const tipo = document.getElementById('report-filtro-tipo');
  if (tipo) tipo.value = config.tipo;
  const label = document.getElementById('report-busqueda-label');
  if (label) label.textContent = config.label;
  const input = document.getElementById('report-filtro-busqueda');
  if (input) input.placeholder = config.placeholder;
  const hint = document.getElementById('report-search-hint');
  if (hint) { hint.textContent = config.hint || ''; hint.hidden = !config.hint; }
  const title = document.querySelector('#reportes-view .card-title-serif');
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${config.titulo}`;

  actualizarResumenTexto();
  limpiarError();
  return actual;
}

function obtenerModoReporteActivo() {
  return document.querySelector('[data-report-mode].active')?.dataset.reportMode || 'matricula';
}

function obtenerFiltrosActivos() {
  return {
    id_grupo: document.getElementById('report-filtro-grupo')?.value || '',
    busqueda: document.getElementById('report-filtro-busqueda')?.value.trim() || '',
    tipo_reporte: document.getElementById('report-filtro-tipo')?.value || 'resumen',
    estado_asistencia: document.getElementById('report-filtro-estado')?.value || '',
    fecha_inicio: document.getElementById('report-filtro-fecha-desde')?.value || '',
    fecha_fin: document.getElementById('report-filtro-fecha-hasta')?.value || '',
    modo: obtenerModoReporteActivo()
  };
}

function validarFiltros(filtros) {
  if (filtros.fecha_inicio && filtros.fecha_fin && filtros.fecha_inicio > filtros.fecha_fin) return 'La fecha de inicio no puede ser mayor que la fecha fin.';
  if ((filtros.busqueda || '').length > 120) return 'La búsqueda no puede superar 120 caracteres.';
  if (filtros.estado_asistencia && !ESTADOS.includes(filtros.estado_asistencia)) return 'El estado de asistencia seleccionado no es válido.';
  if (!TIPOS_REPORTE.includes(filtros.tipo_reporte)) return 'El tipo de reporte seleccionado no es válido.';
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
  const button = document.getElementById('report-aplicar');
  const oldText = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generando...'; }

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
    if (button) { button.disabled = false; button.innerHTML = oldText; }
  }
}

function limpiarFiltrosReporte(modo = obtenerModoReporteActivo()) {
  const config = MODOS[modo] || MODOS.matricula;
  const values = {
    'report-filtro-grupo': '', 'report-filtro-busqueda': '', 'report-filtro-tipo': config.tipo,
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

function actualizarResumenTexto(data = reporteActual, error = '') {
  const el = document.getElementById('report-result-summary');
  if (!el) return;
  if (error) { el.textContent = error; return; }
  if (!consultaAplicada || !data) { el.textContent = 'Selecciona los filtros y presiona Aplicar filtros.'; return; }
  const modo = obtenerModoReporteActivo();
  const count = ['estudiantes', 'profesores', 'grupos'].includes(modo)
    ? (Array.isArray(data.detalle_por_grupo) ? data.detalle_por_grupo.length : 0)
    : (Array.isArray(data.detalle) ? data.detalle.length : 0);
  el.textContent = `${count} resultado${count === 1 ? '' : 's'} con los filtros aplicados.`;
}

function renderEmptyState(data, errorMessage = '') {
  const box = document.getElementById('report-empty-state');
  const message = document.getElementById('report-empty-message');
  if (!box || !message) return;
  const modo = obtenerModoReporteActivo();
  const rows = ['profesores', 'estudiantes', 'grupos'].includes(modo)
    ? (Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [])
    : (Array.isArray(data?.detalle) ? data.detalle : []);
  if (!consultaAplicada && !errorMessage) { box.hidden = true; return; }
  if (errorMessage) { message.textContent = errorMessage; box.hidden = false; return; }
  if (!rows.length) { message.textContent = obtenerMensajeSinDatos(); box.hidden = false; } else { box.hidden = true; }
}

function obtenerMensajeSinDatos() {
  const modo = obtenerModoReporteActivo();
  const busqueda = document.getElementById('report-filtro-busqueda')?.value.trim() || '';
  if (!consultaAplicada) return 'Aún no hay consulta. Presiona Aplicar filtros.';
  if (modo === 'pre_matricula' && !busqueda) return 'No hay estudiantes pendientes de matrícula.';
  if (modo === 'auditoria' && !busqueda) return 'No hay registros de auditoría disponibles.';
  if (modo === 'matricula' && busqueda) return 'No se encontraron estudiantes matriculados con ese criterio.';
  if (modo === 'estudiantes' && busqueda) return 'No se encontraron estudiantes ni relaciones con profesores para ese criterio.';
  if (modo === 'profesores' && busqueda) return 'No se encontraron profesores con ese criterio.';
  return busqueda ? 'No se encontraron registros con el criterio de búsqueda.' : 'No hay registros con los filtros aplicados.';
}

function renderTablaPrincipal(data = {}) {
  const body = document.getElementById('report-grupos-body');
  const head = document.getElementById('report-tabla-head');
  if (!body || !head) return;
  const modo = obtenerModoReporteActivo();
  const agrupado = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];

  if (modo === 'pre_matricula') {
    head.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>';
    renderRows(body, detalle, r => [fullName(r), r.id_estudiante ?? '-', normalizarEstadoActivo(r.estado), 'Pre-matrícula']); return;
  }
  if (modo === 'auditoria') { renderAuditoria(body, head, detalle, false); return; }
  if (modo === 'estudiantes') {
    head.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Profesor(es)</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th><th>Tardías</th><th>Justificadas</th>';
    renderRows(body, agrupado, r => [fullName(r), r.grupo ?? r.nombre_grupo ?? '-', r.profesor ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0, r.tardias ?? 0, r.justificadas ?? 0]); return;
  }
  if (modo === 'profesores') {
    head.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Estudiantes</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderRows(body, agrupado, r => [fullName(r, 'profesor'), r.materia ?? r.materia_curso ?? '-', r.grupos ?? r.grupo ?? '-', r.secciones ?? r.seccion ?? '-', r.estudiantes_asociados ?? 0, r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]); return;
  }
  if (modo === 'grupos') {
    head.innerHTML = '<th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderRows(body, agrupado, r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0, r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]); return;
  }
  head.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
  renderRows(body, detalle, r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), formatearEstadoAsistencia(r.estado_asistencia), r.observaciones || '—']);
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
  renderPreviewMetrics(reporteActual.resumen || {});
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
  if (config.filtros.includes('estado')) chips.push(`Estado: ${filtros.estado_asistencia ? formatearEstadoAsistencia(filtros.estado_asistencia) : 'Todos'}`);
  if (filtros.fecha_inicio) chips.push(`Desde: ${formatDate(filtros.fecha_inicio)}`);
  if (filtros.fecha_fin) chips.push(`Hasta: ${formatDate(filtros.fecha_fin)}`);
  if (filtros.busqueda) chips.push(`Búsqueda: ${filtros.busqueda}`);
  if (!chips.length) chips.push('Sin filtros adicionales');
  chips.forEach(text => { const span = document.createElement('span'); span.className = 'preview-reporte-chip'; span.textContent = text; area.appendChild(span); });
}

function renderPreviewMetrics(resumen) {
  const area = document.getElementById('preview-reporte-metricas');
  if (!area) return;
  const modo = obtenerModoReporteActivo();
  let metrics = [];
  if (modo === 'auditoria') metrics = [['Auditorías', resumen.total_auditorias ?? 0], ['Registros', resumen.total_registros ?? 0]];
  else if (modo === 'pre_matricula') metrics = [['Pre-matrículas', resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0], ['Estudiantes', resumen.total_estudiantes ?? 0]];
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
  if (modo === 'estudiantes') { header.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Profesor(es)</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>'; renderPreviewRows(body, agrupado, r => [fullName(r), r.grupo ?? '-', r.profesor ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]); return; }
  if (modo === 'profesores') { header.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Estudiantes</th><th>Asistencias</th>'; renderPreviewRows(body, agrupado, r => [fullName(r, 'profesor'), r.materia ?? '-', r.grupos ?? '-', r.secciones ?? '-', r.estudiantes_asociados ?? 0, r.asistencias_registradas ?? 0]); return; }
  if (modo === 'grupos') { header.innerHTML = '<th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th>'; renderPreviewRows(body, agrupado, r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0, r.asistencias_registradas ?? 0]); return; }
  header.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
  renderPreviewRows(body, detalle, r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), formatearEstadoAsistencia(r.estado_asistencia), r.observaciones ?? '—']);
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
    doc.text(titulo, 14, 12);
    const logo = await obtenerLogoReporteDataUrl();
    if (logo) {
      try { doc.addImage(logo, 'JPEG', pageWidth - 28, 3, 22, 22); } catch (error) { console.warn('No se pudo incrustar el logo en el PDF:', error); }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 14, 20);
    doc.text(`Filtros: ${descripcionFiltrosPdf(filtros)}`, 14, 24, { maxWidth: pageWidth - 50 });
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
    doc.text(resumen.join('   •   '), 16, y + 2, { maxWidth: pageWidth - 32 });
    y += 17;
  }

  const { columnas, filas } = construirDatosPdf(modo, reporteActual, filtros, pageWidth);
  agregarTablaAcademica(doc, 'Detalle del reporte', columnas, filas, { pageWidth, pageHeight, getY: () => y, setY: value => { y = value; }, nuevaPagina });
  doc.save(`${titulo.replace(/\s+/g, '_')}.pdf`);
}

function construirResumenPdf(modo, resumen) {
  if (modo === 'auditoria') return [`Auditorías: ${resumen.total_auditorias ?? 0}`];
  if (modo === 'pre_matricula') return [`Pre-matrículas: ${resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0}`];
  return [`Estudiantes: ${resumen.total_estudiantes ?? 0}`, `Profesores: ${resumen.total_profesores ?? 0}`, `Grupos: ${resumen.total_grupos ?? 0}`, `Presentismo: ${resumen.tasa_presentismo ?? 0}%`];
}

function descripcionFiltrosPdf(filtros) {
  const items = [];
  const config = MODOS[filtros.modo] || MODOS.matricula;
  if (config.filtros.includes('grupo')) items.push(`Grupo ${document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos'}`);
  if (filtros.busqueda) items.push(`Búsqueda "${filtros.busqueda}"`);
  if (filtros.estado_asistencia) items.push(`Estado ${formatearEstadoAsistencia(filtros.estado_asistencia)}`);
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
  if (modo === 'pre_matricula') return {
    columnas: [{ label: 'Estudiante', width: 85 }, { label: 'Cédula', width: 30 }, { label: 'Estado', width: 30 }, { label: 'Tipo', width: usable - 145 }],
    filas: detalle.map(r => [fullName(r), r.id_estudiante ?? '-', normalizarEstadoActivo(r.estado), 'Pre-matrícula'])
  };
  if (modo === 'estudiantes') return {
    columnas: [{ label: 'Estudiante', width: 50 }, { label: 'Grupo', width: 30 }, { label: 'Profesor(es)', width: 55 }, { label: 'Asist.', width: 24 }, { label: 'Pres.', width: 22 }, { label: 'Aus.', width: 22 }, { label: 'Tard.', width: 22 }, { label: 'Just.', width: usable - 225 }],
    filas: agrupado.map(r => [fullName(r), r.grupo ?? '-', r.profesor ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0, r.tardias ?? 0, r.justificadas ?? 0])
  };
  if (modo === 'profesores') return {
    columnas: [{ label: 'Profesor', width: 52 }, { label: 'Materia', width: 38 }, { label: 'Grupo(s)', width: 42 }, { label: 'Sección(es)', width: 48 }, { label: 'Estudiantes', width: 28 }, { label: 'Asist.', width: 26 }, { label: 'Estado', width: usable - 234 }],
    filas: agrupado.map(r => [fullName(r, 'profesor'), r.materia ?? '-', r.grupos ?? '-', r.secciones ?? '-', r.estudiantes_asociados ?? 0, r.asistencias_registradas ?? 0, r.estado ?? 'Activo'])
  };
  if (modo === 'grupos') return {
    columnas: [{ label: 'Grupo', width: 35 }, { label: 'Sección', width: 35 }, { label: 'Ocupados', width: 28 }, { label: 'Capacidad', width: 28 }, { label: 'Asistencias', width: 30 }, { label: 'Presentes', width: 30 }, { label: 'Ausentes', width: usable - 186 }],
    filas: agrupado.map(r => [r.nombre_grupo ?? '-', r.nombre_seccion ?? '-', r.ocupados ?? 0, r.capacidad ?? 0, r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0])
  };
  return {
    columnas: [{ label: 'Fecha', width: 24 }, { label: 'Estudiante', width: 48 }, { label: 'Grupo', width: 25 }, { label: 'Profesor', width: 42 }, { label: 'Estado', width: 24 }, { label: 'Observaciones', width: usable - 163 }],
    filas: detalle.map(r => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), formatearEstadoAsistencia(r.estado_asistencia), r.observaciones || '-'])
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
    doc.text(continuacion ? `${titulo} (continuación)` : titulo, left + 2, y);
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
    columnas.forEach(col => { doc.text(col.label, x + 1.2, y); x += col.width; });
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
      const valor = String(fila[idx] ?? '-');
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
  grupos.forEach(grupo => { const id = grupo.id_grupo ?? grupo.id; if (id != null) select.add(new Option(grupo.nombre_grupo ?? `Grupo ${id}`, id)); });
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

function normalizarEstadoActivo(value) {
  if (value === false || value === 0 || String(value).toLowerCase() === 'inactivo') return 'Inactivo';
  return 'Activo';
}
