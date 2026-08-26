import React from 'react';

export default function Horarios() {
  return (
    <section id="horarios-view" className="view hidden schedule-page">
      <div className="schedule-page-header">
        <div>
          <p className="eyebrow mb-1">Agenda académica</p>
          <h2 className="h4 mb-1"><i className="bi bi-calendar-week me-2"></i>Horarios de clases</h2>
          <p id="horarios-subtitle" className="text-muted mb-0">Consulta profesores, cursos, grupos, aulas y horas asignadas.</p>
        </div>
        <button type="button" id="horarios-refrescar" className="btn btn-outline-primary">
          <i className="bi bi-arrow-clockwise me-1"></i> Actualizar
        </button>
      </div>

      <div className="schedule-filter-card">
        <div className="schedule-filter-title">
          <span className="schedule-filter-icon"><i className="bi bi-funnel"></i></span>
          <div>
            <strong>Filtrar horario</strong>
            <small>Los datos se muestran a partir de las asignaciones activas de cada grupo.</small>
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
              <i className="bi bi-eraser me-1"></i> Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="schedule-stats-grid">
        <article className="schedule-stat-card">
          <span className="schedule-stat-icon blue"><i className="bi bi-diagram-3"></i></span>
          <div><small>Asignaciones</small><strong id="horarios-stat-asignaciones">0</strong></div>
        </article>
        <article className="schedule-stat-card">
          <span className="schedule-stat-icon violet"><i className="bi bi-person-badge"></i></span>
          <div><small>Profesores visibles</small><strong id="horarios-stat-profesores">0</strong></div>
        </article>
        <article className="schedule-stat-card">
          <span className="schedule-stat-icon green"><i className="bi bi-clock-history"></i></span>
          <div><small>Horas semanales</small><strong id="horarios-stat-horas">0 h</strong></div>
        </article>
        <article className="schedule-stat-card">
          <span className="schedule-stat-icon amber"><i className="bi bi-door-open"></i></span>
          <div><small>Aulas utilizadas</small><strong id="horarios-stat-aulas">0</strong></div>
        </article>
      </div>

      <div className="schedule-board-card">
        <div className="schedule-board-heading">
          <div>
            <span id="horarios-board-kicker" className="schedule-board-kicker">Vista semanal</span>
            <h3 id="horarios-board-title" className="h5 mb-1">Agenda institucional</h3>
            <p id="horarios-board-description" className="text-muted small mb-0">Selecciona un profesor para ver su línea de tiempo por horas.</p>
          </div>
          <div className="schedule-legend" aria-label="Leyenda de horarios">
            <span><i className="schedule-dot regular"></i> Clase regular</span>
            <span><i className="schedule-dot substitute"></i> Sustitución</span>
          </div>
        </div>
        <div id="horarios-board" className="schedule-board" aria-live="polite">
          <div className="schedule-empty-state">
            <i className="bi bi-calendar2-week"></i>
            <strong>Cargando horarios...</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
