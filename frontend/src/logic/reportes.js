import { apiFetch, showToast } from './ui.js';
import { populateGruposSelects, allGrupos } from './matricula.js';

const MODOS = {
  matricula: {
    tipo: 'resumen',
    filtros: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    label: 'Estudiante / Cédula',
    placeholder: 'Nombre, apellido o cédula',
    titulo: 'Reporte de matrícula'
  },
  estudiantes: {
    tipo: 'individual',
    filtros: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    label: 'Estudiante / Cédula',
    placeholder: 'Nombre, apellido o cédula del estudiante',
    titulo: 'Reporte de estudiantes'
  },
  grupos: {
    tipo: 'grupo',
    filtros: ['grupo', 'fecha-desde', 'fecha-hasta'],
    label: 'Estudiante / Cédula',
    placeholder: 'Nombre, apellido o cédula',
    titulo: 'Reporte de grupos'
  },
  profesores: {
    tipo: 'resumen',
    filtros: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'],
    label: 'Profesor / Cédula',
    placeholder: 'Nombre, apellido o cédula del profesor',
    titulo: 'Reporte de profesores'
  },
  pre_matricula: {
    tipo: 'resumen',
    filtros: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'],
    label: 'Estudiante / Cédula',
    placeholder: 'Nombre, apellido o cédula del pre-registro',
    titulo: 'Reporte de pre-matrículas'
  },
  auditoria: {
    tipo: 'detalle',
    filtros: ['busqueda', 'fecha-desde', 'fecha-hasta'],
    label: 'Auditoría / Acción',
    placeholder: 'Tabla, usuario o acción',
    titulo: 'Reporte de auditoría'
  }
};

const ESTADOS = ['presente', 'ausente', 'tardia', 'justificada'];
let consultaAplicada = false;
let reporteActual = null;

