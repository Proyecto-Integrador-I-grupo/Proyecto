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

const REPORTE_LOGO_SRC = '../images/logo.jpg';
let reporteLogoDataUrlPromise = null;
let reporteConsultaAplicada = false;

function obtenerMensajeSinDatos() {
  return reporteConsultaAplicada
    ? 'No hay registros con los filtros aplicados.'
    : 'Aún no hay consulta. Presiona Aplicar filtros.';
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
  const reportApply = document.getElementById('report-aplicar');
  if (reportApply && !reportApply.dataset.wired) {
    reportApply.dataset.wired = '1';
    reportApply.addEventListener('click', cargarReporteResumen);
  }

  const reportClear = document.getElementById('report-limpiar');
  if (reportClear && !reportClear.dataset.wired) {
    reportClear.dataset.wired = '1';
    reportClear.addEventListener('click', () => {
      const modoActual = obtenerModoReporteActivo();
      limpiarFiltrosReporte(modoActual);
      resetearVistaReportesVacia(modoActual);
    });
  }

  document.querySelectorAll('[data-report-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const modoSeleccionado = button.dataset.reportMode;
      limpiarFiltrosReporte(modoSeleccionado);
      resetearVistaReportesVacia(modoSeleccionado);
    });
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
  resetearVistaReportesVacia(obtenerModoReporteActivo());
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

function resetearVistaReportesVacia(modo = 'matricula') {
  const modoNormalizado = modo || 'matricula';
  reporteConsultaAplicada = false;
  cambiarModoReporte(modoNormalizado);
  renderTablaPrincipal({ detalle_por_grupo: [], detalle: [] });

  window._reportePdfData = null;
}

function cambiarModoReporte(modo) {
  const buttons = document.querySelectorAll('[data-report-mode]');
  const tipoReporteSel = document.getElementById('report-filtro-tipo');
  const modoNormalizado = modo || 'matricula';
  const config = getModoReporteConfig(modoNormalizado);

  if (tipoReporteSel) {
    tipoReporteSel.value = config.tipoPorDefecto || 'resumen';
  }

  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.reportMode === modoNormalizado);
  });

  document.querySelectorAll('.report-filter-field').forEach((field) => field.classList.add('is-hidden'));
  const visible = config.filtrosVisibles || MODOS_REPORTE_CONFIG.matricula.filtrosVisibles;
  visible.forEach((key) => {
    const field = document.querySelector(`.report-filter-field[data-filter="${key}"]`);
    if (field) field.classList.remove('is-hidden');
  });

  const busquedaLabel = document.getElementById('report-busqueda-label');
  const busquedaInput = document.getElementById('report-filtro-busqueda');
  const labelInfo = config.etiquetaBusqueda || MODOS_REPORTE_CONFIG.matricula.etiquetaBusqueda;
  if (busquedaLabel) {
    busquedaLabel.textContent = labelInfo.label;
  }
  if (busquedaInput) {
    busquedaInput.placeholder = labelInfo.placeholder;
  }

  actualizarEtiquetasModo(modoNormalizado);
}

function obtenerModoReporteActivo() {
  const active = document.querySelector('[data-report-mode].active');
  return active?.dataset.reportMode || 'matricula';
}

