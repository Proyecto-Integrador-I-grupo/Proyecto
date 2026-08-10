import React from 'react';

export default function Reportes() {
  return (
    <><section id="reportes-view" className="view hidden admin-only">
<div className="report-shell">
<div className="card border-0 shadow-sm mb-4">
<div className="card-body">
<div className="report-menu-top mb-3">
<div className="btn-group report-mode-switcher w-100" role="group" aria-label="Casos de reporte">
<button type="button" className="btn btn-sm active" data-report-mode="matricula"><i className="bi bi-journal-check"></i> Matrícula</button>
<button type="button" className="btn btn-sm" data-report-mode="estudiantes"><i className="bi bi-people-fill"></i> Estudiantes</button>
<button type="button" className="btn btn-sm" data-report-mode="grupos"><i className="bi bi-diagram-3"></i> Grupos</button>
<button type="button" className="btn btn-sm" data-report-mode="profesores"><i className="bi bi-person-badge"></i> Profesores</button>
</div>
</div>
<div className="filter-bar mb-3">
<div className="row g-2 align-items-end">
<div className="col-12 col-md-3 report-filter-field" data-filter="grupo">
<label className="form-label">Grupo</label>
<select id="report-filtro-grupo" className="form-select form-select-sm">
<option value="">Todos los grupos</option>
</select>
</div>
<div className="col-12 col-md-3 report-filter-field" data-filter="busqueda">
<label className="form-label">Estudiante / Cédula</label>
<input id="report-filtro-busqueda" type="text" className="form-control form-control-sm" placeholder="Nombre, apellido o cédula" />
</div>
<div className="col-12 col-md-2 report-filter-field" data-filter="tipo">
<label className="form-label">Tipo de reporte</label>
<select id="report-filtro-tipo" className="form-select form-select-sm">
<option value="resumen">Resumen</option>
<option value="detalle">Detalle</option>
<option value="individual">Individual</option>
<option value="grupo">Grupo</option>
</select>
</div>
<div className="col-12 col-md-2 report-filter-field" data-filter="estado">
<label className="form-label">Estado</label>
<select id="report-filtro-estado" className="form-select form-select-sm">
<option value="">Todos los estados</option>
<option value="presente">Presente</option>
<option value="ausente">Ausente</option>
<option value="tardia">Tardía</option>
<option value="justificada">Justificada</option>
</select>
</div>
<div className="col-6 col-md-1 report-filter-field" data-filter="fecha-desde">
<label className="form-label">Desde</label>
<input id="report-filtro-fecha-desde" type="date" className="form-control form-control-sm" />
</div>
<div className="col-6 col-md-1 report-filter-field" data-filter="fecha-hasta">
<label className="form-label">Hasta</label>
<input id="report-filtro-fecha-hasta" type="date" className="form-control form-control-sm" />
</div>
</div>
</div>
<div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
<h3 className="card-title-serif h5 mb-0"><i className="bi bi-bar-chart"></i> Resumen académico</h3>
<div className="d-flex gap-2 flex-wrap">
<button type="button" id="report-aplicar" className="btn btn-primary btn-sm"><i className="bi bi-funnel"></i> Aplicar filtros</button>
<button type="button" id="report-limpiar" className="btn btn-outline-secondary btn-sm"><i className="bi bi-arrow-counterclockclockwise"></i> Limpiar</button>
<button type="button" id="report-vista-previa" className="btn btn-outline-info btn-sm"><i className="bi bi-eye"></i> Vista previa</button>
<button type="button" id="report-imprimir-pdf" className="btn btn-success btn-sm"><i className="bi bi-printer"></i> Imprimir PDF</button>
</div>
</div>
<div className="row g-3 mb-3">
  <div className="col-6 col-lg-3"><div className="stat-card report-stat-card h-100"><span className="stat-label">Estudiantes</span><div id="report-total-estudiantes" className="stat-value">0</div></div></div>
  <div className="col-6 col-lg-3"><div className="stat-card report-stat-card h-100"><span className="stat-label">Profesores</span><div id="report-total-profesores" className="stat-value">0</div></div></div>
  <div className="col-6 col-lg-3"><div className="stat-card report-stat-card h-100"><span className="stat-label">Grupos</span><div id="report-total-grupos" className="stat-value">0</div></div></div>
  <div className="col-6 col-lg-3"><div className="stat-card report-stat-card h-100"><span className="stat-label">Presentismo</span><div id="report-tasa-presentismo" className="stat-value">0%</div></div></div>
</div>
<div className="row g-2 mb-4 small">
  <div className="col-6 col-md-3"><span>Presentes: </span><strong id="report-presentes">0</strong></div>
  <div className="col-6 col-md-3"><span>Ausentes: </span><strong id="report-ausentes">0</strong></div>
  <div className="col-6 col-md-3"><span>Tardías: </span><strong id="report-tardias">0</strong></div>
  <div className="col-6 col-md-3"><span>Justificadas: </span><strong id="report-justificadas">0</strong></div>
</div>
<div className="table-responsive">
<table className="table table-hover align-middle mb-0">
<thead>
<tr>
<th>Grupo</th>
<th>Sección</th>
<th>Ocupados</th>
<th>Capacidad</th>
<th>Asistencias</th>
<th>Presentes</th>
<th>Ausentes</th>
</tr>
</thead>
<tbody id="report-grupos-body">
<tr><td colSpan="7" className="text-center py-4 text-muted">Cargando resumen...</td></tr>
</tbody>
</table>
</div>
<div className="mt-4">
  <h4 className="h6">Detalle de asistencia</h4>
  <div className="table-responsive"><table id="report-detalle-tabla" className="table table-sm table-hover"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody id="report-detalle-body"></tbody></table></div>
</div>
</div>
</div>
</div>

<div className="modal fade" id="modalPreviewReporte" tabIndex="-1" aria-hidden="true">
  <div className="modal-dialog modal-dialog-centered modal-xl"><div className="modal-content border-0 shadow-lg">
    <div className="modal-header bg-navy text-white"><h5 className="modal-title font-serif" id="preview-reporte-titulo">Vista previa del reporte</h5><button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
    <div className="modal-body p-4">
      <div id="preview-reporte-filtros" className="small text-muted mb-3"></div>
      <div id="preview-reporte-metricas" className="row g-3 mb-4"></div>
      <div className="table-responsive"><table id="preview-reporte-tabla" className="table table-sm table-bordered"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody id="preview-reporte-detalle-body"></tbody></table></div>
    </div>
    <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button><button type="button" id="preview-generar-pdf" className="btn btn-success"><i className="bi bi-file-earmark-pdf"></i> Generar PDF</button></div>
  </div></div>
</div>
</section></>
  );
}
