import React from 'react';

export default function Consultas() {
  return (
    <>
      <section id="consultas-view" className="view hidden">

        <div className="consultas-hero mb-4">
          <div>
            <span className="consultas-eyebrow">
              Gestión académica
            </span>

            <h2 className="card-title-serif h3 mb-2">
              Centro de Consultas
            </h2>

            <p className="text-muted mb-0">
              Consulta estudiantes, profesores, matrículas, grupos y registros de asistencia.
            </p>
          </div>

          <div className="consultas-hero-icon">
            <i className="bi bi-folder2-open"></i>
          </div>
        </div>

        <div
          id="consulta-profesor-contexto"
          className="consulta-profesor-contexto hidden mb-4"
        >
          <div className="consulta-profesor-contexto-icon">
            <i className="bi bi-person-video3"></i>
          </div>
          <div>
            <div className="fw-semibold">Consultando tus grupos asignados</div>
            <div id="consulta-profesor-grupos" className="small text-muted mt-1">
              Cargando grupos...
            </div>
          </div>
        </div>

        <div className="row g-3 mb-4">

          <div className="col-6 col-lg">
            <div className="consulta-stat h-100">
              <div className="consulta-stat-icon">
                <i className="bi bi-person-plus"></i>
              </div>

              <div>
                <span className="text-muted small">
                  Pre-matrícula
                </span>

                <div
                  id="consulta-total-estudiantes"
                  className="fs-3 fw-semibold mt-1"
                >
                  0
                </div>
              </div>
            </div>
          </div>


          <div className="col-6 col-lg">
            <div className="consulta-stat h-100">
              <div className="consulta-stat-icon">
                <i className="bi bi-person-check"></i>
              </div>

              <div>
                <span className="text-muted small">
                  Matriculados
                </span>

                <div
                  id="consulta-total-matriculados"
                  className="fs-3 fw-semibold mt-1"
                >
                  0
                </div>
              </div>
            </div>
          </div>


          <div className="col-6 col-lg">
            <div className="consulta-stat h-100">
              <div className="consulta-stat-icon">
                <i className="bi bi-person-badge"></i>
              </div>

              <div>
                <span className="text-muted small">
                  Profesores
                </span>

                <div
                  id="consulta-total-profesores"
                  className="fs-3 fw-semibold mt-1"
                >
                  0
                </div>
              </div>
            </div>
          </div>


          <div className="col-6 col-lg">
            <div className="consulta-stat h-100">
              <div className="consulta-stat-icon">
                <i className="bi bi-journal-check"></i>
              </div>

              <div>
                <span className="text-muted small">
                  Matrículas
                </span>

                <div
                  id="consulta-total-matriculas"
                  className="fs-3 fw-semibold mt-1"
                >
                  0
                </div>
              </div>
            </div>
          </div>


          <div className="col-6 col-lg">
            <div className="consulta-stat h-100">
              <div className="consulta-stat-icon">
                <i className="bi bi-calendar-check"></i>
              </div>

              <div>
                <span className="text-muted small">
                  Asistencia
                </span>

                <div
                  id="consulta-total-asistencias"
                  className="fs-3 fw-semibold mt-1"
                >
                  0
                </div>
              </div>
            </div>
          </div>
        <div className="col-6 col-lg">
  <div className="consulta-stat h-100">
    <div className="consulta-stat-icon">
      <i className="bi bi-people"></i>
    </div>

    <div>
      <span className="text-muted small">
        Grupos
      </span>

      <div
        id="consulta-total-grupos"
        className="fs-3 fw-semibold mt-1"
      >
        0
      </div>
    </div>
  </div>
</div>
        </div>


        <div className="card border-0 shadow-sm">
          <div className="card-body">

            <div className="row g-3 align-items-end mb-4">

              <div className="col-12 col-md-4">
                <label
                  htmlFor="consulta-tipo"
                  className="form-label"
                >
                  Tipo de consulta
                </label>

                <select
                  id="consulta-tipo"
                  className="form-select"
                >
                  <option
                    value="prematriculados"
                    defaultValue="prematriculados"
                  >
                    Estudiantes en pre-matrícula
                  </option>

                  <option value="matriculados">
                    Estudiantes matriculados
                  </option>

                  <option value="profesores">
                    Profesores
                  </option>

                  <option value="matriculas">
                    Matrículas
                  </option>

                  <option value="asistencia">
                    Asistencia
                  </option>

                  <option value="grupos">
                    Grupos
                  </option>  
                </select>
              </div>


              <div className="col-12 col-md-5">
                <label
                  htmlFor="consulta-busqueda"
                  className="form-label"
                >
                  Buscar
                </label>

                <div className="input-group">

                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>

                  <input
                    id="consulta-busqueda"
                    type="text"
                    className="form-control"
                    placeholder="Buscar estudiante pendiente..."
                  />

                </div>
              </div>


              <div className="col-12 col-md-3">
                <button
                  type="button"
                  id="consulta-limpiar"
                  className="btn btn-outline-secondary w-100"
                >
                  <i className="bi bi-arrow-counterclockwise"></i>
                  {' '}
                  Limpiar filtros
                </button>
              </div>

            </div>


            <div
              id="consulta-filtros"
              className="border rounded p-3 mb-4 bg-light"
            >

              <div className="row g-3">

                <div className="col-12 col-md-4">
                  <label
                    htmlFor="consulta-estado"
                    className="form-label"
                  >
                    Estado
                  </label>

                  <select
                    id="consulta-estado"
                    className="form-select"
                  >
                    <option value="">
                      Todos
                    </option>

                    <option value="activo">
                      Activo
                    </option>

                    <option value="inactivo">
                      Inactivo
                    </option>
                  </select>
                </div>


                <div className="col-12 col-md-4 consulta-filtro-grupo hidden">
                  <label
                    htmlFor="consulta-grupo"
                    className="form-label"
                  >
                    Grupo
                  </label>

                  <select
                    id="consulta-grupo"
                    className="form-select"
                  >
                    <option value="">
                      Todos los grupos
                    </option>
                  </select>
                </div>


                <div className="col-12 col-md-4 consulta-filtro-seccion hidden">
                  <label
                    htmlFor="consulta-seccion"
                    className="form-label"
                  >
                    Sección
                  </label>

                  <select
                    id="consulta-seccion"
                    className="form-select"
                  >
                    <option value="">
                      Todas las secciones
                    </option>
                  </select>
                </div>


                <div className="col-12 col-md-4 consulta-filtro-nivel hidden">
                  <label
                    htmlFor="consulta-nivel"
                    className="form-label"
                  >
                    Nivel
                  </label>

                  <select
                    id="consulta-nivel"
                    className="form-select"
                  >
                    <option value="">
                      Todos los niveles
                    </option>
                  </select>
                </div>


                <div className="col-12 col-md-4 consulta-filtro-fecha hidden">
                  <label
                    htmlFor="consulta-fecha"
                    className="form-label"
                  >
                    Fecha
                  </label>

                  <input
                    id="consulta-fecha"
                    type="date"
                    className="form-control"
                  />
                </div>

              </div>

            </div>


            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">

              <div>
                <h3
                  id="consulta-titulo-tabla"
                  className="h5 mb-1"
                >
                  Estudiantes pendientes de matrícula
                </h3>

                <span
                  id="consulta-cantidad"
                  className="text-muted small"
                >
                  0 resultados encontrados
                </span>
              </div>


              <button
                type="button"
                id="consulta-refrescar"
                className="btn btn-outline-primary btn-sm"
              >
                <i className="bi bi-arrow-clockwise"></i>
                {' '}
                Actualizar
              </button>

            </div>


            <div className="table-responsive">

              <table
                id="consulta-tabla"
                className="table table-hover align-middle mb-0"
              >

                <thead id="consulta-tabla-head">
                  <tr>
                    <th>ID</th>
                    <th>Nombre completo</th>
                    <th>Nacimiento</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th className="text-end">
                      Acciones
                    </th>
                  </tr>
                </thead>


                <tbody id="consulta-tabla-body">

                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-5 text-muted"
                    >
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      >
                      </span>

                      Cargando información de consultas...
                    </td>
                  </tr>

                </tbody>

              </table>

            </div>

          </div>
        </div>

      </section>


      <div
        className="modal fade"
        id="modalDetalleConsulta"
        tabIndex="-1"
        aria-labelledby="consulta-detalle-titulo"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5
                  className="modal-title mb-1"
                  id="consulta-detalle-titulo"
                >
                  Vista previa
                </h5>
                <div
                  id="consulta-documento-subtitulo"
                  className="text-muted small"
                >
                  Sistema de Gestión Escolar
                </div>
              </div>

              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Cerrar"
              ></button>
            </div>

            <div className="modal-body">
              <div className="consulta-documento mb-0">
                <div className="consulta-documento-header">
                  <div className="consulta-documento-logo">
                    <i className="bi bi-mortarboard-fill"></i>
                  </div>
                  <div className="consulta-documento-institucion">
                    <strong>EDUCONTROL</strong>
                    <div
                      id="consulta-documento-titulo"
                      className="consulta-documento-titulo"
                    >
                      Documento académico
                    </div>
                  </div>
                  <div className="consulta-documento-meta">
                    <strong>Fecha</strong>
                    <span id="consulta-documento-fecha">-</span>
                  </div>
                </div>

                <div className="consulta-documento-linea"></div>

                <div
                  id="consulta-detalle-contenido"
                  className="consulta-documento-contenido"
                >
                  <div className="text-center py-5 text-muted">
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Preparando documento...
                  </div>
                </div>

                <div className="consulta-documento-footer">
                  Documento generado desde el Sistema de Gestión Escolar.
                </div>
              </div>
            </div>

          <div className="modal-footer">
  <button
    type="button"
    id="consulta-descargar-pdf"
    className="btn btn-primary"
  >
    <i className="bi bi-file-earmark-pdf"></i>
    {' '}
    Descargar PDF
  </button>

  <button
    type="button"
    className="btn btn-secondary"
    data-bs-dismiss="modal"
  >
    Cerrar
  </button>
</div>

          </div>
        </div>
      </div>

    </>
  );
}