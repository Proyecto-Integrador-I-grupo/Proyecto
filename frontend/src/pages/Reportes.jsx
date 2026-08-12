import React from 'react';

const modos = [
  { id: 'matricula', icon: 'journal-check', label: 'Matrícula' },
  { id: 'estudiantes', icon: 'people-fill', label: 'Estudiantes' },
  { id: 'grupos', icon: 'diagram-3', label: 'Grupos' },
  { id: 'profesores', icon: 'person-badge', label: 'Profesores' },
  { id: 'pre_matricula', icon: 'person-plus-fill', label: 'Pre-matrículas' },
  { id: 'auditoria', icon: 'shield-check', label: 'Auditoría' }
];

export default function Reportes() {
  return (
    <section id="reportes-view" className="view hidden admin-only">
      <div className="report-shell">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="report-menu-top mb-3">
              <div className="btn-group report-mode-switcher w-100" role="group" aria-label="Tipo de reporte">
                {modos.map((modo) => (
                  <button
                    key={modo.id}
                    type="button"
                    className={`btn btn-sm ${modo.id === 'matricula' ? 'active' : ''}`}
                    data-report-mode={modo.id}
                  >
                    <i className={`bi bi-${modo.icon}`}></i> {modo.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-bar mb-3">
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-2 report-filter-field" data-filter="grupo">
                  <label className="form-label">Grupo</label>
                  <select id="report-filtro-grupo" className="form-select form-select-sm">
                    <option value="">Todos los grupos</option>
                  </select>
                </div>

                <div className="col-12 col-md-2 report-filter-field" data-filter="busqueda">
                  <label id="report-busqueda-label" className="form-label">Estudiante / Cédula</label>
                  <input
                    id="report-filtro-busqueda"
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Nombre, apellido o cédula"
                    maxLength="120"
                  />
                </div>

                <div className="col-12 col-md-2 report-filter-field" data-filter="tipo">
                  <label className="form-label">Tipo de reporte</label>
                  <select id="report-filtro-tipo" className="form-select form-select-sm">
                    <option value="resumen">Resumen</option>
                    <option value="detalle">Detalle</option>
                    <option value="individual">Individual</option>
                    <option value="grupo">Grupo</option>
                  </select>
                </div>

                <div className="col-12 col-md-2 report-filter-field" data-filter="estado">
                  <label className="form-label">Estado</label>
                  <select id="report-filtro-estado" className="form-select form-select-sm">
                    <option value="">Todos los estados</option>
                    <option value="presente">Presente</option>
                    <option value="ausente">Ausente</option>
                    <option value="tardia">Tardía</option>
                    <option value="justificada">Justificada</option>
                  </select>
                </div>

                <div className="col-6 col-md-2 report-filter-field" data-filter="fecha-desde">
                  <label className="form-label">Desde</label>
                  <input id="report-filtro-fecha-desde" type="date" className="form-control form-control-sm" />
                </div>

                <div className="col-6 col-md-2 report-filter-field" data-filter="fecha-hasta">
                  <label className="form-label">Hasta</label>
                  <input id="report-filtro-fecha-hasta" type="date" className="form-control form-control-sm" />
                </div>
              </div>

              <div id="report-filtro-error" className="invalid-feedback d-block mt-2" hidden></div>
            </div>

            <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
              <h3 className="card-title-serif h5 mb-0">
                <i className="bi bi-bar-chart"></i> Reporte de matrícula
              </h3>
              <div className="d-flex gap-2 flex-wrap report-actions">
                <button type="button" id="report-aplicar" className="btn btn-primary btn-sm">
                  <i className="bi bi-funnel"></i> Aplicar filtros
                </button>
                <button type="button" id="report-limpiar" className="btn btn-outline-secondary btn-sm">
                  <i className="bi bi-arrow-counterclockwise"></i> Limpiar
                </button>
                <button type="button" id="report-vista-previa" className="btn btn-outline-info btn-sm">
                  <i className="bi bi-eye"></i> Vista previa
                </button>
                <button type="button" id="report-imprimir-pdf" className="btn btn-success btn-sm">
                  <i className="bi bi-printer"></i> Imprimir PDF
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr id="report-tabla-head">
                    <th>Grupo</th>
                    <th>Sección</th>
                    <th>Ocupados</th>
                    <th>Capacidad</th>
                    <th>Asistencias</th>
                    <th>Presentes</th>
                    <th>Ausentes</th>
                  </tr>
                </thead>
                <tbody id="report-grupos-body">
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      Aún no hay consulta. Presiona Aplicar filtros.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div id="report-empty-state" className="report-empty-state" hidden>
              <i className="bi bi-bar-chart-line"></i>
              <strong>No hay resultados</strong>
              <span id="report-empty-message">No hay registros con los filtros aplicados.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="modalPreviewReporte" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-scrollable modal-xl">
          <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div className="modal-header bg-navy text-white px-4 py-3">
              <div className="d-flex align-items-center gap-3">
                <img
                  id="preview-reporte-logo"
                  src="/logo.jpg"
                  alt="Logo EduControl"
                  className="preview-reporte-logo"
                />
                <div>
                  <span className="small text-white-50 d-block mb-1">Vista previa del reporte</span>
                  <h5 id="preview-reporte-titulo" className="modal-title h6 text-white mb-0">Reporte de matrícula</h5>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>

            <div className="modal-body preview-reporte-body p-3 p-md-4">
              <div className="preview-reporte-chip-area mb-3" id="preview-reporte-filtros"></div>
              <div className="row g-3 mb-3" id="preview-reporte-metricas"></div>

              <div className="table-responsive">
                <table id="preview-reporte-tabla" className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Estudiante</th>
                      <th>Grupo</th>
                      <th>Profesor</th>
                      <th>Estado</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody id="preview-reporte-detalle-body">
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted">
                        No hay registros para previsualizar.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" id="preview-generar-pdf" className="btn btn-success">
                <i className="bi bi-file-earmark-pdf"></i> Generar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