function actualizarEtiquetasModo(modo) {
  const title = document.querySelector('#reportes-view .card-title-serif');
  const config = getModoReporteConfig(modo);
  if (title) title.innerHTML = `<i class="bi bi-bar-chart"></i> ${config.titulo || 'Reporte académico'}`;
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

function obtenerRangoFechaAplicado(filtros) {
  const desde = filtros?.fechaDesde || '';
  const hasta = filtros?.fechaHasta || '';

  if (desde && hasta) {
    return `${desde} a ${hasta}`;
  }

  if (desde) {
    return `Desde ${desde}`;
  }

  if (hasta) {
    return `Hasta ${hasta}`;
  }

  return 'Sin rango';
}

function formatearFechaMMDDYYYY(valorFecha) {
  if (!valorFecha) return '—';

  const texto = String(valorFecha).trim();
  if (!texto) return '—';

  const base = texto.includes('T') ? texto.split('T')[0] : texto;
  const isoMatch = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, anio, mes, dia] = isoMatch;
    return `${mes}/${dia}/${anio}`;
  }

  const parsed = new Date(texto);
  if (Number.isNaN(parsed.getTime())) return texto;

  const mes = String(parsed.getMonth() + 1).padStart(2, '0');
  const dia = String(parsed.getDate()).padStart(2, '0');
  const anio = String(parsed.getFullYear());
  return `${mes}/${dia}/${anio}`;
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
    profesores: 'Reporte de profesores',
    pre_matricula: 'Reporte de pre-matrículas',
    auditoria: 'Reporte de auditoría'
  };
  const logoLayoutByMode = {
    matricula: { x: 182, y: 3, width: 22, height: 22 },
    estudiantes: { x: 183, y: 4, width: 21, height: 21 },
    grupos: { x: 184, y: 4, width: 20, height: 20 },
    profesores: { x: 184, y: 4, width: 20, height: 20 },
    pre_matricula: { x: 186, y: 5, width: 18, height: 18 },
    auditoria: { x: 188, y: 6, width: 16, height: 16 }
  };

  const previewLogo = document.getElementById('preview-reporte-logo');
  if (previewLogo) {
    previewLogo.src = REPORTE_LOGO_SRC;
    previewLogo.alt = `Logo ${labels[modo] || 'EduControl'}`;
  }

  document.getElementById('preview-reporte-titulo').textContent = labels[modo] || 'Reporte académico';
  const chipArea = document.getElementById('preview-reporte-filtros');
  const metricsArea = document.getElementById('preview-reporte-metricas');
  const body = document.getElementById('preview-reporte-detalle-body');
  const previewHeader = document.querySelector('#preview-reporte-tabla thead tr');

  chipArea.innerHTML = '';
  const chips = [
    `Grupo: ${document.getElementById('report-filtro-grupo')?.selectedOptions?.[0]?.textContent || 'Todos'}`,
    `Estado: ${filtros.estado || 'Todos'}`,
    `Desde: ${formatearFechaMMDDYYYY(filtros.fechaDesde)}`,
    `Hasta: ${formatearFechaMMDDYYYY(filtros.fechaHasta)}`,
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
      previewHeader.innerHTML = '<th>Fecha aplicada</th><th>Profesor</th><th>Materia</th><th>Grupo</th><th>Sección</th><th>Estado</th>';
    } else if (modo === 'pre_matricula') {
      previewHeader.innerHTML = '<th>Estudiante</th><th>Cédula</th><th>Estado</th><th>Pre-matrícula</th>';
    } else if (modo === 'auditoria') {
      previewHeader.innerHTML = '<th>Fecha</th><th>Tabla</th><th>Acción</th><th>Usuario</th><th>Datos</th>';
    } else {
      previewHeader.innerHTML = '<th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th>';
    }
  }

  if (modo === 'profesores') {
    metricsArea.innerHTML = '';
  } else if (modo === 'pre_matricula') {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Pre-matrículas</span>
          <div class="stat-value">${resumen.total_pre_matriculas ?? resumen.total_estudiantes ?? 0}</div>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Estudiantes activos</span>
          <div class="stat-value">${resumen.total_estudiantes ?? 0}</div>
        </div>
      </div>
    `;
  } else if (modo === 'auditoria') {
    metricsArea.innerHTML = `
      <div class="col-6 col-lg-3">
        <div class="stat-card report-stat-card h-100">
          <span class="stat-label">Auditorías</span>
          <div class="stat-value">${resumen.total_auditorias ?? resumen.total_registros ?? 0}</div>
        </div>
      </div>
    `;
  } else if (modo === 'grupos') {
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

  const detalleProfesor = Array.isArray(detalle_por_grupo) ? detalle_por_grupo : [];
  const registrosPreview = modo === 'profesores' ? detalleProfesor : detalle;

  if (!registrosPreview.length) {
    const previewColspan = modo === 'profesores' ? 6 : modo === 'pre_matricula' ? 4 : modo === 'auditoria' ? 5 : 6;
    body.innerHTML = `<tr><td colspan="${previewColspan}" class="text-center py-4 text-muted">No hay registros detallados para esta vista previa.</td></tr>`;
  } else {
    body.innerHTML = '';
    const etiquetasEstado = {
      presente: 'Presente',
      ausente: 'Ausente',
      tardia: 'Tardía',
      justificada: 'Justificada'
    };

    registrosPreview.slice(0, 12).forEach((r) => {
      const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
      const profesor = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''} ${r.profesor_apellido2 ?? ''}`.trim();
      const fecha = formatearFechaMMDDYYYY(r.fecha);
      const estado = (r.estado_asistencia || '').toLowerCase();
      const tr = document.createElement('tr');
      if (modo === 'profesores') {
        const profesorNombre = `${r.profesor_nombre ?? ''} ${r.profesor_apellido1 ?? ''} ${r.profesor_apellido2 ?? ''}`.trim();
        const materia = r.materia || r.materia_curso || '-';
        const grupos = r.grupos || r.grupos_asignados || r.grupo || '-';
        const secciones = r.secciones || r.nombre_seccion || r.seccion || '-';
        const profesorEstado = (r.estado === 'Inactivo' || r.profesor_estado === false || r.profesor_estado === 0) ? 'Inactivo' : 'Activo';
        const fechaAplicada = obtenerRangoFechaAplicado(filtros);
        tr.innerHTML = `
          <td>${fechaAplicada}</td>
          <td>${profesorNombre || '-'}</td>
          <td>${materia}</td>
          <td>${grupos}</td>
          <td>${secciones}</td>
          <td><span class="attendance-status">${profesorEstado}</span></td>
        `;
      } else if (modo === 'pre_matricula') {
        const estudianteCompleto = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
        tr.innerHTML = `
          <td>${estudianteCompleto || '-'}</td>
          <td>${r.id_estudiante || '-'}</td>
          <td><span class="attendance-status">${r.estado || 'Activo'}</span></td>
          <td>Pre-matrícula</td>
        `;
      } else if (modo === 'auditoria') {
        const nuevos = r.datos_nuevos ? JSON.stringify(r.datos_nuevos) : '—';
        tr.innerHTML = `
          <td>${formatearFechaMMDDYYYY(r.fecha_creacion)}</td>
          <td>${r.nombre_tabla || '-'}</td>
          <td>${r.accion_usuario || '-'}</td>
          <td>${r.usuario_nombre || r.id_usuario || '-'}</td>
          <td title="${nuevos}">${r.datos_nuevos ? 'Detalle' : '—'}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>${fecha}</td>
          <td>${estudiante || '-'}</td>
          <td>${r.nombre_grupo ?? '-'}</td>
          <td>${profesor || '-'}</td>
          <td><span class="attendance-badge attendance-${estado}">${etiquetasEstado[estado] || r.estado_asistencia || '-'}</span></td>
          <td class="observaciones-cell" title="${r.observaciones ?? ''}">${r.observaciones || '—'}</td>
        `;
      }
      body.appendChild(tr);
    });
  }

  modal.show();
}

