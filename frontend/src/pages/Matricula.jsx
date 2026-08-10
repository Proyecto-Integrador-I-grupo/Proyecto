import React from 'react';

export default function Matricula() {
  return (
    <><section id="matricula-view" className="view hidden">
<div className="row g-4">
<div className="col-6 col-md-3">
<div className="card border-0 shadow-sm text-center p-3 h-100">
<div className="card-body d-flex flex-column align-items-center justify-content-center">
<i className="bi bi-journal-plus text-primary fs-1 mb-2"></i>
<h3 className="h5">Nueva Matrícula</h3>
<p className="text-muted small mb-3">Asigna un estudiante a un grupo de clase.</p>
<button type="button" className="btn btn-primary w-100" data-bs-toggle="modal" data-bs-target="#modalMatricula">Procesar Matrícula</button>
</div>
</div>
</div>
<div className="col-6 col-md-3">
<div className="card border-0 shadow-sm text-center p-3 h-100">
<div className="card-body d-flex flex-column align-items-center justify-content-center">
<i className="bi bi-people text-primary fs-1 mb-2"></i>
<h3 className="h5">Grupos</h3>
<p className="text-muted small mb-3">Configura las aulas, capacidades y docentes.</p>
<div className="d-grid gap-2 w-100">
<button type="button" className="btn btn-outline-primary w-100" data-bs-toggle="modal" data-bs-target="#modalGrupo">Crear Grupo</button>
<button type="button" className="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#modalGestionGrupo">Gestionar Grupo</button>
</div>
</div>
</div>
</div>
<div className="col-6 col-md-3">
<div className="card border-0 shadow-sm text-center p-3 h-100">
<div className="card-body d-flex flex-column align-items-center justify-content-center">
<i className="bi bi-person-gear text-primary fs-1 mb-2"></i>
<h3 className="h5">Gestionar Matrícula</h3>
<p className="text-muted small mb-3">Transfiere o retira estudiantes de un grupo.</p>
<button type="button" className="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#modalGestionMatricula">Gestionar Matrícula</button>
</div>
</div>
</div>
<div className="col-6 col-md-3">
<div className="card border-0 shadow-sm text-center p-3 h-100">
<div className="card-body d-flex flex-column align-items-center justify-content-center">
<i className="bi bi-diagram-3 text-primary fs-1 mb-2"></i>
<h3 className="h5">Secciones</h3>
<p className="text-muted small mb-3">Administra el catálogo académico y sus secciones.</p>
<button type="button" className="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#modalSeccion">Nueva Sección</button>
</div>
</div>
</div>
</div>
</section></>
  );
}
