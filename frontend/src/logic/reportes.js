import { apiFetch, showToast } from './ui.js';
import { populateGruposSelects, allGrupos } from './matricula.js';

const ESTADOS = ['presente', 'ausente', 'tardia', 'justificada'];

let reporteConsultaAplicada = false;
let reporteActual = null;

const REPORTE_LOGO_SRC = '../images/logo.jpg';
let reporteLogoDataUrlPromise = null;

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
  resetearVista(obtenerModoReporteActivo());
}

const MODOS_REPORTE_CONFIG = {
  matricula: {
    tipoPorDefecto: 'resumen',
    filtrosVisibles: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula' },
    titulo: 'Reporte de matrícula'
  },
  estudiantes: {
    tipoPorDefecto: 'individual',
    filtrosVisibles: ['grupo', 'busqueda', 'estado', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula del estudiante' },
    titulo: 'Reporte de estudiantes'
  },
  grupos: {
    tipoPorDefecto: 'grupo',
    filtrosVisibles: ['grupo', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula' },
    titulo: 'Reporte de grupos'
  },
  profesores: {
    tipoPorDefecto: 'resumen',
    filtrosVisibles: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Profesor / Cédula', placeholder: 'Nombre, apellido o cédula del profesor' },
    titulo: 'Reporte de profesores'
  },
  pre_matricula: {
    tipoPorDefecto: 'resumen',
    filtrosVisibles: ['grupo', 'busqueda', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Estudiante / Cédula', placeholder: 'Nombre, apellido o cédula del pre-registro' },
    titulo: 'Reporte de pre-matrículas'
  },
  auditoria: {
    tipoPorDefecto: 'detalle',
    filtrosVisibles: ['busqueda', 'fecha-desde', 'fecha-hasta'],
    etiquetaBusqueda: { label: 'Auditoría / Acción', placeholder: 'Tabla, usuario o acción' },
    titulo: 'Reporte de auditoría'
  }
};

function getModoReporteConfig(modo) {
  return MODOS_REPORTE_CONFIG[modo] || MODOS_REPORTE_CONFIG.matricula;
}

function obtenerMensajeSinDatos(modo = obtenerModoReporteActivo(), filtros = obtenerFiltrosActivos()) {
  if (!reporteConsultaAplicada) {
    return 'Aún no hay consulta. Presiona Aplicar filtros.';
  }

  const busqueda = (filtros?.busqueda || '').trim();

  if (modo === 'pre_matricula' && !busqueda) {
    return 'No hay estudiantes pendientes de matrícula.';
  }
  if (modo === 'auditoria' && !busqueda) {
    return 'No hay registros de auditoría disponibles.';
  }
  if (modo === 'matricula' && busqueda) {
    return 'No se encontraron estudiantes con ese nombre en matrícula.';
  }
  if (modo === 'estudiantes' && busqueda) {
    return 'No se encontraron estudiantes con ese criterio.';
  }
  if (modo === 'profesores' && busqueda) {
    return 'No se encontraron profesores con ese criterio.';
  }
  if (busqueda) {
    return 'No se encontraron registros con el criterio de búsqueda.';
  }

  return 'No hay registros con los filtros aplicados.';
}

function obtenerLogoReporteDataUrl() {
  if (!reporteLogoDataUrlPromise) {
    reporteLogoDataUrlPromise = fetch(REPORTE_LOGO_SRC)
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar el logo para el PDF.');
        }
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo convertir el logo para el PDF.'));
        reader.readAsDataURL(blob);
      }))
      .catch((error) => {
        console.warn(error.message || error);
        reporteLogoDataUrlPromise = null;
        return null;
      });
  }

  return reporteLogoDataUrlPromise;
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
    clear.addEventListener('click', () => limpiarReporte(obtenerModoReporteActivo()));
  }

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = '1';
    button.addEventListener('click', () => {
      const modoSeleccionado = button.dataset.reportMode;
      limpiarFiltrosReporte(modoSeleccionado);
      resetearVista(modoSeleccionado);
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

function limpiarFiltrosReporte(modo = obtenerModoReporteActivo()) {
  const grupoSel = document.getElementById('report-filtro-grupo');
  const busquedaInput = document.getElementById('report-filtro-busqueda');
  const tipoReporteSel = document.getElementById('report-filtro-tipo');
  const estadoSel = document.getElementById('report-filtro-estado');
  const fechaDesde = document.getElementById('report-filtro-fecha-desde');
  const fechaHasta = document.getElementById('report-filtro-fecha-hasta');
  const config = getModoReporteConfig(modo);

  if (grupoSel) grupoSel.value = '';
  if (busquedaInput) busquedaInput.value = '';
  if (tipoReporteSel) tipoReporteSel.value = config.tipoPorDefecto || 'resumen';
  if (estadoSel) estadoSel.value = '';
  if (fechaDesde) fechaDesde.value = '';
  if (fechaHasta) fechaHasta.value = '';
}

function limpiarReporte(modo = obtenerModoReporteActivo()) {
  limpiarFiltrosReporte(modo);
  resetearVista(modo);
}

function resetearVista(modo = 'matricula') {
  const modoNormalizado = modo || 'matricula';
  reporteConsultaAplicada = false;
  reporteActual = null;
  cambiarModoReporte(modoNormalizado);
  renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });
  renderEmptyState(null);
}

