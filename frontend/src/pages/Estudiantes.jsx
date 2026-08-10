import React from 'react';

export default function Estudiantes() {
  return (
    <><section id="estudiantes-view" className="view hidden">
<div className="card border-0 shadow-sm">
<div className="card-body">
<div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
<h2 className="card-title-serif h5 mb-0"><i className="bi bi-people-fill"></i> Pre-registro de Estudiantes</h2>
<div className="d-flex gap-2 align-items-center flex-wrap">
<div className="input-group input-group-sm search-box">
<span className="input-group-text"><i className="bi bi-search"></i></span>
<input id="persona-search" type="text" className="form-control" placeholder="Buscar por nombre..." />
</div>
<button type="button" className="btn btn-primary btn-sm" id="btn-abrir-modal-estudiante" data-bs-toggle="modal" data-bs-target="#modalEstudiante">
<i className="bi bi-plus-lg"></i> Agregar Estudiante
          </button>
</div>
</div>
<p className="text-muted small mb-3">
<i className="bi bi-info-circle"></i>
        Este es el pre-registro del estudiante. La asignación a un grupo se hace luego desde el módulo de <strong>Matrícula</strong>.
      </p>
<div className="table-responsive">
<table id="personas-table" className="table table-hover align-middle mb-0">
<thead>
<tr>
<th>ID</th>
<th>Nombre Completo</th>
<th>Nacimiento</th>
<th>Ingreso</th>
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
