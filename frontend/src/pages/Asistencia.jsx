import React from 'react';

export default function Asistencia() {
  return (
    <section id="asistencia-view" className="view hidden">
      <div className="attendance-page-header d-flex justify-content-between align-items-start gap-3 mb-4 flex-wrap">
        <div>
          <span className="eyebrow">Seguimiento mensual</span>
          <h2 className="h3 mb-1 font-serif">Bitácora de Asistencia</h2>
          <p className="text-muted mb-0 small">
            Registra la asistencia del grupo en una sola vista mensual. Los meses anteriores permanecen disponibles para consulta.
          </p>
        </div>
        <button type="button" id="asis-refrescar" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-clockwise"></i> Refrescar
        </button>
      </div>

      <div className="attendance-control-card card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="asis-bitacora-grupo">Grupo</label>
              <select id="asis-bitacora-grupo" className="form-select">
                <option value="">Seleccionar grupo</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="asis-bitacora-mes">Mes</label>
              <input id="asis-bitacora-mes" type="month" className="form-control" />
            </div>
            <div className="col-6 col-md-3" id="asis-profesor-field">
              <label className="form-label" htmlFor="asis-bitacora-profesor">Profesor</label>
              <select id="asis-bitacora-profesor" className="form-select" disabled>
                <option value="">Selecciona un grupo</option>
              </select>
            </div>
            <div className="col-12 col-md-2">
              <button type="button" id="asis-guardar-mes" className="btn btn-primary w-100" disabled>
                <i className="bi bi-cloud-check"></i> Guardar
              </button>
            </div>
          </div>

          <div className="attendance-legend mt-3" aria-label="Leyenda de estados">
            <span><b className="legend-dot presente">P</b> Presente</span>
            <span><b className="legend-dot ausente">A</b> Ausente</span>
            <span><b className="legend-dot tardia">T</b> Tardía</span>
            <span><b className="legend-dot justificada">J</b> Justificada</span>
            <span className="text-muted"><i className="bi bi-info-circle"></i> Pulsa una celda para cambiar el estado.</span>
          </div>
          <div id="asis-bitacora-hint" className="form-text mt-2">
            Selecciona un grupo para cargar sus estudiantes.
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-0">
          <div className="attendance-matrix-head px-3 px-md-4 py-3 border-bottom d-flex justify-content-between align-items-center gap-3 flex-wrap">
            <div>
              <h3 className="h5 mb-1 card-title-serif"><i className="bi bi-calendar3"></i> Registro del mes</h3>
              <p id="asis-matrix-summary" className="text-muted small mb-0">Sin grupo seleccionado.</p>
            </div>
            <span id="asis-cambios-pendientes" className="badge rounded-pill text-bg-light border">Sin cambios</span>
          </div>
          <div className="attendance-matrix-wrap">
            <table id="asis-matrix-table" className="table table-bordered align-middle mb-0 attendance-matrix">
              <thead id="asis-matrix-head">
                <tr><th className="student-sticky">Estudiante</th></tr>
              </thead>
              <tbody id="asis-matrix-body">
                <tr><td className="text-center py-5 text-muted">Selecciona un grupo y un mes.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 pt-3 px-3 px-md-4">
          <button
            className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-2"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#asis-historial-detallado"
            aria-expanded="false"
          >
            <i className="bi bi-clock-history"></i>
            Ver historial detallado
            <i className="bi bi-chevron-down small"></i>
          </button>
        </div>
        <div id="asis-historial-detallado" className="collapse">
          <div className="card-body px-3 px-md-4">
            <div className="row g-2 mb-3">
              <div className="col-12 col-md-4">
                <input id="asis-historial-busqueda" className="form-control form-control-sm" placeholder="Buscar estudiante, profesor o grupo..." />
              </div>
              <div className="col-6 col-md-2">
                <select id="asis-historial-estado" className="form-select form-select-sm">
                  <option value="">Todos los estados</option>
                  <option value="presente">Presente</option>
                  <option value="ausente">Ausente</option>
                  <option value="tardia">Tardía</option>
                  <option value="justificada">Justificada</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <button type="button" id="asis-historial-refrescar" className="btn btn-outline-secondary btn-sm w-100">
                  <i className="bi bi-arrow-clockwise"></i> Actualizar
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estudiante</th>
                    <th>Grupo / Sección</th>
                    <th>Profesor</th>
                    <th>Materia</th>
                    <th>Estado</th>
                    <th>Observaciones</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody id="asis-historial-body">
                  <tr><td colSpan="8" className="text-center py-4 text-muted">Abre el historial para consultar registros anteriores.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="modalEditarAsistencia" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-navy text-white">
              <h5 className="modal-title font-serif"><i className="bi bi-pencil-square"></i> Editar asistencia</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <form id="asis-editar-form">
              <div className="modal-body p-4">
                <input type="hidden" id="asis-editar-id" />
                <div className="mb-3">
                  <label className="form-label">Estudiante</label>
                  <input id="asis-editar-estudiante" className="form-control bg-light" disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">Estado</label>
                  <select id="asis-editar-estado" className="form-select">
                    <option value="presente">Presente</option>
                    <option value="ausente">Ausente</option>
                    <option value="tardia">Tardía</option>
                    <option value="justificada">Justificada</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Observaciones</label>
                  <textarea id="asis-editar-observaciones" className="form-control" rows="3" maxLength="250"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
