import React from 'react';

export default function Usuarios() {
  const schoolDomain = String(import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN || 'educontrol.com').replace(/^@+/, '');
  return (
    <>
      <section id="usuarios-view" className="view hidden">
        <div className="container-fluid py-3">
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-person-plus-fill text-primary me-2"></i>
                    Registrar Usuario
                  </h5>
                </div>

                <div className="card-body">
                  <form id="usuario-form" autoComplete="off">
                    <div className="mb-3">
                      <label className="form-label" htmlFor="usuario-nombre">Nombre</label>
                      <input type="text" id="usuario-nombre" className="form-control" maxLength="80" required />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="usuario-apellido1">Primer Apellido</label>
                      <input type="text" id="usuario-apellido1" className="form-control" maxLength="80" required />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="usuario-correo">Correo Electrónico</label>
                      <input
                        type="email"
                        id="usuario-correo"
                        className="form-control"
                        placeholder={`usuario@${schoolDomain}`}
                        autoComplete="new-email"
                        maxLength="150"
                        required
                      />
                      <div className="form-text">Solo se permiten cuentas @{schoolDomain}.</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="usuario-rol">Rol / Permisos</label>
                      <select id="usuario-rol" className="form-select" defaultValue="Asistente" required>
                        <option value="Administrador">Administrador</option>
                        <option value="Asistente">Asistente</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="usuario-clave">Contraseña Temporal</label>
                      <input
                        type="password"
                        id="usuario-clave"
                        className="form-control"
                        minLength="6"
                        autoComplete="new-password"
                        required
                      />
                      
                    </div>

                    <button type="submit" id="btn-guardar-usuario" className="btn btn-primary w-100 py-2">
                      <i className="bi bi-person-check me-1"></i> Guardar Usuario
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-8">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-shield-check text-primary me-2"></i>
                    Gestión de Permisos y Usuarios
                  </h5>
                  <button type="button" id="btn-refrescar-usuarios" className="btn btn-sm btn-outline-primary">
                    <i className="bi bi-arrow-clockwise me-1"></i> Refrescar
                  </button>
                </div>

                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Usuario</th>
                          <th>Correo</th>
                          <th>Rol</th>
                          <th className="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody id="tabla-usuarios-body">
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-4">
                            Cargando usuarios...
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="modal fade" id="modalEditarUsuario" tabIndex="-1" aria-labelledby="modalEditarUsuarioLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header bg-dark text-white">
              <h5 className="modal-title" id="modalEditarUsuarioLabel">
                <i className="bi bi-pencil-square me-2"></i>Modificar Usuario
              </h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>

            <form id="usuario-editar-form" autoComplete="off">
              <div className="modal-body">
                <input type="hidden" id="usuario-editar-id" />
                <input type="hidden" id="usuario-editar-id-persona" />

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="usuario-editar-nombre">Nombre</label>
                    <input type="text" id="usuario-editar-nombre" className="form-control" maxLength="80" required />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="usuario-editar-apellido1">Primer Apellido</label>
                    <input type="text" id="usuario-editar-apellido1" className="form-control" maxLength="80" required />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="usuario-editar-correo">Correo Electrónico</label>
                    <input type="email" id="usuario-editar-correo" className="form-control" maxLength="150" required />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="usuario-editar-rol">Rol / Permisos</label>
                    <select id="usuario-editar-rol" className="form-select" required>
                      <option value="1">Administrador</option>
                      <option value="2">Asistente</option>
                    </select>
                    <div id="usuario-editar-rol-ayuda" className="form-text d-none">
                      No puedes cambiar tu propio rol mientras esta sesión está activa.
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="usuario-editar-clave">Nueva contraseña</label>
                    <input
                      type="password"
                      id="usuario-editar-clave"
                      className="form-control"
                      minLength="6"
                      autoComplete="new-password"
                      placeholder="Déjala vacía para conservar la actual"
                    />
                    <div className="form-text">Solo complétala si deseas cambiar la contraseña.</div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" id="btn-actualizar-usuario" className="btn btn-primary">
                  <i className="bi bi-save me-1"></i> Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
