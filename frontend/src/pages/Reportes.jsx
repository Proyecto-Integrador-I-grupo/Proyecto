import React from 'react';

export default function Reportes() {
  return (
    <section id="reportes-view" className="view hidden">
      <div className="report-shell">
        <div className="card border-0 shadow-sm report-main-card">
          <div className="card-body p-3 p-lg-4">
            <div className="report-menu-top mb-3">
              <div className="report-mode-switcher" role="group" aria-label="Casos de reporte">
                <button type="button" className="btn btn-sm active" data-report-mode="matricula"><i className="bi bi-journal-check" /> Matrículas</button>
                <button type="button" className="btn btn-sm" data-report-mode="estudiantes"><i className="bi bi-people-fill" /> Estudiantes</button>
                <button type="button" className="btn btn-sm" data-report-mode="grupos"><i className="bi bi-diagram-3" /> Grupos</button>
                <button type="button" className="btn btn-sm" data-report-mode="profesores"><i className="bi bi-person-badge" /> Profesores</button>
                <button type="button" className="btn btn-sm" data-report-mode="pre_matricula"><i className="bi bi-person-plus-fill" /> Pre-matrículas</button>
                <button type="button" className="btn btn-sm" data-report-mode="pagos"><i className="bi bi-cash-stack" /> Pagos</button>
                <button type="button" className="btn btn-sm" data-report-mode="auditoria"><i className="bi bi-shield-check" /> Auditoría</button>
              </div>
            </div>

            <div className="filter-bar report-filter-panel mb-3">
              <div className="row g-2 align-items-end report-filter-grid">
                <div className="report-filter-field" data-filter="grupo">
                  <label className="form-label" htmlFor="report-filtro-grupo">Grupo</label>
                  <select id="report-filtro-grupo" className="form-select form-select-sm">
                    <option value="">Todos los grupos</option>
                  </select>
                </div>

                <div className="report-filter-field" data-filter="estado">
                  <label id="report-estado-label" className="form-label" htmlFor="report-filtro-estado">Estado del estudiante</label>
                  <select id="report-filtro-estado" className="form-select form-select-sm">
                    <option value="">--Seleccionar--</option>
                  </select>
                </div>

                <div className="report-filter-field" data-filter="busqueda">
                  <label id="report-busqueda-label" className="form-label" htmlFor="report-filtro-busqueda">Estudiante / ID</label>
                  <input id="report-filtro-busqueda" type="text" maxLength="120" className="form-control form-control-sm" placeholder="Nombre, apellido o ID" autoComplete="off" />
                </div>

                <div className="report-filter-field" data-filter="tipo">
                  <label className="form-label" htmlFor="report-filtro-tipo">Tipo de reporte</label>
                  <select id="report-filtro-tipo" className="form-select form-select-sm">
                    <option value="">Todos los tipos</option>
                    <option value="resumen">Resumen</option>
                    <option value="detalle">Detalle</option>
                    <option value="individual">Individual</option>
                    <option value="grupo">Grupo</option>
                  </select>
                </div>

                <div className="report-filter-field" data-filter="fecha-desde">
                  <label className="form-label" htmlFor="report-filtro-fecha-desde">Desde</label>
                  <input id="report-filtro-fecha-desde" type="date" className="form-control form-control-sm" />
                </div>

                <div className="report-filter-field" data-filter="fecha-hasta">
                  <label className="form-label" htmlFor="report-filtro-fecha-hasta">Hasta</label>
                  <input id="report-filtro-fecha-hasta" type="date" className="form-control form-control-sm" />
                </div>
              </div>
              <div id="report-filtro-error" className="report-filter-error mt-2" role="alert" hidden />
            </div>

            <div className="report-toolbar d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
              <div>
                <h3 className="card-title-serif h5 mb-1"><i className="bi bi-bar-chart" /> Reporte de matrícula</h3>
                <p id="report-result-summary" className="text-muted small mb-0">Selecciona los filtros para una búsqueda más precisa.</p>
              </div>
              <div className="report-actions d-flex gap-2 flex-wrap">
                <button type="button" id="report-limpiar" className="btn btn-outline-secondary btn-sm"><i className="bi bi-arrow-counterclockwise" /> Limpiar</button>
                <button type="button" id="report-vista-previa" className="btn btn-outline-info btn-sm"><i className="bi bi-eye" /> Vista previa</button>
                <button type="button" id="report-imprimir-pdf" className="btn btn-success btn-sm"><i className="bi bi-file-earmark-pdf" /> Generar PDF</button>
              </div>
            </div>

            <div className="table-responsive report-table-wrap">
              <table className="table table-hover align-middle mb-0 report-table">
                <thead><tr id="report-tabla-head"><th>Grupo</th><th>Sección</th><th>Ocupados</th><th>Capacidad</th><th>Asistencias</th><th>Presentes</th><th>Ausentes</th></tr></thead>
                <tbody id="report-grupos-body"><tr><td colSpan="7" className="text-center py-5 text-muted">Selecciona los filtros para generar un reporte.</td></tr></tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      <div className="modal fade" id="modalPreviewReporte" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable modal-xl">
          <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div className="modal-header bg-navy text-white px-3 px-md-4 py-3">
              <div className="d-flex align-items-center gap-3">
                <img id="preview-reporte-logo" src="/images/logo1.jpg" alt="Logo EduControl" className="preview-reporte-logo" loading="lazy" />
                <div>
                  <span className="small text-white-50 d-block mb-1">Vista previa del reporte</span>
                  <h5 id="preview-reporte-titulo" className="modal-title h6 text-white mb-0">Reporte académico</h5>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar" />
            </div>
            <div className="modal-body preview-reporte-body p-3 p-md-4">
              <div className="preview-reporte-chip-area mb-3" id="preview-reporte-filtros" />
              <div className="row g-3 mb-3" id="preview-reporte-metricas" />
              <div id="preview-auditoria-note" className="audit-preview-note mb-3" hidden>
                <i className="bi bi-info-circle" /> Los cambios de auditoría se resumen en la tabla. Puedes abrir el detalle completo desde la fila correspondiente.
              </div>
              <div className="table-responsive preview-table-wrap">
                <table id="preview-reporte-tabla" className="table table-hover align-middle mb-0">
                  <thead><tr><th>Fecha</th><th>Estudiante</th><th>Grupo</th><th>Profesor</th><th>Estado estudiante</th></tr></thead>
                  <tbody id="preview-reporte-detalle-body"><tr><td colSpan="5" className="text-center py-4 text-muted">No hay registros para previsualizar.</td></tr></tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" id="preview-generar-pdf" className="btn btn-success"><i className="bi bi-file-earmark-pdf" /> Generar PDF</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
