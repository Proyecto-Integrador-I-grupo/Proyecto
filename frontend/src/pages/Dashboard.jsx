import React from 'react';

export default function Dashboard() {
  return (
    <><section id="dashboard-view" className="view">
<div className="row g-3">
<div className="col-md-4">
<div className="card stat-card shadow-sm h-100">
<div className="card-body">
<span className="stat-label">Estudiantes Activos</span>
<div id="cnt-personas" className="stat-value">–</div>
</div>
</div>
</div>
<div className="col-md-4">
<div className="card stat-card shadow-sm h-100">
<div className="card-body">
<span className="stat-label">Profesores Registrados</span>
<div id="cnt-profesores" className="stat-value">--</div>
</div>
</div>
</div>
<div className="col-md-4">
<div className="card stat-card shadow-sm h-100">
<div className="card-body">
<span className="stat-label">Estado de Plataforma</span>
<div className="stat-value text-success fs-4 mt-2"><i className="bi bi-shield-check"></i> Activo</div>
</div>
</div>
</div>
</div>
</section></>
  );
}
