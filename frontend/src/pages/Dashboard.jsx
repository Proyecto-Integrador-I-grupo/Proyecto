import React from 'react';

export default function Dashboard() {
  return (
    <section id="dashboard-view" className="view">
      <div className="dashboard-page-header d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="card-title-serif h5 mb-1">
            <i className="bi bi-speedometer2 me-2"></i>Resumen general
          </h2>
          <p className="text-muted small mb-0">
            Información actual de estudiantes y profesores.
          </p>
        </div>
        <button
          type="button"
          id="dashboard-refrescar"
          className="btn btn-outline-primary btn-sm"
          onClick={async (event) => {
            const btn = event.currentTarget;
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Actualizando...';
            try {
              const { refreshDashboardCounts } = await import('../logic/dashboard.js');
              await refreshDashboardCounts();
            } finally {
              btn.disabled = false;
              btn.innerHTML = original;
            }
          }}
        >
          <i className="bi bi-arrow-clockwise"></i> Refrescar
        </button>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-4">
          <div className="card stat-card shadow-sm h-100">
            <div className="card-body">
              <span className="stat-label">Estudiantes Activos</span>
              <div id="cnt-personas" className="stat-value">–</div>
              <small className="text-muted">Registros disponibles</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card stat-card shadow-sm h-100">
            <div className="card-body">
              <span className="stat-label">Profesores Registrados</span>
              <div id="cnt-profesores" className="stat-value">–</div>
              <small className="text-muted">Personal docente registrado</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card stat-card shadow-sm h-100">
            <div className="card-body">
              <span className="stat-label">Estado de Plataforma</span>
              <div className="stat-value text-success fs-4 mt-2">
                <i className="bi bi-shield-check"></i> Activo
              </div>
              <small className="text-muted">Sistema disponible</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