function cambiarModoReporte(modo) {
  const modoNormalizado = modo || 'matricula';
  const config = getModoReporteConfig(modoNormalizado);

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === modoNormalizado);
  });

  document.querySelectorAll('.report-filter-field').forEach((field) => field.classList.add('is-hidden'));
  const visible = config.filtrosVisibles || MODOS_REPORTE_CONFIG.matricula.filtrosVisibles;
  visible.forEach((key) => {
    const field = document.querySelector(`.report-filter-field[data-filter="${key}"]`);
    if (field) field.classList.remove('is-hidden');
  });

  const tipoReporteSel = document.getElementById('report-filtro-tipo');
  if (tipoReporteSel) tipoReporteSel.value = config.tipoPorDefecto || 'resumen';

  const busquedaLabel = document.getElementById('report-busqueda-label');
  const busquedaInput = document.getElementById('report-filtro-busqueda');
  const labelInfo = config.etiquetaBusqueda || MODOS_REPORTE_CONFIG.matricula.etiquetaBusqueda;
  if (busquedaLabel) busquedaLabel.textContent = labelInfo.label;
  if (busquedaInput) busquedaInput.placeholder = labelInfo.placeholder;

  actualizarEtiquetasModo(modoNormalizado);
  limpiarError();
}

function obtenerModoReporteActivo() {
  return document.querySelector('[data-report-mode].active')?.dataset.reportMode || 'matricula';
}

