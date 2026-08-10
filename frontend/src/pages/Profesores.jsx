import React from 'react';

export default function Profesores() {
  return (
    <><section id="profesores-view" className="view hidden">
<div className="d-flex justify-content-between align-items-start gap-3 mb-4 flex-wrap">
<div>
<h2 className="card-title-serif h4 mb-1"><i className="bi bi-person-badge"></i> Cuerpo Docente</h2>
<p className="text-muted small mb-0">Gestiona el registro, la disponibilidad y la asignación de grupos del personal docente.</p>
</div>
<button type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalProfesor">
<i className="bi bi-plus-lg"></i> Agregar Profesor
    </button>
</div>
<div className="row g-3 mb-4">
<div className="col-6 col-lg-3">
<div className="card stat-card stat-card-sm stat-card-primary shadow-sm h-100">
<div className="card-body py-3">
<span className="stat-label">Total Registrados</span>
<div id="prof-cnt-total" className="stat-value stat-value-sm">–</div>
</div>
</div>
</div>
<div className="col-6 col-lg-3">
<div className="card stat-card stat-card-sm stat-card-success shadow-sm h-100">
<div className="card-body py-3">
<span className="stat-label">Activos</span>
<div id="prof-cnt-activos" className="stat-value stat-value-sm">–</div>
</div>
</div>
</div>
<div className="col-6 col-lg-3">
<div className="card stat-card stat-card-sm stat-card-danger shadow-sm h-100">
<div className="card-body py-3">
<span className="stat-label">Inactivos / Destituidos</span>
<div id="prof-cnt-inactivos" className="stat-value stat-value-sm">–</div>
</div>
</div>
</div>
<div className="col-6 col-lg-3">
<div className="card stat-card stat-card-sm stat-card-gold shadow-sm h-100">
<div className="card-body py-3">
<span className="stat-label">Grupos por Restaurar</span>
<div id="prof-cnt-pendientes" className="stat-value stat-value-sm">–</div>
</div>
</div>
</div>
</div>
<div className="card border-0 shadow-sm">
<div className="card-body">
<div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
<div className="input-group input-group-sm search-box">
<span className="input-group-text"><i className="bi bi-search"></i></span>
<input id="prof-search" type="text" className="form-control" placeholder="Buscar por nombre o materia..." />
</div>
<select id="prof-filtro-estado" className="form-select form-select-sm" style={{width: "auto"}}>
<option value="todos">Todos los profesores</option>
<option value="activos">Solo activos</option>
<option value="inactivos">Solo inactivos / destituidos</option>
</select>
</div>
<div className="table-responsive">
<table id="profesores-table" className="table table-hover align-middle mb-0">
<thead>
<tr>
<th>ID</th>
<th>Nombre Completo</th>
<th>Materia</th>
<th>Ingreso</th>
<th>Grupos</th>
<th>Estado</th>
<th className="text-end">Acciones</th>
</tr>
</thead>
<tbody></tbody>
</table>
</div>
</div>
</div>
</section></>
  );
}
