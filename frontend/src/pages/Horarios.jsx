import React from 'react';

export default function Horarios() {
  return (
    <div className="modal fade schedule-modal" id="modalHorarios" tabIndex="-1" aria-hidden="true" aria-labelledby="modalHorariosLabel">
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-navy text-white schedule-modal-header">
            <div className="min-w-0">
              <p className="schedule-modal-kicker mb-1">Agenda académica</p>
              <h5 className="modal-title" id="modalHorariosLabel">
                <i className="bi bi-calendar-week me-2"></i>Horarios docentes
              </h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" id="horarios-refrescar" className="btn btn-sm btn-outline-light schedule-refresh-btn">
                <i className="bi bi-arrow-clockwise me-1"></i> <span>Actualizar</span>
              </button>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
          </div>

          <div className="modal-body p-0 schedule-modal-body">
            <div className="schedule-page schedule-modal-workspace">
              <div className="schedule-modal-intro">
                <div>
                  <strong>Consulta de horarios</strong>
                  <span id="horarios-subtitle">Consulta profesores, cursos, grupos, aulas y horas asignadas.</span>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                  <button type="button" id="horarios-editor-toggle" className="btn btn-sm btn-outline-primary hidden">
                    <i className="bi bi-pencil-square me-1"></i> Configurar horario
                  </button>
                  <span className="schedule-modal-badge"><i className="bi bi-clock-history"></i> Vista semanal inteligente</span>
                </div>
              </div>

              <div className="schedule-filter-card schedule-filter-card-compact">
                <div className="schedule-section-head">
                  <div>
                    <h6 className="mb-1">Filtros rápidos</h6>
                    <p className="mb-0">Ajusta la consulta por profesor, grupo y período lectivo.</p>
                  </div>
                </div>
                <div className="schedule-filter-grid">
                  <div id="horarios-profesor-field" className="schedule-filter-field">
                    <label htmlFor="horarios-profesor-filter">Profesor</label>
                    <select id="horarios-profesor-filter" className="form-select">
                      <option value="">Todos los profesores</option>
                    </select>
                  </div>
                  <div className="schedule-filter-field">
                    <label htmlFor="horarios-grupo-filter">Grupo</label>
                    <select id="horarios-grupo-filter" className="form-select">
                      <option value="">Todos los grupos</option>
                    </select>
                  </div>
                  <div className="schedule-filter-field">
                    <label htmlFor="horarios-periodo-filter">Período lectivo</label>
                    <select id="horarios-periodo-filter" className="form-select">
                      <option value="">Todos los períodos</option>
                    </select>
                  </div>
                  <div className="schedule-filter-field schedule-filter-action">
                    <button type="button" id="horarios-limpiar" className="btn btn-outline-secondary w-100">
                      <i className="bi bi-eraser me-1"></i> Limpiar
                    </button>
                  </div>
                </div>
              </div>

              <div id="horarios-editor-card" className="schedule-editor-card schedule-editor-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="horarios-editor-title">
                <div className="schedule-editor-head">
                  <div>
                    <span className="schedule-board-kicker">Planificación semanal</span>
                    <h6 className="mb-1" id="horarios-editor-title">Construir horario del grupo</h6>
                    <p className="mb-0">Selecciona un grupo y distribuye sus materias únicamente dentro de los días y la jornada configurados al crear el grupo.</p>
                  </div>
                  <button type="button" id="horarios-editor-close" className="btn btn-sm btn-outline-secondary">
                    <i className="bi bi-x-lg me-1"></i> Cerrar
                  </button>
                </div>

                <div className="schedule-editor-group-row">
                  <div className="schedule-filter-field flex-grow-1">
                    <label htmlFor="horarios-editor-grupo">Grupo</label>
                    <select id="horarios-editor-grupo" className="form-select">
                      <option value="">Seleccionar grupo</option>
                    </select>
                  </div>
                  <div id="horarios-editor-group-info" className="schedule-editor-group-info">
                    Selecciona un grupo para cargar sus días y su jornada.
                  </div>
                </div>

                <div id="horarios-editor-controls" className="schedule-editor-grid-tools hidden">
                  <div>
                    <strong>Horario por bloques</strong>
                    <span>Selecciona la materia directamente en cada espacio de 30 minutos. Los bloques consecutivos de la misma materia se unen al guardar.</span>
                  </div>
                  <div className="schedule-editor-grid-legend">
                    <span><i className="bi bi-grid-3x3-gap"></i> 30 min por fila</span>
                    <span><i className="bi bi-dash-circle"></i> Libre = sin clase</span>
                  </div>
                </div>

                <div id="horarios-editor-coverage" className="schedule-editor-coverage hidden"></div>
                <div id="horarios-editor-week" className="schedule-editor-week"></div>

                <div id="horarios-editor-actions" className="schedule-editor-actions hidden">
                  <span className="small text-muted">Los cambios se aplican al horario del grupo al guardar. Los profesores verán únicamente los bloques de su materia.</span>
                  <button type="button" id="horarios-editor-guardar" className="btn btn-primary">
                    <i className="bi bi-check2-circle me-1"></i> Guardar horario
                  </button>
                </div>
              </div>

              <div className="schedule-stats-grid schedule-stats-grid-compact">
                <article className="schedule-stat-card">
                  <span className="schedule-stat-icon blue"><i className="bi bi-diagram-3"></i></span>
                  <div><small>Asignaciones</small><strong id="horarios-stat-asignaciones">0</strong></div>
                </article>
                <article className="schedule-stat-card">
                  <span className="schedule-stat-icon violet"><i className="bi bi-person-badge"></i></span>
                  <div><small>Profesores</small><strong id="horarios-stat-profesores">0</strong></div>
                </article>
                <article className="schedule-stat-card">
                  <span className="schedule-stat-icon green"><i className="bi bi-clock"></i></span>
                  <div><small>Horas semanales</small><strong id="horarios-stat-horas">0 h</strong></div>
                </article>
                <article className="schedule-stat-card">
                  <span className="schedule-stat-icon amber"><i className="bi bi-door-open"></i></span>
                  <div><small>Aulas</small><strong id="horarios-stat-aulas">0</strong></div>
                </article>
              </div>

              <div className="schedule-board-card schedule-board-card-modal">
                <div className="schedule-board-heading">
                  <div>
                    <span id="horarios-board-kicker" className="schedule-board-kicker">Vista semanal</span>
                    <h3 id="horarios-board-title" className="h5 mb-1">Agenda institucional</h3>
                    <p id="horarios-board-description" className="text-muted small mb-0">Selecciona un profesor para ver su línea de tiempo detallada.</p>
                  </div>
                  <div className="schedule-legend" aria-label="Leyenda de horarios">
                    <span><i className="schedule-dot regular"></i> Clase regular</span>
                    <span><i className="schedule-dot substitute"></i> Sustitución</span>
                  </div>
                </div>
                <div id="horarios-board" className="schedule-board" aria-live="polite">
                  <div className="schedule-empty-state">
                    <i className="bi bi-calendar2-week"></i>
                    <strong>Abre la consulta para cargar los horarios.</strong>
                    <span>Cuando existan asignaciones activas, aquí verás la agenda semanal organizada por día y por hora.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer schedule-modal-footer">
            <span className="schedule-modal-help"><i className="bi bi-info-circle"></i> Los horarios provienen de las asignaciones activas de cada grupo y se actualizan con el botón de refrescar.</span>
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
