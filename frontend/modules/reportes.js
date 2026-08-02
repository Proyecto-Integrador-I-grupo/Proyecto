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
      cargarReporteResumen();
    });
  }

  const reportPrint = document.getElementById('report-imprimir-pdf');
  if (reportPrint && !reportPrint.dataset.wired) {
    reportPrint.dataset.wired = '1';
    reportPrint.addEventListener('click', imprimirReportePdf);
  }
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