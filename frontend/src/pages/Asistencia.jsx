import React from 'react';

export default function Asistencia() {
  return (
    <><section id="asistencia-view" className="view hidden">

<div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
<div>
<h2 className="h3 mb-0 font-serif">Control y Registro de Asistencia</h2>
</div>
<div className="d-flex align-items-center gap-2">
<button type="button" id="hist-refrescar" className="btn btn-outline-secondary btn-sm">
<i className="bi bi-arrow-clockwise"></i> Refrescar
      </button>
<button type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalRegistrarAsistencia">
<i className="bi bi-plus-lg"></i> Registrar Asistencia
      </button>
</div>
</div>

<div className="card border-0 shadow-sm">
<div className="card-body">
<div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
<h3 className="card-title-serif h5 mb-0"><i className="bi bi-clock-history"></i> Historial de Asistencia</h3>
<button className="btn btn-outline-primary btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#collapseGraficosAsistencia" aria-expanded="false" aria-controls="collapseGraficosAsistencia">
<i className="bi bi-bar-chart-fill"></i> Ver Gráficos Estadísticos
        </button>
</div>

<div className="collapse mb-4" id="collapseGraficosAsistencia">
<div className="card card-body bg-light border-0">
<div className="row align-items-center">
<div className="col-12 col-md-6 mb-3 mb-md-0 text-center">
<h6 className="text-muted mb-3 font-serif">Distribución de Estados</h6>
<div style={{maxHeight: "220px",position: "relative"}}>
<canvas id="chartAsistenciaEstados"></canvas>
</div>
</div>
<div className="col-12 col-md-6 text-center">
<h6 className="text-muted mb-3 font-serif">Resumen Rápido</h6>
<div className="p-3 bg-white rounded shadow-sm text-start">
<p className="mb-2 text-muted small">Visualiza de forma interactiva el comportamiento de la asistencia filtrada actual.</p>
<div className="d-flex justify-content-between border-bottom py-1"><span>Total filtrado:</span> <strong id="graf-total">0</strong></div>
<div className="d-flex justify-content-between border-bottom py-1 text-success"><span>Asistencia efectiva:</span> <strong id="graf-efectiva">0%</strong></div>
<div className="d-flex justify-content-between py-1 text-danger"><span>Ausentismo:</span> <strong id="graf-ausentismo">0%</strong></div>
</div>
</div>
</div>
</div>
</div>

<div className="filter-bar mb-4">
<div className="row g-2">
<div className="col-12 col-md-3">
<label className="form-label">Grupo</label>
<select id="hist-filtro-grupo" className="form-select form-select-sm">
<option value="">Todos los grupos</option>
</select>
</div>
<div className="col-12 col-md-3">
<label className="form-label">Estudiante Específico</label>
<select id="hist-filtro-estudiante" className="form-select form-select-sm">
<option value="">Todos los estudiantes</option>
</select>
</div>
<div className="col-6 col-md-2">
<label className="form-label">Materia/Curso</label>
<select id="hist-filtro-materia" className="form-select form-select-sm">
<option value="">Todas las materias</option>
</select>
</div>
<div className="col-6 col-md-2">
<label className="form-label">Estado</label>
<select id="hist-filtro-estado" className="form-select form-select-sm">
<option value="">Todos</option>
<option value="presente">Presente</option>
<option value="ausente">Ausente</option>
<option value="tardia">Tardía</option>
<option value="justificada">Justificada</option>
</select>
</div>
<div className="col-6 col-md-2">
<label className="form-label">Desde</label>
<input id="hist-filtro-fecha-desde" type="date" className="form-control form-control-sm" />
</div>
<div className="col-6 col-md-2">
<label className="form-label">Hasta</label>
<input id="hist-filtro-fecha-hasta" type="date" className="form-control form-control-sm" />
</div>
<div className="col-12 col-md-8">
<div className="input-group input-group-sm mt-1">
<span className="input-group-text"><i className="bi bi-search"></i></span>
<input id="hist-filtro-busqueda" type="text" className="form-control" placeholder="Buscar por nombre, apellido u observaciones..." />
</div>
</div>
<div className="col-12 col-md-4 d-flex align-items-end mt-1">
<button type="button" id="hist-limpiar-filtros" className="btn btn-outline-secondary btn-sm w-100">
<i className="bi bi-x-circle"></i> Limpiar filtros
            </button>
</div>
</div>
</div>

<div className="table-responsive">
<table id="asistencia-historial-table" className="table table-hover align-middle mb-0">
<thead>
<tr>
<th>Fecha</th>
<th>Estudiante</th>
<th>Grupo</th>
<th>Profesor</th>
<th>Materia/Curso</th>
<th>Estado</th>
<th>Observaciones</th>
<th className="text-end">Acciones</th>
</tr>
</thead>
<tbody id="asistencia-historial-body">
<tr><td colSpan="8" className="text-center py-4 text-muted">Cargando historial...</td></tr>
</tbody>
</table>
</div>
</div>
</div>

<div className="modal fade" id="modalRegistrarAsistencia" tabIndex="-1" aria-hidden="true">
<div className="modal-dialog modal-dialog-centered">
<div className="modal-content border-0 shadow-lg">
<div className="modal-header bg-navy text-white">
<h5 className="modal-title font-serif"><i className="bi bi-calendar2-check"></i> Registrar Asistencia</h5>
<button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
</div>
<div className="modal-body p-4">
<form id="asistencia-form">
<div className="row g-3">
<div className="col-12">
<label className="form-label">Grupo Destino</label>
<select id="asis-id-grupo" className="form-select" required=""></select>
<div className="form-text" id="asis-grupo-hint">Selecciona el grupo para filtrar automáticamente el roster.</div>
</div>
<div className="col-12">
<label className="form-label">Estudiante</label>
<select id="asis-persona" className="form-select" required="" disabled="">
<option value="" disabled="" selected="">Primero selecciona un grupo</option>
</select>
</div>
<div className="col-12">
<label className="form-label">Profesor Asignado</label>
<select id="asis-id-profesor" className="form-select" required="" disabled="">
<option value="" disabled="" selected="">Primero selecciona un grupo</option>
</select>
</div>
<div className="col-6">
<label className="form-label">Estado</label>
<select id="asis-estado" className="form-select">
<option value="presente" selected="">Presente</option>
<option value="ausente">Ausente</option>
<option value="tardia">Tardía</option>
<option value="justificada">Justificada</option>
</select>
</div>
<div className="col-6">
<label className="form-label">Fecha</label>
<input id="asis-fecha" type="date" className="form-control" required="" />
</div>
<div className="col-12">
<label className="form-label">Observaciones (opcional)</label>
<input id="asis-observaciones" type="text" className="form-control" maxLength="250" placeholder="Ej. Retraso por transporte público" />
</div>
<div className="col-12 pt-3">
<button type="submit" id="asis-submit" className="btn btn-primary w-100 py-2">
<i className="bi bi-check2-circle"></i> Guardar Registro de Asistencia
                </button>
</div>
</div>
</form>
</div>
</div>
</div>
</div>

<div className="modal fade" id="modalModificarAsistencia" tabIndex="-1" aria-hidden="true">
<div className="modal-dialog modal-dialog-centered">
<div className="modal-content border-0 shadow-lg">
<div className="modal-header bg-navy text-white">
<h5 className="modal-title font-serif"><i className="bi bi-pencil-square"></i> Modificar Estado de Asistencia</h5>
<button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
</div>
<div className="modal-body p-4">
<form id="modificar-asistencia-form">
<input type="hidden" id="mod-id-asistencia" />
<div className="row g-3">
<div className="col-12">
<label className="form-label text-muted">Estudiante</label>
<input type="text" id="mod-estudiante-nombre" className="form-control bg-light" disabled="" />
</div>
<div className="col-12">
<label className="form-label">Nuevo Estado</label>
<select id="mod-estado" className="form-select" required="">
<option value="presente">Presente</option>
<option value="ausente">Ausente</option>
<option value="tardia">Tardía</option>
<option value="justificada">Justificada</option>
</select>
</div>
<div className="col-12">
<label className="form-label">Observaciones / Motivo de Corrección</label>
<textarea id="mod-observaciones" className="form-control" rows="3" maxLength="250" placeholder="Motivo del cambio de estado..."></textarea>
</div>
<div className="col-12 pt-3">
<button type="submit" id="mod-submit" className="btn btn-primary w-100 py-2">
<i className="bi bi-save"></i> Actualizar Registro
                </button>
</div>
</div>
</form>
</div>
</div>
</div>
</div>
</section></>
  );
}
