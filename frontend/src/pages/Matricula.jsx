import React from 'react';

const Modal = ({id,title,children,lg=false,className=''}) => <div className={`modal fade ${className}`} id={id} tabIndex="-1" aria-hidden="true"><div className={`modal-dialog modal-dialog-centered ${lg?'modal-lg':''}`}><div className="modal-content border-0 shadow-lg"><div className="modal-header bg-navy text-white"><h5 className="modal-title font-serif">{title}</h5><button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>{children}</div></div></div>;

export default function Matricula() {
  return (
    <section id="matricula-view" className="view hidden">
      <div className="row g-4">
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm text-center p-3 h-100"><div className="card-body d-flex flex-column align-items-center justify-content-center"><i className="bi bi-journal-plus text-primary fs-1 mb-2"></i><h3 className="h5">Nueva Matrícula</h3><p className="text-muted small mb-3">Asigna un estudiante a un grupo de clase.</p><button type="button" className="btn btn-outline-secondary w-100 matricula-card-action" data-bs-toggle="modal" data-bs-target="#modalMatricula">Procesar Matrícula</button></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm text-center p-3 h-100"><div className="card-body d-flex flex-column align-items-center justify-content-center"><i className="bi bi-people text-primary fs-1 mb-2"></i><h3 className="h5">Grupos</h3><p className="text-muted small mb-3">Configura aulas, capacidades y horarios.</p><div className="d-grid gap-2 w-100"><button type="button" className="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#modalGrupo"><i className="bi bi-plus-circle me-1"></i>Crear Grupo</button><button type="button" className="btn btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#modalGestionGrupo">Gestionar Grupo</button></div></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm text-center p-3 h-100"><div className="card-body d-flex flex-column align-items-center justify-content-center"><i className="bi bi-person-gear text-primary fs-1 mb-2"></i><h3 className="h5">Gestionar Matrícula</h3><p className="text-muted small mb-3">Transfiere o retira estudiantes de un grupo.</p><button type="button" className="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#modalGestionMatricula">Gestionar Matrícula</button></div></div></div>
        <div className="col-6 col-md-3"><div className="card border-0 shadow-sm text-center p-3 h-100"><div className="card-body d-flex flex-column align-items-center justify-content-center"><i className="bi bi-diagram-3 text-primary fs-1 mb-2"></i><h3 className="h5">Secciones</h3><p className="text-muted small mb-3">Administra el catálogo académico y sus secciones.</p><button type="button" className="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#modalSeccion">Administrar secciones</button></div></div></div>
      </div>

      <Modal id="modalMatricula" title={<><i className="bi bi-journal-check"></i> Procesar Matrícula</>} lg className="edu-work-modal">
        <form id="matricula-form"><div className="modal-body p-4"><div className="row g-3">
          <div className="col-12"><label className="form-label">Estudiante</label><select id="mat-persona" className="form-select" required><option value="" disabled>Seleccionar estudiante</option></select></div>
          <div className="col-12"><div id="mat-estado-financiero" className="mat-financial-status neutral"><div className="d-flex align-items-center gap-2"><i className="bi bi-wallet2"></i><strong>Validación financiera</strong></div><div id="mat-estado-financiero-texto" className="small mt-1">Selecciona un estudiante para verificar el abono mínimo de matrícula.</div><div id="mat-deudas-pendientes" className="small mt-2"></div></div></div>
          <div className="col-12"><label className="form-label">Buscar grupo</label><input id="mat-grupo-search" className="form-control form-control-sm mb-2" maxLength="120" placeholder="Filtrar por nombre..." /><select id="mat-id-grupo" className="form-select" required><option value="" disabled>Seleccionar grupo</option></select><div id="mat-grupo-info" className="form-text">Selecciona un grupo para ver el cupo disponible.</div></div>
          <div className="col-md-4"><label className="form-label">Fecha</label><input id="mat-fecha" type="date" className="form-control" required /></div><div className="col-md-4"><label className="form-label">Período</label><select id="mat-periodo" className="form-select" required><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div><div className="col-md-4"><label className="form-label">Tipo</label><select id="mat-tipo" className="form-select" required><option value="ordinaria">Ordinaria</option><option value="traslado">Traslado</option><option value="extraordinaria">Extraordinaria</option></select></div><div className="col-12"><label className="form-label">Observaciones</label><textarea id="mat-observaciones" maxLength="150" rows="3" className="form-control" placeholder="Observaciones opcionales"></textarea></div>
        </div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button><button type="submit" id="mat-submit" className="btn btn-primary">Completar Matrícula</button></div></form>
      </Modal>

      <Modal id="modalGrupo" title={<><i className="bi bi-people"></i> Crear Grupo</>} lg className="edu-work-modal">
        <form id="grupo-form"><div className="modal-body p-4"><div className="row g-3 group-create-grid">
          <div className="col-md-6"><label className="form-label">Nombre del grupo</label><input id="grupo-nombre" className="form-control" maxLength="80" placeholder="Ej.: Lunes-Miércoles" required /></div>
          <div className="col-md-3"><label className="form-label">Capacidad</label><input id="grupo-capacidad" type="number" min="1" className="form-control" required /></div>
          <div className="col-md-3"><label className="form-label">Aula</label><select id="grupo-aula" className="form-select" required><option value="" disabled>Seleccionar aula</option>{Array.from({length:25},(_,i)=>{const codigo=`Aula ${String(i+1).padStart(2,'0')}`;return <option key={codigo} value={codigo}>{codigo}</option>})}</select></div>
          <div className="col-12"><label className="form-label schedule-label"><i className="bi bi-calendar-week schedule-field-icon"></i>Días de clase</label><div className="schedule-days schedule-days-week" id="grupo-dias">{['lunes','martes','miercoles','jueves','viernes'].map((dia) => <label key={dia} className="schedule-day"><input type="checkbox" value={dia} /> <span>{dia === 'miercoles' ? 'Miércoles' : dia.charAt(0).toUpperCase()+dia.slice(1)}</span></label>)}</div><div className="form-text">Selecciona los días reales. El sistema impedirá que el aula quede asignada a dos grupos en horarios que se crucen.</div></div>
          <div className="col-md-4"><label className="form-label schedule-label"><i className="bi bi-clock schedule-field-icon"></i>Hora de inicio</label><input id="grupo-hora-inicio" type="time" className="form-control schedule-time-control" required /></div>
          <div className="col-md-4"><label className="form-label schedule-label"><i className="bi bi-clock-fill schedule-field-icon"></i>Hora de finalización</label><input id="grupo-hora-fin" type="time" className="form-control schedule-time-control" required /></div>
          <div className="col-md-4"><label className="form-label">Sección</label><select id="grupo-seccion" className="form-select" required><option value="" disabled>Seleccionar sección</option></select></div>
          <div className="col-12"><input id="grupo-seccion-search" className="form-control form-control-sm" placeholder="Buscar sección por nombre, nivel o año..." /><div className="form-text">Las secciones y aulas ya ocupadas para ese horario se marcan como no disponibles.</div><div id="grupo-seccion-empty-hint" className="form-text hidden">No hay secciones registradas.</div></div>
        </div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button><button type="submit" className="btn btn-outline-secondary">Crear Grupo</button></div></form>
      </Modal>

      <Modal id="modalGestionGrupo" title={<><i className="bi bi-pencil-square"></i> Gestionar Grupo</>} lg>
        <form id="gestion-grupo-form"><div className="modal-body p-4"><div className="row g-3"><div className="col-12"><label className="form-label">Grupo</label><select id="gestion-grupo-select" className="form-select" required><option value="" disabled>Seleccionar grupo</option></select></div><div className="col-md-6"><label className="form-label">Capacidad</label><input id="gestion-grupo-capacidad" type="number" min="1" className="form-control" required /></div><div className="col-md-6"><label className="form-label">Aula</label><select id="gestion-grupo-aula" className="form-select" required><option value="" disabled>Seleccionar aula</option>{Array.from({length:25},(_,i)=>{const codigo=`Aula ${String(i+1).padStart(2,'0')}`;return <option key={codigo} value={codigo}>{codigo}</option>})}</select><div className="form-text">No se permiten dos grupos en la misma aula con horarios superpuestos.</div></div><div className="col-12"><label className="form-label schedule-label"><i className="bi bi-calendar-week schedule-field-icon"></i>Días de clase</label><div className="schedule-days" id="gestion-grupo-dias">{['lunes','martes','miercoles','jueves','viernes'].map((dia) => <label key={dia} className="schedule-day"><input type="checkbox" value={dia} /> <span>{dia === 'miercoles' ? 'Miércoles' : dia.charAt(0).toUpperCase()+dia.slice(1)}</span></label>)}</div></div><div className="col-md-6"><label className="form-label schedule-label"><i className="bi bi-clock schedule-field-icon"></i>Hora de inicio</label><input id="gestion-grupo-hora-inicio" type="time" className="form-control schedule-time-control" /></div><div className="col-md-6"><label className="form-label schedule-label"><i className="bi bi-clock-fill schedule-field-icon"></i>Hora de finalización</label><input id="gestion-grupo-hora-fin" type="time" className="form-control schedule-time-control" /></div></div></div><div className="modal-footer d-flex justify-content-between"><button type="button" id="btn-borrar-grupo" className="btn btn-outline-danger"><i className="bi bi-trash"></i> Borrar Grupo</button><div><button type="button" className="btn btn-outline-secondary me-2" data-bs-dismiss="modal">Cerrar</button><button type="submit" className="btn btn-primary">Guardar cambios</button></div></div></form>
      </Modal>

      <Modal id="modalGestionMatricula" title={<><i className="bi bi-person-gear"></i> Gestionar Matrícula</>} lg>
        <form id="gestion-matricula-form"><div className="modal-body p-4"><div className="row g-3"><div className="col-md-6"><label className="form-label">Grupo actual</label><select id="gm-grupo-actual" className="form-select" required><option value="" disabled>Seleccionar grupo</option></select></div><div className="col-md-6"><label className="form-label">Estudiante</label><select id="gm-estudiante" className="form-select" required disabled><option value="" disabled>Primero selecciona un grupo</option></select></div><div className="col-md-6"><label className="form-label">Acción</label><select id="gm-accion" className="form-select"><option value="transferir">Transferir</option><option value="retirar">Retirar</option></select></div><div id="gm-campos-transferir" className="col-12"><div className="row g-3"><div className="col-md-6"><label className="form-label">Grupo nuevo</label><select id="gm-grupo-nuevo" className="form-select"><option value="" disabled>Seleccionar grupo destino</option></select></div><div className="col-md-6"><label className="form-label">Fecha</label><input id="gm-fecha" type="date" className="form-control" /></div><div className="col-md-6"><label className="form-label">Período</label><select id="gm-periodo" className="form-select"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div><div className="col-md-6"><label className="form-label">Tipo</label><select id="gm-tipo" className="form-select"><option value="traslado">Traslado</option></select></div><div className="col-12"><label className="form-label">Observaciones</label><textarea id="gm-observaciones" maxLength="150" rows="3" className="form-control" placeholder="Observaciones opcionales"></textarea></div></div></div><div className="col-12"><div id="gm-hint" className="form-text">Selecciona un grupo para ver a sus estudiantes.</div></div></div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" id="gm-submit" className="btn btn-primary">Guardar cambios</button></div></form>
      </Modal>

      <Modal id="modalSeccion" title={<><i className="bi bi-diagram-3"></i> Administrar Secciones</>} lg className="edu-section-modal">
        <div className="modal-body section-admin-body section-admin-tabs-body">
          <div className="section-tabs" role="tablist" aria-label="Administración de secciones">
            <button className="section-tab active" id="section-tab-create" data-bs-toggle="tab" data-bs-target="#section-pane-create" type="button" role="tab" aria-controls="section-pane-create" aria-selected="true"><i className="bi bi-plus-circle"></i><span>Crear sección</span></button>
            <button className="section-tab" id="section-tab-manage" data-bs-toggle="tab" data-bs-target="#section-pane-manage" type="button" role="tab" aria-controls="section-pane-manage" aria-selected="false"><i className="bi bi-collection"></i><span>Secciones registradas</span></button>
            <button className="section-tab" id="section-tab-period" data-bs-toggle="tab" data-bs-target="#section-pane-period" type="button" role="tab" aria-controls="section-pane-period" aria-selected="false"><i className="bi bi-calendar-range"></i><span>Período lectivo</span></button>
          </div>

          <div className="tab-content section-tab-content">
            <div className="tab-pane fade show active" id="section-pane-create" role="tabpanel" aria-labelledby="section-tab-create" tabIndex="0">
              <div className="section-workspace section-create-workspace">
                <div className="section-workspace-main">
                  <div className="section-pane-heading">
                    <span className="section-panel-icon"><i className="bi bi-plus-square"></i></span>
                    <div><h6>Crear nueva sección</h6><p>Define grado, letra y año lectivo. La descripción puede quedar vacía.</p></div>
                  </div>
                  <form id="seccion-form" noValidate>
                    <div className="row g-3">
                      <div className="col-4">
                        <label className="form-label">Grado</label>
                        <select id="seccion-nivel" className="form-select" defaultValue="1" required>
                          <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option>
                        </select>
                      </div>
                      <div className="col-4">
                        <label className="form-label">Sección</label>
                        <select id="seccion-nombre" className="form-select" defaultValue="A" required>
                          <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option><option value="F">F</option>
                        </select>
                      </div>
                      <div className="col-4">
                        <label className="form-label"><i className="bi bi-calendar3 schedule-field-icon"></i>Año</label>
                        <input id="seccion-periodo" type="number" min="2000" max="2100" className="form-control" placeholder="2026" required />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Descripción <span className="section-optional-label">Opcional</span></label>
                        <input id="seccion-descripcion" className="form-control" maxLength="250" placeholder="Ej.: Primer grado, sección A" aria-required="false" />
                      </div>
                      <div className="col-12 section-create-action">
                        <div id="seccion-validation-hint" className="form-text">El sistema evita duplicados dentro del mismo año lectivo.</div>
                        <button id="btn-crear-seccion" type="submit" className="btn btn-primary"><i className="bi bi-plus-circle me-1"></i> Crear sección</button>
                      </div>
                    </div>
                  </form>
                </div>

                <aside className="section-preview-card">
                  <span className="section-preview-label">Vista previa</span>
                  <div id="seccion-preview" className="section-name-preview section-name-preview-final"><strong>1-A</strong><small>Sección académica</small></div>
                  <div className="section-format-example">
                    <i className="bi bi-lightbulb"></i>
                    <span><strong>Ejemplo:</strong> grado 1 + sección A = <strong>1-A</strong><br/>grado 6 + sección B = <strong>6-B</strong>.</span>
                  </div>
                </aside>
              </div>
            </div>

            <div className="tab-pane fade" id="section-pane-manage" role="tabpanel" aria-labelledby="section-tab-manage" tabIndex="0">
              <div className="section-single-workspace section-delete-card">
                <div className="section-pane-heading">
                  <span className="section-panel-icon danger"><i className="bi bi-trash3"></i></span>
                  <div><h6>Secciones registradas</h6><p>Selecciona una sección para administrarla. Solo se puede eliminar si no está siendo utilizada.</p></div>
                </div>
                <div className="section-manage-row">
                  <div className="flex-grow-1"><label className="form-label">Sección</label><select id="seccion-delete-select" className="form-select"><option value="" disabled>Seleccionar sección</option></select></div>
                  <button type="button" id="btn-borrar-seccion" className="btn btn-outline-danger" disabled><i className="bi bi-trash me-1"></i> Eliminar sección</button>
                </div>
                <div className="section-safety-note"><i className="bi bi-shield-check"></i><span>Los grupos, matrículas y registros históricos asociados permanecen protegidos.</span></div>
              </div>
            </div>

            <div className="tab-pane fade" id="section-pane-period" role="tabpanel" aria-labelledby="section-tab-period" tabIndex="0">
              <div className="section-single-workspace section-period-card" id="periodo-lectivo-card">
                <div className="section-pane-heading">
                  <span className="section-panel-icon info"><i className="bi bi-calendar-range"></i></span>
                  <div><h6>Período lectivo</h6><p>Controla las fechas del ciclo. Al cerrarlo se bloquean matrículas, traslados, cambios de grupo y edición de asistencias.</p></div>
                </div>
                <div className="row g-3 align-items-end section-period-grid">
                  <div className="col-sm-6"><label className="form-label">Año lectivo</label><select id="periodo-admin-anio" className="form-select"></select></div>
                  <div className="col-sm-6"><label className="form-label">Estado</label><select id="periodo-admin-estado" className="form-select"><option value="PLANIFICADO">Planificado</option><option value="ACTIVO">Activo</option><option value="CERRADO">Cerrado</option></select></div>
                  <div className="col-sm-6"><label className="form-label"><i className="bi bi-calendar-event schedule-field-icon"></i>Inicio</label><input id="periodo-admin-inicio" type="date" className="form-control schedule-date-control" /></div>
                  <div className="col-sm-6"><label className="form-label"><i className="bi bi-calendar-check schedule-field-icon"></i>Fin</label><input id="periodo-admin-fin" type="date" className="form-control schedule-date-control" /></div>
                  <div className="col-12"><button type="button" id="btn-guardar-periodo" className="btn btn-primary w-100"><i className="bi bi-calendar-check me-1"></i> Guardar período lectivo</button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer section-admin-footer"><span className="section-footer-hint"><i className="bi bi-info-circle"></i> Los cambios se validan antes de guardarse.</span><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button></div>
      </Modal>

      <Modal id="modalConfirmarEliminacion" title={<><i className="bi bi-exclamation-triangle"></i> Confirmar eliminación</>}><div className="modal-body p-4"><p>Esta acción eliminará el grupo seleccionado. ¿Deseas continuar?</p></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="btn-confirmar-borrado-grupo" className="btn btn-danger destructive-confirm">Eliminar grupo</button></div></Modal>
      <Modal id="modalConfirmarEliminacionSeccion" title={<><i className="bi bi-exclamation-triangle"></i> Confirmar eliminación</>}><div className="modal-body p-4"><p>Esta acción eliminará la sección seleccionada. ¿Deseas continuar?</p></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" id="btn-confirmar-borrado-seccion" className="btn btn-danger destructive-confirm">Eliminar sección</button></div></Modal>
    </section>
  );
}