(function registerModule() {
  const moduleName = 'reportes';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init: wireReportesEvents,
    load: loadReportesData
  };
  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

async function loadReportesData() {
  try {
    await populateGruposSelects();
  } catch (error) {
    console.warn('No se pudieron cargar los grupos para reportes:', error);
  }
  poblarFiltroGrupoReportes();
  resetearVista();
}

function wireReportesEvents() {
  const apply = document.getElementById('report-aplicar');
  if (apply && !apply.dataset.wired) {
    apply.dataset.wired = '1';
    apply.addEventListener('click', cargarReporte);
  }

  const clear = document.getElementById('report-limpiar');
  if (clear && !clear.dataset.wired) {
    clear.dataset.wired = '1';
    clear.addEventListener('click', limpiarReporte);
  }

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      cambiarModoReporte(button.dataset.reportMode);
    });
  });

  const preview = document.getElementById('report-vista-previa');
  if (preview && !preview.dataset.wired) {
    preview.dataset.wired = '1';
    preview.addEventListener('click', abrirVistaPreviaReporte);
  }

  const print = document.getElementById('report-imprimir-pdf');
  if (print && !print.dataset.wired) {
    print.dataset.wired = '1';
    print.addEventListener('click', imprimirReportePdf);
  }

  const previewPdf = document.getElementById('preview-generar-pdf');
  if (previewPdf && !previewPdf.dataset.wired) {
    previewPdf.dataset.wired = '1';
    previewPdf.addEventListener('click', () => {
      const modalEl = document.getElementById('modalPreviewReporte');
      const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
      modal?.hide();
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

  cambiarModoReporte(obtenerModoReporteActivo());
}

function cambiarModoReporte(modo = 'matricula') {
  const config = MODOS[modo] || MODOS.matricula;
  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === modo);
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

  const title = document.querySelector('#reportes-view .card-title-serif');
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${config.titulo}`;

  limpiarError();
  return modo;
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
  if (filtros.fecha_inicio && filtros.fecha_fin && filtros.fecha_inicio > filtros.fecha_fin) {
    return 'La fecha de inicio no puede ser mayor que la fecha fin.';
  }
  if (filtros.busqueda.length > 120) {
    return 'La búsqueda no puede superar 120 caracteres.';
  }
  if (filtros.busqueda.length === 0) {
    filtros.busqueda = '';
  }
  if (filtros.estado_asistencia && !ESTADOS.includes(filtros.estado_asistencia)) {
    return 'El estado de asistencia seleccionado no es válido.';
  }
  const config = MODOS[filtros.modo] || MODOS.matricula;
  if (!['resumen', 'detalle', 'individual', 'grupo'].includes(filtros.tipo_reporte)) {
    filtros.tipo_reporte = config.tipo;
  }
  return '';
}

function validarRangoFechasEnUI() {
  const filtros = obtenerFiltrosActivos();
  const error = validarFiltros(filtros);
  if (error) mostrarError(error);
  else limpiarError();
}

function mostrarError(message) {
  const box = document.getElementById('report-filtro-error');
  if (box) {
    box.textContent = message;
    box.hidden = false;
  }
}

function limpiarError() {
  const box = document.getElementById('report-filtro-error');
  if (box) {
    box.textContent = '';
    box.hidden = true;
  }
}

async function cargarReporte() {
  const filtros = obtenerFiltrosActivos();
  const error = validarFiltros(filtros);
  if (error) {
    mostrarError(error);
    showToast(error, 'error');
    return;
  }

  limpiarError();
  const button = document.getElementById('report-aplicar');
  const oldText = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generando...';
  }

  try {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (value !== '') params.set(key, value);
    });

    const response = await apiFetch(`/api/procesos/reportes/caso?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.mensaje || data.message || 'No se pudo generar el reporte.');
    }

    reporteActual = data;
    window._reportePdfData = data;
    consultaAplicada = true;

    renderTablaPrincipal(data);
    renderEmptyState(data);
    showToast('Reporte generado correctamente.', 'success');
  } catch (error) {
    consultaAplicada = false;
    reporteActual = null;
    window._reportePdfData = null;
    renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
    renderEmptyState({ detalle_por_grupo: [], detalle: [] }, error.message);
    showToast(error.message || 'No se pudo generar el reporte.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = oldText;
    }
  }
}

function limpiarReporte() {
  const ids = [
    ['report-filtro-grupo', ''],
    ['report-filtro-busqueda', ''],
    ['report-filtro-estado', ''],
    ['report-filtro-fecha-desde', ''],
    ['report-filtro-fecha-hasta', '']
  ];
  ids.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  cambiarModoReporte('matricula');
  const tipo = document.getElementById('report-filtro-tipo');
  if (tipo) tipo.value = MODOS.matricula.tipo;

  consultaAplicada = false;
  reporteActual = null;
  window._reportePdfData = null;
  limpiarError();
  renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
  renderEmptyState(null);
}

function resetearVista() {
  consultaAplicada = false;
  reporteActual = null;
  window._reportePdfData = null;
  renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
  renderEmptyState(null);
}