async function imprimirReportePdf() {
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
    profesores: 'Reporte de profesores',
    pre_matricula: 'Reporte de pre-matrículas',
    auditoria: 'Reporte de auditoría'
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

  const logoDataUrl = await obtenerLogoReporteDataUrl();
  if (logoDataUrl) {
    try {
      const logoLayout = logoLayoutByMode[modo] || logoLayoutByMode.matricula;
      doc.addImage(
        logoDataUrl,
        'JPEG',
        logoLayout.x,
        logoLayout.y,
        logoLayout.width,
        logoLayout.height
      );
    } catch (error) {
      console.warn('No se pudo incrustar el logo en el PDF:', error);
    }
  }

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
            `Rango de fecha aplicado: ${obtenerRangoFechaAplicado(obtenerFiltrosActivos())}`,
            `Grupos vinculados: ${detalle_por_grupo.length}`
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

  if (modo === 'profesores' && detalle_por_grupo?.length) {
    const fechaAplicada = obtenerRangoFechaAplicado(obtenerFiltrosActivos());
    const lineasDetalle = detalle_por_grupo.slice(0, 32).map((registro) => {
      const profesor = `${registro.profesor_nombre ?? ''} ${registro.profesor_apellido1 ?? ''} ${registro.profesor_apellido2 ?? ''}`.trim() || '-';
      return `${fechaAplicada} | ${profesor} | ${registro.materia ?? '-'} | ${registro.grupos ?? '-'} | ${registro.secciones ?? '-'} | ${registro.estado ?? 'Activo'}`;
    });
    agregarBloque('Detalle de profesores', lineasDetalle);
  } else if (detalle?.length) {
    const lineasDetalle = detalle.slice(0, 32).map((registro) => {
      const estudiante = `${registro.estudiante_nombre ?? ''} ${registro.estudiante_apellido1 ?? ''} ${registro.estudiante_apellido2 ?? ''}`.trim() || '-';
      const profesor = `${registro.profesor_nombre ?? ''} ${registro.profesor_apellido1 ?? ''}`.trim() || '-';
      const fecha = registro.fecha ? String(registro.fecha).split('T')[0] : '-';
      return `${fecha} | ${estudiante} | ${registro.nombre_grupo ?? '-'} | ${profesor} | ${registro.estado_asistencia ?? '-'}`;
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
  reporteConsultaAplicada = true;
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
    renderTablaPrincipal(casoJson);
  } catch (error) {
    console.error('Error cargando reportes', error);
    const body = document.getElementById('report-grupos-body');
    if (body) {
      body.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Error al cargar el reporte.</td></tr>';
    }
  }
}

function renderTablaPrincipal(data = {}) {
  const modo = obtenerModoReporteActivo();
  const filtros = obtenerFiltrosActivos();
  const fechaAplicada = obtenerRangoFechaAplicado(filtros);
  const registros = modo === 'profesores'
    ? (Array.isArray(data?.detalle_por_grupo) ? data.detalle_por_grupo : [])
    : (Array.isArray(data?.detalle) ? data.detalle : []);

  const body = document.getElementById('report-grupos-body');
  const table = body?.closest('table');
  const header = table?.querySelector('thead tr');

  if (header) {
    if (modo === 'profesores') {
      header.innerHTML = `
        <th>Fecha aplicada</th>
        <th>Profesor</th>
        <th>Materia</th>
        <th>Grupo</th>
        <th>Sección</th>
        <th>Estado</th>
      `;
    } else if (modo === 'pre_matricula') {
      header.innerHTML = `
        <th>Estudiante</th>
        <th>Cédula</th>
        <th>Estado</th>
        <th>Pre-matrícula</th>
      `;
    } else if (modo === 'auditoria') {
      header.innerHTML = `
        <th>Fecha</th>
        <th>Tabla</th>
        <th>Acción</th>
        <th>Usuario</th>
        <th>Detalle</th>
      `;
    } else {
      header.innerHTML = `
        <th>Fecha</th>
        <th>Estudiante</th>
        <th>Grupo</th>
        <th>Profesor</th>
        <th>Estado</th>
        <th>Observaciones</th>
      `;
    }
  }

  if (!body) return;
  body.innerHTML = '';

  if (!registros.length) {
    const colspan = modo === 'profesores' ? 6 : modo === 'pre_matricula' ? 4 : modo === 'auditoria' ? 5 : 6;
    body.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-5 text-muted">${obtenerMensajeSinDatos()}</td></tr>`;
    return;
  }

  if (modo === 'profesores') {
    registros.forEach((g) => {
      const nombre = `${g.profesor_nombre ?? ''} ${g.profesor_apellido1 ?? ''} ${g.profesor_apellido2 ?? ''}`.trim();
      const estado = (g.estado || 'Activo') === 'Activo' || g.estado === 1 || g.estado === true ? 'Activo' : 'Inactivo';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fechaAplicada}</td>
        <td>${nombre || '-'}</td>
        <td>${g.materia || g.materia_curso || '-'}</td>
        <td>${g.grupos || g.grupos_asignados || g.grupo || '-'}</td>
        <td>${g.secciones || g.nombre_seccion || g.seccion || '-'}</td>
        <td>${estado}</td>
      `;
      body.appendChild(tr);
    });
    return;
  }

  if (modo === 'pre_matricula') {
    registros.forEach((r) => {
      const estudiante = `${r.estudiante_nombre ?? ''} ${r.estudiante_apellido1 ?? ''} ${r.estudiante_apellido2 ?? ''}`.trim();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${estudiante || '-'}</td>
        <td>${r.id_estudiante || '-'}</td>
        <td><span class="attendance-status">${r.estado || 'Activo'}</span></td>
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
        <td>${r.fecha_creacion ? String(r.fecha_creacion).split('T')[0] : '-'}</td>
        <td>${r.nombre_tabla || '-'}</td>
        <td>${r.accion_usuario || '-'}</td>
        <td>${r.usuario_nombre || r.id_usuario || '-'}</td>
        <td title="${r.datos_nuevos ?? ''}">${r.datos_nuevos ? 'Detalle' : '—'}</td>
      `;
      body.appendChild(tr);
    });
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