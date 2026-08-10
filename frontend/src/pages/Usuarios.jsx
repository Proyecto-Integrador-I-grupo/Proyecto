import React from 'react';

export default function Usuarios() {
  return (
    <><section id="usuarios-view" className="view hidden">
<div className="container-fluid py-3">
<div className="row g-3">

<div className="col-12 col-lg-4">
<div className="card shadow-sm border-0">
<div className="card-header bg-white py-3">
<h5 className="card-title mb-0">
<i className="bi bi-person-plus-fill text-primary me-2"></i>Registrar Usuario
            </h5>
</div>
<div className="card-body">
<form id="usuario-form">
<div className="mb-3">
<label className="form-label" htmlFor="usuario-nombre">Nombre</label>
<input type="text" id="usuario-nombre" className="form-control" required="" />
</div>
<div className="mb-3">
<label className="form-label" htmlFor="usuario-apellido1">Primer Apellido</label>
<input type="text" id="usuario-apellido1" className="form-control" required="" />
</div>
<div className="mb-3">
<label className="form-label" htmlFor="usuario-correo">Correo Electrónico</label>
<input type="email" id="usuario-correo" className="form-control" placeholder="usuario@educontrol.com" autoComplete="off" required="" />
</div>
<div className="mb-3">
<label className="form-label" htmlFor="usuario-rol">Rol / Permisos</label>
<select id="usuario-rol" className="form-select" required="">
<option value="Administrador">Administrador</option>
<option value="Asistente">Asistente</option>
</select>
</div>
<div className="mb-3">
<label className="form-label" htmlFor="usuario-clave">Contraseña Temporal</label>
<input type="password" id="usuario-clave" className="form-control" minLength="8" required="" />
</div>
<button type="submit" id="btn-guardar-usuario" className="btn btn-primary w-100 py-2">
<i className="bi bi-download me-1"></i> Guardar Usuario
              </button>
</form>
</div>
</div>
</div>

<div className="col-12 col-lg-8">
<div className="card shadow-sm border-0">
<div className="card-header bg-white py-3">
<h5 className="card-title mb-0">
<i className="bi bi-shield-check text-primary me-2"></i>Gestión de Permisos y Usuarios
            </h5>
</div>
<div className="card-body p-0">
<div className="table-responsive">
<table className="table table-hover align-middle mb-0">
<thead className="table-light">
<tr>
<th>Usuario</th>
<th>Correo</th>
<th>Rol</th>
<th className="text-end">Acciones</th>
</tr>
</thead>
<tbody id="tabla-usuarios-body">

</tbody>
</table>
</div>
</div>
</div>
</div>
</div>
</div>
</section></>
  );
}