function renderEmptyState(data, errorMessage = '') {
  const box = document.getElementById('report-empty-state');
  const message = document.getElementById('report-empty-message');
  const rows = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : Array.isArray(data?.detalle) ? data.detalle : [];

  if (!box || !message) return;

  if (!consultaAplicada && !errorMessage) {
    box.hidden = true;
    return;
  }

  if (errorMessage) {
    message.textContent = errorMessage;
    box.hidden = false;
    return;
  }

  if (!rows.length) {
    message.textContent = obtenerMensajeSinDatos();
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

function obtenerMensajeSinDatos() {
  const modo = obtenerModoReporteActivo();
  const busqueda = document.getElementById('report-filtro-busqueda')?.value.trim() || '';
  if (modo === 'pre_matricula' && !busqueda) return 'No hay estudiantes pendientes de matrícula.';
  if (modo === 'auditoria' && !busqueda) return 'No hay registros de auditoría disponibles.';
  if (busqueda) return 'No se encontraron registros con el criterio de búsqueda.';
  return 'No hay registros con los filtros aplicados.';
}

function renderTablaPrincipal(data) {
  const body = document.getElementById('report-grupos-body');
  const head = document.getElementById('report-tabla-head');
  if (!body || !head) return;

  const modo = obtenerModoReporteActivo();
  const grupos = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];

  if (modo === 'pre_matricula') {
    head.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>';
    renderRows(body, detalle, (r) => [
      fullName(r),
      r.id_estudiante ?? '-',
      r.estado ?? 'Activo',
      'Pre-matrícula'
    ]);
    return;
  }

  if (modo === 'auditoria') {
    head.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Detalle</th>';
    renderRows(body, detalle, (r) => [
      formatDate(r.fecha_creacion),
      r.nombre_tabla ?? '-',
      r.accion_usuario ?? '-',
      r.usuario_nombre || r.id_usuario || '-',
      r.datos_nuevos ? 'Disponible' : '-'
    ]);
    return;
  }

  if (modo === 'estudiantes') {
    head.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th><th>Tardías</th><th>Justificadas</th>';
    renderRows(body, grupos, (r) => [
      fullName(r),
      r.grupo ?? r.nombre_grupo ?? '-',
      r.asistencias_registradas ?? 0,
      r.presentes ?? 0,
      r.ausentes ?? 0,
      r.tardias ?? 0,
      r.justificadas ?? 0
    ]);
    return;
  }

  if (modo === 'profesores') {
    head.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderRows(body, grupos, (r) => [
      fullName(r, 'profesor'),
      r.materia ?? r.materia_curso ?? '-',
      r.grupos ?? r.grupo ?? '-',
      r.secciones ?? r.seccion ?? '-',
      r.asistencias_registradas ?? 0,
      r.presentes ?? 0,
      r.ausentes ?? 0
    ]);
    return;
  }

  head.innerHTML = '<th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';

  renderRows(body, grupos, (r) => [
    r.nombre_grupo ?? '-',
    r.nombre_seccion ?? '-',
    r.ocupados ?? 0,
    r.capacidad ?? 0,
    r.asistencias_registradas ?? 0,
    r.presentes ?? 0,
    r.ausentes ?? 0
  ]);
}

function renderRows(body, rows, mapper) {
  body.innerHTML = '';
  if (!rows.length) {
    const colspan = document.querySelector('#report-tabla-head')?.children.length || 1;
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4 text-muted">No hay resultados.</td></tr>`;
    return;
  }
  rows.slice(0, 500).forEach((row) => {
    const tr = document.createElement('tr');
    mapper(row).forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value == null || value === '' ? '-' : String(value);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function abrirVistaPreviaReporte() {
  if (!reporteActual) {
    showToast('Primero genera un reporte con filtros válidos para previsualizarlo.', 'error');
    return;
  }

  const modalEl = document.getElementById('modalPreviewReporte');
  if (!modalEl) return;

  const modo = obtenerModoReporteActivo();
  const filtros = obtenerFiltrosActivos();
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

  document.getElementById('preview-reporte-titulo').textContent = MODOS[modo]?.titulo || 'Reporte académico';
  renderPreviewFilters(filtros);
  renderPreviewMetrics(reporteActual.resumen || {});
  renderPreviewTable(reporteActual);
  modal.show();
}

function renderPreviewFilters(filtros) {
  const area = document.getElementById('preview-reporte-filtros');
  if (!area) return;
  area.innerHTML = '';

  const groupText = document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos los grupos';
  const chips = [`Grupo: ${groupText}`, `Estado: ${filtros.estado_asistencia || 'Todos'}`];

  if (filtros.fecha_inicio) chips.push(`Desde: ${formatDate(filtros.fecha_inicio)}`);
  if (filtros.fecha_fin) chips.push(`Hasta: ${formatDate(filtros.fecha_fin)}`);
  if (filtros.busqueda) chips.push(`Búsqueda: ${filtros.busqueda}`);

  chips.forEach((text) => {
    const span = document.createElement('span');
    span.className = 'preview-reporte-chip';
    span.textContent = text;
    area.appendChild(span);
  });
}

function renderPreviewMetrics(resumen) {
  const area = document.getElementById('preview-reporte-metricas');
  if (!area) return;

  const modo = obtenerModoReporteActivo();
  const metrics = modo === 'auditoria'
    ? [['Auditorías', resumen.total_auditorias ?? 0], ['Registros', resumen.total_registros ?? 0]]
    : modo === 'pre_matricula'
      ? [['Pre-matrículas', resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0], ['Estudiantes', resumen.total_estudiantes ?? 0]]
      : [
          ['Estudiantes', resumen.total_estudiantes ?? 0],
          ['Profesores', resumen.total_profesores ?? 0],
          ['Grupos', resumen.total_grupos ?? 0],
          ['Presentismo', `${resumen.tasa_presentismo ?? 0}%`]
        ];

  area.innerHTML = metrics.map(([label, value]) => `
    <div class="col-6 col-lg-3">
      <div class="report-preview-metric">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    </div>
  `).join('');
}

function renderPreviewTable(data) {
  const mode = obtenerModoReporteActivo();
  const header = document.querySelector('#preview-reporte-tabla thead tr');
  const body = document.getElementById('preview-reporte-detalle-body');
  if (!header || !body) return;

  const detalle = Array.isArray(data.detalle) ? data.detalle : [];
  const agrupado = Array.isArray(data.detalle_por_grupo) ? data.detalle_por_grupo : [];

  if (mode === 'pre_matricula') {
    header.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>';
    renderPreviewRows(body, detalle, (r) => [fullName(r), r.id_estudiante ?? '-', r.estado ?? 'Activo', 'Pre-matrícula']);
    return;
  }

  if (mode === 'auditoria') {
    header.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Detalle</th>';
    renderPreviewRows(body, detalle, (r) => [formatDate(r.fecha_creacion), r.nombre_tabla ?? '-', r.accion_usuario ?? '-', r.usuario_nombre || r.id_usuario || '-', r.datos_nuevos ? 'Disponible' : '-']);
    return;
  }

  if (mode === 'estudiantes') {
    header.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderPreviewRows(body, agrupado, (r) => [fullName(r), r.grupo ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]);
    return;
  }

  if (mode === 'profesores') {
    header.innerHTML = '<th>Profesor</th><th>Materia</th><th>Grupos</th><th>Secciones</th><th>Asistencias</th>';
    renderPreviewRows(body, agrupado, (r) => [fullName(r, 'profesor'), r.materia ?? r.materia_curso ?? '-', r.grupos ?? '-', r.secciones ?? '-', r.asistencias_registradas ?? 0]);
    return;
  }

  header.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
  renderPreviewRows(body, detalle, (r) => [
    formatDate(r.fecha),
    fullName(r),
    r.nombre_grupo ?? '-',
    fullName(r, 'profesor'),
    r.estado_asistencia ?? '-',
    r.observaciones ?? '—'
  ]);
}

function renderPreviewRows(body, rows, mapper) {
  body.innerHTML = '';
  if (!rows.length) {
    const colspan = document.querySelector('#preview-reporte-tabla thead tr')?.children.length || 1;
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4 text-muted">No hay registros detallados.</td></tr>`;
    return;
  }

  rows.slice(0, 12).forEach((row) => {
    const tr = document.createElement('tr');
    mapper(row).forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value == null || value === '' ? '-' : String(value);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function imprimirReportePdf() {
  if (!reporteActual) {
    showToast('Primero genera un reporte.', 'error');
    return;
  }

  const JsPDF = window.jspdf?.jsPDF;
  if (!JsPDF) {
    window.print();
    return;
  }

  const modo = obtenerModoReporteActivo();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const resumen = reporteActual.resumen || {};
  const filtros = obtenerFiltrosActivos();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(MODOS[modo]?.titulo || 'Reporte EduControl', 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 14, 19);
  doc.text(`Rango: ${filtros.fecha_inicio || 'inicio'} - ${filtros.fecha_fin || 'hoy'}`, 14, 24);

  let y = 36;
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(10);

  if (modo === 'auditoria') {
    doc.text(`Auditorías: ${resumen.total_auditorias ?? 0}`, 14, y);
    y += 8;
  } else if (modo === 'pre_matricula') {
    doc.text(`Pre-matrículas: ${resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0}`, 14, y);
    y += 8;
  } else {
    doc.text(`Estudiantes: ${resumen.total_estudiantes ?? 0}   Profesores: ${resumen.total_profesores ?? 0}   Grupos: ${resumen.total_grupos ?? 0}   Presentismo: ${resumen.tasa_presentismo ?? 0}%`, 14, y);
    y += 10;
  }

  const detalle = Array.isArray(reporteActual.detalle) ? reporteActual.detalle : [];
  const agrupado = Array.isArray(reporteActual.detalle_por_grupo) ? reporteActual.detalle_por_grupo : [];

  let rows = [];
  let headers = [];

  if (modo === 'pre_matricula') {
    headers = ['Estudiante', 'Cédula', 'Estado', 'Tipo'];
    rows = detalle.map((r) => [fullName(r), r.id_estudiante ?? '-', r.estado ?? 'Activo', 'Pre-matrícula']);
  } else if (modo === 'auditoria') {
    headers = ['Fecha', 'Tabla', 'Acción', 'Usuario', 'Detalle'];
    rows = detalle.map((r) => [formatDate(r.fecha_creacion), r.nombre_tabla ?? '-', r.accion_usuario ?? '-', r.usuario_nombre || r.id_usuario || '-', r.datos_nuevos ? 'Disponible' : '-']);
  } else if (modo === 'estudiantes') {
    headers = ['Estudiante', 'Grupo', 'Asistencias', 'Presentes', 'Ausentes'];
    rows = agrupado.map((r) => [fullName(r), r.grupo ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]);
  } else if (modo === 'profesores') {
    headers = ['Profesor', 'Materia', 'Grupos', 'Secciones', 'Asistencias'];
    rows = agrupado.map((r) => [fullName(r, 'profesor'), r.materia ?? r.materia_curso ?? '-', r.grupos ?? '-', r.secciones ?? '-', r.asistencias_registradas ?? 0]);
  } else {
    headers = ['Fecha', 'Estudiante', 'Grupo', 'Profesor', 'Estado'];
    rows = detalle.map((r) => [formatDate(r.fecha), fullName(r), r.nombre_grupo ?? '-', fullName(r, 'profesor'), r.estado_asistencia ?? '-']);
  }

  if (!rows.length) {
    doc.text('No hay datos para imprimir con los filtros aplicados.', 14, y);
  } else {
    const widths = headers.map(() => 180 / headers.length);
    rows.slice(0, 500).forEach((row, index) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      if (index === 0 || y === 18) {
        doc.setFillColor(243, 244, 246);
        doc.rect(14, y - 5, 180, 7, 'F');
        doc.setFont('helvetica', 'bold');
        let x = 14;
        headers.forEach((h, i) => {
          doc.text(String(h).slice(0, 22), x + 1, y);
          x += widths[i];
        });
        y += 6;
        doc.setFont('helvetica', 'normal');
      }
      let x = 14;
      row.forEach((value, i) => {
        const text = String(value ?? '-');
        const lines = doc.splitTextToSize(text, widths[i] - 2).slice(0, 3);
        doc.text(lines, x + 1, y);
        x += widths[i];
      });
      y += 7;
    });
  }

  const filename = `${(MODOS[modo]?.titulo || 'Reporte EduControl').replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
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
    select.add(new Option(grupo.nombre_grupo ?? `Grupo ${id}`, id));
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
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('es-CR');
}
