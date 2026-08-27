import React from 'react';
import Horarios from './Horarios';

const Modal = ({id,title,children,footer}) => (
  <div className="modal fade" id={id} tabIndex="-1" aria-hidden="true">
    <div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content border-0 shadow-lg">
      <div className="modal-header bg-navy text-white"><h5 className="modal-title font-serif">{title}</h5><button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
      {children}
      {footer && <div className="modal-footer">{footer}</div>}
    </div></div>
  </div>
);

export default function Profesores() {
  const schoolDomain = String(import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN || 'educontrol.com').replace(/^@+/, '');
  const today = new Date();
  const fechaIngresoMax = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const fechaIngresoMin = `${today.getFullYear()}-01-01`;
  return (
    <section id="profesores-view" className="view hidden">
      <div className="faculty-admin-only">
        <div className="page-header d-flex justify-content-between align-items-start gap-3 mb-4 flex-wrap">
          <div className="flex-grow-1">
            <h2 className="card-title-serif h4 mb-1"><i className="bi bi-person-badge"></i> Cuerpo Docente</h2>
            <p className="text-muted small mb-0">Gestiona docentes, asignaciones y consulta la agenda académica desde un solo lugar.</p>
          </div>
          <div className="d-flex gap-2 flex-wrap w-mobile-100">
            <button type="button" className="btn btn-outline-primary schedule-admin-trigger" data-bs-toggle="modal" data-bs-target="#modalHorarios">
              <i className="bi bi-calendar-week"></i> Ver horarios
            </button>
            <button type="button" id="prof-refrescar" className="btn btn-outline-secondary">
              <i className="bi bi-arrow-clockwise"></i> Refrescar
            </button>
            <button type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalProfesor">
              <i className="bi bi-plus-lg"></i> Agregar Profesor
            </button>
          </div>
        </div>
      </div>

      <div className="faculty-professor-only">
        <div className="teacher-self-card mb-4">
          <div className="teacher-self-icon"><i className="bi bi-calendar2-week"></i></div>
          <div className="teacher-self-copy">
            <span className="eyebrow">Mi docencia</span>
            <h2 className="h4 mb-1">Horario y grupos asignados</h2>
            <p className="mb-0">Consulta únicamente tus clases, grupos, aula y horas asignadas en el período lectivo.</p>
          </div>
          <button type="button" className="btn btn-primary teacher-self-action" data-bs-toggle="modal" data-bs-target="#modalHorarios">
            <i className="bi bi-clock-history"></i> Ver mi horario
          </button>
        </div>
      </div>

      <div className="faculty-admin-only">
      <div className="faculty-summary mb-4">
        <div className="faculty-summary-item">
          <span className="faculty-summary-icon"><i className="bi bi-people"></i></span>
          <div><small>Total registrados</small><strong id="prof-cnt-total">–</strong></div>
        </div>
        <div className="faculty-summary-item">
          <span className="faculty-summary-icon faculty-summary-success"><i className="bi bi-person-check"></i></span>
          <div><small>Activos</small><strong id="prof-cnt-activos">–</strong></div>
        </div>
        <div className="faculty-summary-item">
          <span className="faculty-summary-icon faculty-summary-muted"><i className="bi bi-person-dash"></i></span>
          <div><small>Inactivos</small><strong id="prof-cnt-inactivos">–</strong></div>
        </div>
        <div className="faculty-summary-item">
          <span className="faculty-summary-icon faculty-summary-warning"><i className="bi bi-arrow-repeat"></i></span>
          <div><small>Grupos por restaurar</small><strong id="prof-cnt-pendientes">–</strong></div>
        </div>
      </div>
      <div className="card border-0 shadow-sm"><div className="card-body"><div className="profesor-filter-bar mb-3"><div className="input-group input-group-sm search-box"><span className="input-group-text"><i className="bi bi-search"></i></span><input id="prof-search" type="text" className="form-control" maxLength="80" placeholder="Buscar profesor..." /></div><select id="prof-filtro-materia" className="form-select form-select-sm"><option value="todas">Todas las materias</option><option>Español</option><option>Matemáticas</option><option>Ciencias</option><option>Estudios Sociales</option><option>Inglés</option><option>Educación Física</option><option>Informática</option><option>Artes</option></select><select id="prof-filtro-estado" className="form-select form-select-sm"><option value="todos">Todos los estados</option><option value="activos">Solo activos</option><option value="inactivos">Solo inactivos</option></select></div><div className="profesores-table-wrap"><table id="profesores-table" className="table table-hover align-middle mb-0"><thead><tr><th>Nombre Completo</th><th>Materia</th><th>Ingreso</th><th>Grupos y horario</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead><tbody></tbody></table></div><div className="profesor-pagination mt-3"><span id="prof-page-info" className="small text-muted">0 profesores</span><div className="btn-group btn-group-sm" role="group"><button type="button" id="prof-page-prev" className="btn btn-outline-secondary"><i className="bi bi-chevron-left"></i> Anterior</button><button type="button" id="prof-page-next" className="btn btn-outline-secondary">Siguiente <i className="bi bi-chevron-right"></i></button></div></div></div></div>

      </div>

      <Modal id="modalProfesor" title={<><i className="bi bi-person-plus"></i> Registrar Profesor</>}>
        <form id="profesor-form" autoComplete="off"><div className="modal-body p-4">
          <div className="prof-autofill-trap" aria-hidden="true">
            <input type="text" name="username" autoComplete="username" tabIndex="-1" />
            <input type="password" name="password" autoComplete="current-password" tabIndex="-1" />
          </div>
          <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Nombre</label><input id="prof-nombre" className="form-control" maxLength="60" required /></div><div className="col-md-6"><label className="form-label">Primer apellido</label><input id="prof-apellido1" className="form-control" maxLength="60" required /></div><div className="col-md-6"><label className="form-label">Segundo apellido</label><input id="prof-apellido2" className="form-control" maxLength="60" /></div><div className="col-md-6"><label className="form-label">Materia</label><select id="prof-materia" className="form-select" defaultValue="" required><option value="" disabled>Seleccionar materia</option><option value="Español">Español</option><option value="Matemáticas">Matemáticas</option><option value="Ciencias">Ciencias</option><option value="Estudios Sociales">Estudios Sociales</option><option value="Inglés">Inglés</option><option value="Educación Física">Educación Física</option><option value="Informática">Informática</option><option value="Artes">Artes</option></select></div><div className="col-md-6"><label className="form-label">Correo</label><input id="prof-correo" name="profesor_correo_nuevo" type="email" className="form-control" maxLength="150" placeholder={`ejemplo.profesor@${schoolDomain}`} autoComplete="off" readOnly required /></div><div className="col-md-6"><label className="form-label">Contraseña</label><div className="input-group"><input id="prof-contrasena" name="profesor_clave_nueva" type="password" className="form-control" placeholder="Profesor2026!" autoComplete="new-password" readOnly minLength="6" required /><button type="button" id="toggle-prof-password" className="btn btn-outline-secondary"><i className="bi bi-eye"></i></button></div></div><div className="col-md-6"><label className="form-label">Fecha de nacimiento</label><input id="prof-fecha-nac" type="date" className="form-control" required /></div><div className="col-md-6"><label className="form-label">Fecha de ingreso</label><input id="prof-fecha-ingreso" type="date" min={fechaIngresoMin} max={fechaIngresoMax} className="form-control" required /></div><div className="col-md-6"><label className="form-label">Género</label><select id="prof-genero" className="form-select" required><option value="">Seleccionar</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option></select></div><div className="col-md-6"><label className="form-label">Carga máxima semanal</label><div className="input-group"><input id="prof-horas-max" type="number" min="1" max="60" step="0.5" defaultValue="40" className="form-control" required /><span className="input-group-text">horas</span></div><div className="form-text">El sistema impedirá asignaciones que superen esta carga.</div></div>
        </div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar Profesor</button></div></form>
      </Modal>


      <Modal id="modalEditarProfesor" title={<><i className="bi bi-pencil-square"></i> Editar Profesor</>}>
        <form id="editar-profesor-form" noValidate>
          <div className="modal-body p-4">
            <input id="edit-prof-id" type="hidden" />
            <div className="alert alert-light border small mb-3">Actualiza los datos administrativos del docente sin perder sus grupos ni su historial.</div>
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">Nombre</label><input id="edit-prof-nombre" className="form-control" maxLength="60" required /></div>
              <div className="col-md-6"><label className="form-label">Primer apellido</label><input id="edit-prof-apellido1" className="form-control" maxLength="60" required /></div>
              <div className="col-md-6"><label className="form-label">Segundo apellido</label><input id="edit-prof-apellido2" className="form-control" maxLength="60" /></div>
              <div className="col-md-6"><label className="form-label">Materia</label><select id="edit-prof-materia" className="form-select" required><option value="Español">Español</option><option value="Matemáticas">Matemáticas</option><option value="Ciencias">Ciencias</option><option value="Estudios Sociales">Estudios Sociales</option><option value="Inglés">Inglés</option><option value="Educación Física">Educación Física</option><option value="Informática">Informática</option><option value="Artes">Artes</option></select></div>
              <div className="col-md-6"><label className="form-label">Correo institucional</label><input id="edit-prof-correo" type="email" className="form-control" maxLength="150" required /></div>
              <div className="col-md-6"><label className="form-label">Género</label><select id="edit-prof-genero" className="form-select" required><option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option></select></div>
              <div className="col-md-6"><label className="form-label">Fecha de nacimiento</label><input id="edit-prof-fecha-nac" type="date" className="form-control" required /></div>
              <div className="col-md-6"><label className="form-label">Fecha de ingreso</label><input id="edit-prof-fecha-ingreso" type="date" min={fechaIngresoMin} max={fechaIngresoMax} className="form-control" required /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary"><i className="bi bi-check2"></i> Guardar cambios</button></div>
        </form>
      </Modal>

      <Modal id="modalDestituir" title={<><i className="bi bi-person-slash"></i> Incapacitar / registrar sustitución</>}><div className="modal-body p-4"><p>Profesor titular: <strong id="destituir-nombre-profesor"></strong></p><div className="row g-3"><div className="col-md-6"><label className="form-label">Desde</label><input id="destituir-fecha-inicio" type="date" className="form-control" required /></div><div className="col-md-6"><label className="form-label">Hasta</label><input id="destituir-fecha-fin" type="date" className="form-control" required /></div><div className="col-12"><label className="form-label">Motivo</label><textarea id="destituir-motivo" className="form-control" rows="3" maxLength="300" required placeholder="Ej.: incapacidad médica"></textarea><div className="form-text">Al finalizar la fecha indicada, el titular recuperará sus grupos si no existe un choque de horario.</div></div></div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="confirmar-destituir-btn" className="btn btn-warning">Confirmar incapacidad</button></div></Modal>
      <Modal id="modalEliminarProfesor" title={<><i className="bi bi-trash"></i> Eliminar Profesor</>}><div className="modal-body p-4"><p>¿Deseas desactivar a <strong id="eliminar-nombre-profesor"></strong>? Su historial académico se conservará.</p></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="confirmar-eliminar-btn" className="btn btn-danger">Eliminar</button></div></Modal>
      <Modal id="modalReintegrar" title={<><i className="bi bi-person-check"></i> Reintegrar Profesor</>}><div className="modal-body p-4"><p>¿Deseas reintegrar a <strong id="reintegrar-nombre-profesor"></strong>?</p></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="confirmar-reintegrar-btn" className="btn btn-success">Reintegrar</button></div></Modal>
      <Modal id="modalAsignarSustituto" title={<><i className="bi bi-person-lines-fill"></i> Asignar Sustituto</>}><div className="modal-body p-4"><p>Profesor titular: <strong id="sustituto-nombre-profesor"></strong></p><div id="sustituto-lista"></div></div></Modal>
      <Modal id="modalAsignarGrupos" title={<><i className="bi bi-diagram-3"></i> Asignar Grupos</>}><div className="modal-body p-4"><p>Profesor: <strong id="asignar-grupos-nombre-profesor"></strong></p><p className="text-muted small">Materia: <span id="asignar-grupos-materia"></span></p><input id="asignar-grupos-search" className="form-control form-control-sm mb-3" placeholder="Buscar grupo..." /><div id="asignar-grupos-lista" className="d-grid gap-2"></div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="confirmar-asignar-grupos-btn" className="btn btn-primary">Guardar asignación</button></div></Modal>
      <Horarios />
    </section>
  );
}
