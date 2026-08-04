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

function limpiarTextoReporte(texto = '', maxLength = 120) {
  return String(texto || '').trim().slice(0, maxLength);
}

function validarFiltrosReporte() {
  const filtros = obtenerFiltrosActivos();
  const busqueda = limpiarTextoReporte(filtros.busqueda, 120);
  const fechaDesde = filtros.fechaDesde || '';
  const fechaHasta = filtros.fechaHasta || '';

  if (busqueda && !/^[a-zA-ZÀ-ÿ0-9\s._-]+$/.test(busqueda)) {
    showToast('La búsqueda solo puede contener letras, números, espacios, puntos, guiones y guiones bajos.', 'error');
    return null;
  }

  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    showToast('La fecha de inicio no puede ser mayor que la fecha fin.', 'error');
    return null;
  }

  if (filtros.idGrupo && Number.isNaN(Number(filtros.idGrupo))) {
    showToast('El grupo seleccionado no es válido.', 'error');
    return null;
  }

  return {
    ...filtros,
    busqueda,
    fechaDesde,
    fechaHasta,
    estado: filtros.estado || ''
  };
}

function obtenerFiltrosActivos() {
  return {
    idGrupo: document.getElementById('report-filtro-grupo')?.value || '',
    busqueda: limpiarTextoReporte(document.getElementById('report-filtro-busqueda')?.value || '', 120),
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
  const filtrosValidos = validarFiltrosReporte();
  if (!filtrosValidos) return;

  const params = new URLSearchParams();
  const modo = obtenerModoReporteActivo();
  const { idGrupo, busqueda, tipoReporte, estado, fechaDesde, fechaHasta } = filtrosValidos;

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

  const totalEstudiantesEl = document.getElementById('report-total-estudiantes');
  const totalProfesoresEl = document.getElementById('report-total-profesores');
  const totalGruposEl = document.getElementById('report-total-grupos');
  const tasaPresentismoEl = document.getElementById('report-tasa-presentismo');
  const presentesEl = document.getElementById('report-presentes');
  const ausentesEl = document.getElementById('report-ausentes');
  const tardiasEl = document.getElementById('report-tardias');
  const justificadasEl = document.getElementById('report-justificadas');

  if (totalEstudiantesEl) totalEstudiantesEl.textContent = resumen.total_estudiantes ?? 0;
  if (totalProfesoresEl) totalProfesoresEl.textContent = resumen.total_profesores ?? 0;
  if (totalGruposEl) totalGruposEl.textContent = resumen.total_grupos ?? 0;
  if (tasaPresentismoEl) tasaPresentismoEl.textContent = `${resumen.tasa_presentismo ?? 0}%`;
  if (presentesEl) presentesEl.textContent = resumen.presentes ?? 0;
  if (ausentesEl) ausentesEl.textContent = resumen.ausentes ?? 0;
  if (tardiasEl) tardiasEl.textContent = resumen.tardias ?? 0;
  if (justificadasEl) justificadasEl.textContent = resumen.justificadas ?? 0;

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