import React from 'react';

export default function Estudiantes() {
  return (
    <section id="estudiantes-view" className="view hidden">
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
            <h2 className="card-title-serif h5 mb-0"><i className="bi bi-people-fill"></i> Pre-registro de Estudiantes</h2>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <div className="input-group input-group-sm search-box">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input id="persona-search" type="text" className="form-control" placeholder="Buscar por nombre..." />
              </div>
              <button type="button" className="btn btn-primary btn-sm" id="btn-abrir-modal-estudiante" data-bs-toggle="modal" data-bs-target="#modalEstudiante">
                <i className="bi bi-plus-lg"></i> Agregar Estudiante
              </button>
            </div>
          </div>
          <p className="text-muted small mb-3"><i className="bi bi-info-circle"></i> Este es el pre-registro del estudiante. La asignación a un grupo se hace luego desde el módulo de <strong>Matrícula</strong>.</p>
          <div className="table-responsive">
            <table id="personas-table" className="table table-hover align-middle mb-0">
              <thead><tr><th>ID</th><th>Nombre Completo</th><th>Nacimiento</th><th>Ingreso</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="modal fade" id="modalEstudiante" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-navy text-white">
              <h5 id="persona-form-title" className="modal-title font-serif"><i className="bi bi-person-plus"></i> Pre-registro de Estudiante</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <form id="persona-form">
              <div className="modal-body p-4">
                <input id="persona-id" type="hidden" />
                <div className="row g-3">
                  <div className="col-md-6"><label className="form-label" htmlFor="nombre">Nombre</label><input id="nombre" className="form-control" required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="apellido1">Primer apellido</label><input id="apellido1" className="form-control" required /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="apellido2">Segundo apellido</label><input id="apellido2" className="form-control" /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="fecha_nacimiento">Fecha de nacimiento</label><input id="fecha_nacimiento" type="date" className="form-control" /></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="genero">Género</label><select id="genero" className="form-select"><option value="">Seleccionar</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option></select></div>
                  <div className="col-md-6"><label className="form-label" htmlFor="persona-fecha-ingreso">Fecha de ingreso</label><input id="persona-fecha-ingreso" type="date" className="form-control" /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" id="persona-submit" className="btn btn-primary"><i className="bi bi-check2-circle"></i> Guardar Estudiante</button></div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade" id="modalEliminarEstudiante" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-sm"><div className="modal-content border-0 shadow-lg">
          <div className="modal-body p-4 text-center">
            <i className="bi bi-exclamation-triangle-fill text-danger" style={{fontSize:'42px'}}></i>
            <h5 className="mt-3">Eliminar estudiante</h5>
            <p className="text-muted">¿Deseas eliminar a <strong id="eliminar-nombre-estudiante"></strong>?</p>
            <div className="d-flex gap-2"><button type="button" className="btn btn-outline-secondary w-50" data-bs-dismiss="modal">Cancelar</button><button type="button" id="confirmar-eliminar-estudiante-btn" className="btn btn-danger w-50">Eliminar</button></div>
          </div>
        </div></div>
      </div>
    </section>
  );
}
