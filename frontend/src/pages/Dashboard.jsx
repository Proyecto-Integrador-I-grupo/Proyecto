import React from 'react';

export default function Dashboard() {
  return (
    <section id="dashboard-view" className="view dashboard-shell">
      <div className="dashboard-page-header d-flex justify-content-between align-items-center gap-3 mb-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Resumen ejecutivo</p>
          <h2 className="card-title-serif h5 mb-1">
            <i className="bi bi-speedometer2 me-2"></i>Indicadores generales
          </h2>
          <p className="text-muted small mb-0">
            Estado actual de la institución y operación del sistema.
          </p>
        </div>
        <button
          type="button"
          id="dashboard-refrescar"
          className="btn btn-outline-primary btn-sm dashboard-refresh"
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

      <div className="row g-3 dashboard-kpis">
        <div className="col-12 col-lg-4">
          <div className="card stat-card dashboard-kpi-card h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <span className="dashboard-icon dashboard-icon-primary">
                  <i className="bi bi-people-fill"></i>
                </span>
                <span className="dashboard-pill dashboard-pill-primary">Activos</span>
              </div>
              <div>
                <span className="stat-label">Estudiantes activos</span>
                <div id="cnt-personas" className="stat-value">–</div>
              </div>
              <small className="dashboard-meta">Registros disponibles en el sistema</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card stat-card dashboard-kpi-card h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <span className="dashboard-icon dashboard-icon-secondary">
                  <i className="bi bi-mortarboard-fill"></i>
                </span>
                <span className="dashboard-pill dashboard-pill-secondary">Docentes</span>
              </div>
              <div>
                <span className="stat-label">Profesores registrados</span>
                <div id="cnt-profesores" className="stat-value">–</div>
              </div>
              <small className="dashboard-meta">Personal docente con acceso habilitado</small>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card stat-card dashboard-kpi-card dashboard-kpi-card-success h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <span className="dashboard-icon dashboard-icon-success">
                  <i className="bi bi-shield-check"></i>
                </span>
                <span className="dashboard-status-indicator">
                  <span className="status-dot"></span> Operativo
                </span>
              </div>
              <div>
                <span className="stat-label">Estado de plataforma</span>
                <div className="stat-value stat-value-status">Activo</div>
              </div>
              <small className="dashboard-meta">Sistema disponible y sincronizado</small>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-insight-bar row g-3 mt-3">
        <div className="col-12 col-md-4">
          <div className="dashboard-mini-panel dashboard-mini-panel-blue">
            <span className="mini-label">Tasa de actividad</span>
            <strong>94.8%</strong>
            <small>+4.2% vs. mes anterior</small>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="dashboard-mini-panel dashboard-mini-panel-violet">
            <span className="mini-label">Cobertura docente</span>
            <strong>86.5%</strong>
            <small>Capacidad estable en horario regular</small>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="dashboard-mini-panel dashboard-mini-panel-green">
            <span className="mini-label">Operación</span>
            <strong>24/7</strong>
            <small>Monitoreo activo del sistema</small>
          </div>
        </div>
      </div>
    </section>
  );
}