function actualizarEtiquetasModo(modo) {
  const title = document.querySelector('#reportes-view .card-title-serif');
  const config = getModoReporteConfig(modo);
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${config.titulo || 'Reporte académico'}`;
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

function obtenerRangoFechaAplicado(filtros = obtenerFiltrosActivos()) {
  const desde = filtros?.fecha_inicio || '';
  const hasta = filtros?.fecha_fin || '';

  if (desde && hasta) return `${desde} a ${hasta}`;
  if (desde) return `Desde ${desde}`;
  if (hasta) return `Hasta ${hasta}`;
  return 'Sin rango';
}

function validarFiltros(filtros) {
  if (filtros.fecha_inicio && filtros.fecha_fin && filtros.fecha_inicio > filtros.fecha_fin) {
    return 'La fecha de inicio no puede ser mayor que la fecha fin.';
  }
  if (filtros.busqueda.length > 120) {
    return 'La búsqueda no puede superar 120 caracteres.';
  }
  if (filtros.estado_asistencia && !ESTADOS.includes(filtros.estado_asistencia)) {
    return 'El estado de asistencia seleccionado no es válido.';
  }
  const config = getModoReporteConfig(filtros.modo);
  if (!['resumen', 'detalle', 'individual', 'grupo'].includes(filtros.tipo_reporte)) {
    filtros.tipo_reporte = config.tipoPorDefecto;
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
    reporteConsultaAplicada = true;

    renderTablaPrincipal(data);
    renderEmptyState(data);
    showToast('Reporte generado correctamente.', 'success');
  } catch (error) {
    reporteConsultaAplicada = false;
    reporteActual = null;
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

function renderEmptyState(data, errorMessage = '') {
  const box = document.getElementById('report-empty-state');
  const message = document.getElementById('report-empty-message');
  if (!box || !message) return;

  const rows = Array.isArray(data?.detalle_por_grupo) && data.detalle_por_grupo.length
    ? data.detalle_por_grupo
    : Array.isArray(data?.detalle) ? data.detalle : [];

  if (!reporteConsultaAplicada && !errorMessage) {
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

function renderTablaPrincipal(data = {}) {
  const modo = obtenerModoReporteActivo();
  const filtros = obtenerFiltrosActivos();
  const fechaAplicada = obtenerRangoFechaAplicado(filtros);

  const body = document.getElementById('report-grupos-body');
  const table = body?.closest('table');
  const header = table?.querySelector('thead tr');
  if (!body || !header) return;

  const registrosPorGrupo = Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [];
  const detalle = Array.isArray(data?.detalle) ? data.detalle : [];
  const registros = modo === 'profesores' ? registrosPorGrupo
    : (modo === 'estudiantes' || modo === 'grupos') && registrosPorGrupo.length ? registrosPorGrupo
    : detalle;

  if (modo === 'profesores') {
    header.innerHTML = '<th>Fecha aplicada</th><th>Profesor</th><th>Materia</th><th>Grupo</th><th>Sección</th><th>Estado</th>';
  } else if (modo === 'pre_matricula') {
    header.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Pre-matrícula</th>';
  } else if (modo === 'auditoria') {
    header.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Detalle</th>';
  } else if (modo === 'estudiantes') {
    header.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th><th>Tardías</th><th>Justificadas</th>';
  } else if (modo === 'grupos') {
    header.innerHTML = '<th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
  } else {
    header.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
  }

  body.innerHTML = '';

  if (!registros.length) {
    const colspan = header.children.length || 1;
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-5 text-muted">${obtenerMensajeSinDatos(modo, filtros)}</td></tr>`;
    return;
  }

  const etiquetasEstado = {
    presente: 'Presente',
    ausente: 'Ausente',
    tardia: 'Tardía',
    justificada: 'Justificada'
  };

  if (modo === 'profesores') {
    registros.forEach((r) => {
      const nombre = fullName(r, 'profesor');
      const estado = (r.estado === 'Inactivo' || r.profesor_estado === false || r.profesor_estado === 0) ? 'Inactivo' : 'Activo';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fechaAplicada}</td>
        <td>${nombre}</td>
        <td>${r.materia ?? r.materia_curso ?? '-'}</td>
        <td>${r.grupos ?? r.grupos_asignados ?? r.grupo ?? '-'}</td>
        <td>${r.secciones ?? r.nombre_seccion ?? r.seccion ?? '-'}</td>
        <td><span class="attendance-status">${estado}</span></td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'pre_matricula') {
    registros.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fullName(r)}</td>
        <td>${r.id_estudiante ?? '-'}</td>
        <td><span class="attendance-status">${r.estado ?? 'Activo'}</span></td>
        <td>Pre-matrícula</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'auditoria') {
    registros.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(r.fecha_creacion)}</td>
        <td>${r.nombre_tabla ?? '-'}</td>
        <td>${r.accion_usuario ?? '-'}</td>
        <td>${r.usuario_nombre || r.id_usuario || '-'}</td>
        <td title="${r.datos_nuevos ? JSON.stringify(r.datos_nuevos) : ''}">${r.datos_nuevos ? 'Detalle' : '—'}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'estudiantes') {
    registros.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fullName(r)}</td>
        <td>${r.grupo ?? r.nombre_grupo ?? '-'}</td>
        <td>${r.asistencias_registradas ?? 0}</td>
        <td>${r.presentes ?? 0}</td>
        <td>${r.ausentes ?? 0}</td>
        <td>${r.tardias ?? 0}</td>
        <td>${r.justificadas ?? 0}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'grupos') {
    registros.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.nombre_grupo ?? '-'}</td>
        <td>${r.nombre_seccion ?? '-'}</td>
        <td>${r.ocupados ?? 0}</td>
        <td>${r.capacidad ?? 0}</td>
        <td>${r.asistencias_registradas ?? 0}</td>
        <td>${r.presentes ?? 0}</td>
        <td>${r.ausentes ?? 0}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  // matrícula (por defecto)
  registros.forEach((r) => {
    const estudiante = fullName(r);
    const profesor = fullName(r, 'profesor');
    const fecha = formatDate(r.fecha);
    const estado = (r.estado_asistencia || '').toLowerCase();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${estudiante}</td>
      <td>${r.nombre_grupo ?? '-'}</td>
      <td>${profesor}</td>
      <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
      <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
    `;
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
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);

  const modo = obtenerModoReporteActivo();
  const filtros = obtenerFiltrosActivos();
  const config = getModoReporteConfig(modo);

  const previewLogo = document.getElementById('preview-reporte-logo');
  if (previewLogo) {
    previewLogo.src = REPORTE_LOGO_SRC;
    previewLogo.alt = `Logo ${config.titulo || 'EduControl'}`;
  }

  const tituloEl = document.getElementById('preview-reporte-titulo');
  if (tituloEl) tituloEl.textContent = config.titulo || 'Reporte académico';

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
  const chips = [
    `Grupo: ${groupText}`,
    `Estado: ${filtros.estado_asistencia || 'Todos'}`,
    `Desde: ${formatDate(filtros.fecha_inicio)}`,
    `Hasta: ${formatDate(filtros.fecha_fin)}`,
    `Búsqueda: ${filtros.busqueda || '—'}`
  ];

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
  const modo = obtenerModoReporteActivo();
  const header = document.querySelector('#preview-reporte-tabla thead tr');
  const body = document.getElementById('preview-reporte-detalle-body');
  if (!header || !body) return;

  const detalle = Array.isArray(data.detalle) ? data.detalle : [];
  const agrupado = Array.isArray(data.detalle_por_grupo) ? data.detalle_por_grupo : [];
  const filtros = obtenerFiltrosActivos();
  const fechaAplicada = obtenerRangoFechaAplicado(filtros);

  if (modo === 'pre_matricula') {
    header.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Tipo</th>';
    renderPreviewRows(body, detalle, (r) => [fullName(r), r.id_estudiante ?? '-', r.estado ?? 'Activo', 'Pre-matrícula']);
    return;
  }

  if (modo === 'auditoria') {
    header.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Detalle</th>';
    renderPreviewRows(body, detalle, (r) => [formatDate(r.fecha_creacion), r.nombre_tabla ?? '-', r.accion_usuario ?? '-', r.usuario_nombre || r.id_usuario || '-', r.datos_nuevos ? 'Disponible' : '-']);
    return;
  }

  if (modo === 'profesores') {
    header.innerHTML = '<th>Fecha aplicada</th><th>Profesor</th><th>Materia</th><th>Grupo</th><th>Sección</th><th>Estado</th>';
    renderPreviewRows(body, agrupado, (r) => [
      fechaAplicada,
      fullName(r, 'profesor'),
      r.materia ?? r.materia_curso ?? '-',
      r.grupos ?? r.grupo ?? '-',
      r.secciones ?? r.seccion ?? '-',
      r.estado ?? 'Activo'
    ]);
    return;
  }

  if (modo === 'estudiantes') {
    header.innerHTML = '<th>Estudiante</th><th>Grupo</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th>';
    renderPreviewRows(body, agrupado, (r) => [fullName(r), r.grupo ?? '-', r.asistencias_registradas ?? 0, r.presentes ?? 0, r.ausentes ?? 0]);
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
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-4 text-muted">No hay registros detallados para esta vista previa.</td></tr>`;
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

async function imprimirReportePdf() {
  if (!reporteActual) {
    showToast('Primero genera un reporte con filtros válidos.', 'error');
    return;
  }

  const docConstructor = window.jspdf?.jsPDF;
  if (!docConstructor) {
    document.title = 'Reporte administrativo - PDF';
    window.print();
    return;
  }

  const modo = obtenerModoReporteActivo();
  const config = getModoReporteConfig(modo);
  const logoLayoutByMode = {
    matricula: { x: 182, y: 3, width: 22, height: 22 },
    estudiantes: { x: 183, y: 4, width: 21, height: 21 },
    grupos: { x: 184, y: 4, width: 20, height: 20 },
    profesores: { x: 184, y: 4, width: 20, height: 20 },
    pre_matricula: { x: 186, y: 5, width: 18, height: 18 },
    auditoria: { x: 188, y: 6, width: 16, height: 16 }
  };

  const { detalle_por_grupo = [], detalle = [] } = reporteActual;
  const doc = new docConstructor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageHeight = 290;
  let y = 36;

  const nuevaPagina = () => {
    doc.addPage();
    y = 18;
  };

  const agregarTituloSeccion = (titulo) => {
    if (y > pageHeight - 24) nuevaPagina();
    doc.setFillColor(236, 244, 255);
    doc.rect(12, y - 6, 186, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(titulo, 14, y);
    y += 8;
  };

  const dibujarHeaderTabla = (columnas) => {
    const left = 12;
    const rowHeight = 6;
    const totalWidth = columnas.reduce((acc, col) => acc + col.width, 0);
    const topHeaderY = y - 5;

    doc.setFillColor(243, 244, 246);
    doc.rect(left, topHeaderY, totalWidth, rowHeight, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.rect(left, topHeaderY, totalWidth, rowHeight);

    let x = left;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(45, 55, 72);
    columnas.forEach((col) => {
      doc.text(col.label, x + 1.2, y - 1);
      x += col.width;
    });

    y += 2;
    return { left, totalWidth, rowHeight };
  };

  const agregarTablaAcademica = (titulo, columnas, filas) => {
    agregarTituloSeccion(titulo);

    if (!filas.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('No hay datos para imprimir con los filtros aplicados.', 14, y);
      y += 8;
      return;
    }

    let { left, totalWidth, rowHeight } = dibujarHeaderTabla(columnas);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(25, 25, 25);

    filas.forEach((fila) => {
      const cellPaddingX = 1.2;
      const cellPaddingY = 2.8;
      const lineHeight = 3.6;
      const filasEnCelda = columnas.map((col, idx) => {
        const valor = String(fila[idx] ?? '-');
        const anchoTexto = Math.max(col.width - (cellPaddingX * 2), 2);
        const lineas = doc.splitTextToSize(valor, anchoTexto);
        return Array.isArray(lineas) && lineas.length ? lineas : ['-'];
      });
      const maxLineas = Math.max(...filasEnCelda.map((lineas) => lineas.length));
      const rowHeightDinamico = Math.max(rowHeight, (maxLineas * lineHeight) + 2.4);

      if (y > pageHeight - rowHeightDinamico - 3) {
        nuevaPagina();
        agregarTituloSeccion(`${titulo} (continuación)`);
        ({ left, totalWidth, rowHeight } = dibujarHeaderTabla(columnas));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(25, 25, 25);
      }

      let x = left;
      filasEnCelda.forEach((lineas, idx) => {
        const col = columnas[idx];
        lineas.forEach((linea, lineIdx) => {
          doc.text(linea, x + cellPaddingX, y + cellPaddingY + (lineIdx * lineHeight));
        });
        x += col.width;
      });

      doc.setDrawColor(235, 235, 235);
      doc.line(left, y + rowHeightDinamico, left + totalWidth, y + rowHeightDinamico);
      y += rowHeightDinamico;
    });

    y += 4;
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.titulo || 'Reporte EduControl', 14, 12);

  const logoDataUrl = await obtenerLogoReporteDataUrl();
  if (logoDataUrl) {
    try {
      const logoLayout = logoLayoutByMode[modo] || logoLayoutByMode.matricula;
      doc.addImage(logoDataUrl, 'JPEG', logoLayout.x, logoLayout.y, logoLayout.width, logoLayout.height);
    } catch (error) {
      console.warn('No se pudo incrustar el logo en el PDF:', error);
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 14, 20);

  y = 36;
  doc.setTextColor(0, 0, 0);

  let columnas = [];
  let filas = [];

  if (modo === 'profesores' && detalle_por_grupo?.length) {
    const fechaAplicada = obtenerRangoFechaAplicado(obtenerFiltrosActivos());
    columnas = [
      { label: 'Fecha aplicada', width: 24 },
      { label: 'Profesor', width: 44 },
      { label: 'Materia', width: 24 },
      { label: 'Grupo(s)', width: 30 },
      { label: 'Sección(es)', width: 42 },
      { label: 'Estado', width: 22 }
    ];
    filas = detalle_por_grupo.map((r) => [
      fechaAplicada,
      fullName(r, 'profesor'),
      r.materia ?? '-',
      r.grupos ?? '-',
      r.secciones ?? '-',
      r.estado ?? 'Activo'
    ]);
  } else if (modo === 'estudiantes' && detalle_por_grupo?.length) {
    columnas = [
      { label: 'Estudiante', width: 60 },
      { label: 'Grupo', width: 30 },
      { label: 'Asistencias', width: 24 },
      { label: 'Presentes', width: 24 },
      { label: 'Ausentes', width: 24 },
      { label: 'Tardías', width: 24 }
    ];
    filas = detalle_por_grupo.map((r) => [
      fullName(r),
      r.grupo ?? '-',
      r.asistencias_registradas ?? 0,
      r.presentes ?? 0,
      r.ausentes ?? 0,
      r.tardias ?? 0
    ]);
  } else if (modo === 'grupos' && detalle_por_grupo?.length) {
    columnas = [
      { label: 'Grupo', width: 34 },
      { label: 'Sección', width: 34 },
      { label: 'Ocupados', width: 26 },
      { label: 'Capacidad', width: 26 },
      { label: 'Asistencias', width: 26 },
      { label: 'Presentes', width: 26 }
    ];
    filas = detalle_por_grupo.map((r) => [
      r.nombre_grupo ?? '-',
      r.nombre_seccion ?? '-',
      r.ocupados ?? 0,
      r.capacidad ?? 0,
      r.asistencias_registradas ?? 0,
      r.presentes ?? 0
    ]);
  } else if (detalle?.length) {
    if (modo === 'auditoria') {
      columnas = [
        { label: 'Fecha', width: 24 },
        { label: 'Tabla', width: 28 },
        { label: 'Acción', width: 22 },
        { label: 'Usuario', width: 30 },
        { label: 'Detalle', width: 82 }
      ];
      filas = detalle.map((r) => [
        formatDate(r.fecha_creacion),
        r.nombre_tabla ?? '-',
        r.accion_usuario ?? '-',
        r.usuario_nombre || r.id_usuario || '-',
        r.datos_nuevos ? 'Disponible' : '-'
      ]);
    } else if (modo === 'pre_matricula') {
      columnas = [
        { label: 'Estudiante', width: 82 },
        { label: 'Cédula', width: 28 },
        { label: 'Estado', width: 20 },
        { label: 'Tipo', width: 58 }
      ];
      filas = detalle.map((r) => [fullName(r), r.id_estudiante ?? '-', r.estado ?? 'Activo', 'Pre-matrícula']);
    } else {
      columnas = [
        { label: 'Fecha', width: 20 },
        { label: 'Estudiante', width: 44 },
        { label: 'Grupo', width: 22 },
        { label: 'Profesor', width: 40 },
        { label: 'Estado', width: 18 },
        { label: 'Observaciones', width: 42 }
      ];
      filas = detalle.map((r) => [
        formatDate(r.fecha),
        fullName(r),
        r.nombre_grupo ?? '-',
        fullName(r, 'profesor'),
        r.estado_asistencia ?? '-',
        r.observaciones || '-'
      ]);
    }
  }

  agregarTablaAcademica('Detalle académico', columnas, filas);

  const nombreArchivo = `${(config.titulo || 'Reporte EduControl').replace(/\s+/g, '_')}.pdf`;
  doc.save(nombreArchivo);
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