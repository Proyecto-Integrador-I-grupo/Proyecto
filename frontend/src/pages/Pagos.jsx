import React from 'react';

const Modal = ({ id, title, children, lg = false }) => (
  <div className="modal fade" id={id} tabIndex="-1" aria-hidden="true">
    <div className={`modal-dialog modal-dialog-centered ${lg ? 'modal-lg' : ''}`}>
      <div className="modal-content border-0 shadow-lg">
        <div className="modal-header bg-navy text-white">
          <h5 className="modal-title font-serif">{title}</h5>
          <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        {children}
      </div>
    </div>
  </div>
);

export default function Pagos() {
  return (
    <section id="pagos-view" className="view hidden pagos-shell">
      <div className="page-header d-flex justify-content-between align-items-start gap-3 mb-4 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Administración financiera</p>
          <h2 className="card-title-serif h4 mb-1">
            <i className="bi bi-cash-coin me-2"></i>Pagos y facturación
          </h2>
          <p className="text-muted small mb-0">
            Controla cargos, pagos, responsables de pago y facturas de los servicios educativos. La facturación se envía al servicio externo configurado en el backend.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button id="fin-refrescar" type="button" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-clockwise"></i> Refrescar
          </button>
          <button id="fin-nuevo-cargo" type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalNuevoCargo">
            <i className="bi bi-plus-circle"></i> Nuevo cargo
          </button>
          <button id="fin-nueva-clase-extra" type="button" className="btn btn-outline-success" data-bs-toggle="modal" data-bs-target="#modalClaseExtra">
            <i className="bi bi-calendar2-plus"></i> Hora extra
          </button>
          <button id="fin-configuracion" type="button" className="btn btn-outline-primary fin-admin-only" data-bs-toggle="modal" data-bs-target="#modalConfigFacturacion">
            <i className="bi bi-gear"></i> Configuración
          </button>
        </div>
      </div>

      <div className="finance-summary mb-4">
        <div className="finance-summary-card">
          <span className="finance-summary-icon"><i className="bi bi-wallet2"></i></span>
          <div><small>Cobrado</small><strong id="fin-total-cobrado">CRC 0</strong></div>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-icon warning"><i className="bi bi-hourglass-split"></i></span>
          <div><small>Pendiente</small><strong id="fin-total-pendiente">CRC 0</strong></div>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-icon danger"><i className="bi bi-exclamation-circle"></i></span>
          <div><small>Vencidos</small><strong id="fin-total-vencidos">0</strong></div>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-icon info"><i className="bi bi-receipt"></i></span>
          <div><small>Cargos</small><strong id="fin-total-cargos">0</strong></div>
        </div>
      </div>


      <div className="card border-0 shadow-sm mb-4 finance-account-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
            <div>
              <h3 className="h6 mb-1"><i className="bi bi-wallet2 me-2"></i>Saldos pendientes</h3>
              <p className="small text-muted mb-0">Aquí aparecen únicamente los estudiantes que todavía tienen un saldo por cancelar. <span id="fin-morosos-resumen" className="finance-overdue-summary"></span></p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 finance-account-table">
              <thead><tr><th>Estudiante</th><th>Estado</th><th>Abonado</th><th>Saldo pendiente</th></tr></thead>
              <tbody id="fin-estado-cuentas-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
            <div className="d-flex gap-2 flex-wrap flex-grow-1">
              <div className="input-group input-group-sm finance-search">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input id="fin-busqueda" className="form-control" placeholder="Estudiante, concepto o descripción..." />
              </div>
              <select id="fin-filtro-estado" className="form-select form-select-sm finance-state-filter">
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="parcial">Pagos parciales</option>
                <option value="pagado">Pagados</option>
              </select>
            </div>
            <button id="fin-nuevo-concepto" type="button" className="btn btn-sm btn-outline-secondary fin-admin-only" data-bs-toggle="modal" data-bs-target="#modalConceptoCobro">
              <i className="bi bi-tags"></i> Gestionar conceptos
            </button>
          </div>

          <div className="table-responsive">
            <table className="table align-middle table-hover mb-0 finance-table">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Concepto</th>
                  <th>Periodo</th>
                  <th>Total</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Factura</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody id="fin-cargos-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4 finance-extra-card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <h3 className="h6 mb-1"><i className="bi bi-calendar2-week me-2"></i>Clases extra programadas</h3>
              <p className="small text-muted mb-0">Cada clase extra genera su cargo en Pagos. Solo se permite programarla en un día disponible para el profesor.</p>
            </div>
            <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-clases-extra-collapse" aria-expanded="false" aria-controls="fin-clases-extra-collapse">
              <i className="bi bi-chevron-down me-1"></i> Mostrar clases extra
            </button>
          </div>
          <div className="collapse mt-3" id="fin-clases-extra-collapse">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Fecha</th><th>Estudiante</th><th>Profesor</th><th>Materia</th><th>Horario</th><th>Cargo</th></tr></thead>
                <tbody id="fin-clases-extra-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div>
              <h3 className="h6 mb-1"><i className="bi bi-clock-history me-2"></i>Historial de pagos</h3>
              <p className="small text-muted mb-0">Últimos pagos registrados en el sistema.</p>
            </div>
            <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-historial-collapse" aria-expanded="false" aria-controls="fin-historial-collapse">
              <i className="bi bi-chevron-down me-1"></i> Mostrar historial
            </button>
          </div>
          <div className="collapse mt-3" id="fin-historial-collapse">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead><tr><th>Fecha</th><th>Estudiante</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Factura</th><th className="text-end">Acción</th></tr></thead>
                <tbody id="fin-pagos-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal id="modalClaseExtra" title={<><i className="bi bi-calendar2-plus"></i> Programar hora extra</>} lg>
        <form id="fin-clase-extra-form" noValidate>
          <div className="modal-body p-4">
            <div className="finance-note mb-3">
              <i className="bi bi-info-circle"></i>
              <span>Selecciona una fecha en la que el profesor no tenga una asignación regular ni otra clase extra programada.</span>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Estudiante</label>
                <select id="fin-extra-estudiante" className="form-select" required disabled>
                  <option value="">Selecciona un profesor primero</option>
                </select>
                <div className="form-text">La lista muestra únicamente estudiantes de los grupos asignados al profesor seleccionado.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Profesor</label>
                <select id="fin-extra-profesor" className="form-select" required>
                  <option value="">Seleccionar profesor</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Fecha</label>
                <input id="fin-extra-fecha" type="date" className="form-control" required />
              </div>
              <div className="col-md-4">
                <label className="form-label">Inicio</label>
                <input id="fin-extra-inicio" type="time" className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Fin</label>
                <input id="fin-extra-fin" type="time" className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Monto</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-cash-coin"></i></span>
                  <input id="fin-extra-monto" type="number" min="1" step="0.01" className="form-control" defaultValue="10000" required />
                </div>
              </div>
              <div className="col-md-8">
                <label className="form-label">Observaciones</label>
                <input id="fin-extra-observaciones" className="form-control" maxLength="250" placeholder="Tema, refuerzo o detalle de la clase" />
              </div>
              <div className="col-12">
                <div id="fin-extra-disponibilidad" className="extra-availability neutral">
                  Selecciona profesor y fecha para comprobar disponibilidad.
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button id="fin-extra-guardar" type="submit" className="btn btn-success">
              <i className="bi bi-calendar-check"></i> Programar y generar cargo
            </button>
          </div>
        </form>
      </Modal>

      <Modal id="modalNuevoCargo" title={<><i className="bi bi-plus-circle"></i> Registrar cargo</>} lg>
        <form id="fin-cargo-form">
          <div className="modal-body p-4">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Estudiante</label>
                <select id="fin-cargo-estudiante" className="form-select" required><option value="">Seleccionar estudiante</option></select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Concepto</label>
                <select id="fin-cargo-concepto" className="form-select" required><option value="">Seleccionar concepto</option></select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Monto base</label>
                <div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-cargo-monto" type="number" min="0" step="0.01" className="form-control" required /></div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Descuento</label>
                <div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-cargo-descuento" type="number" min="0" step="0.01" className="form-control" defaultValue="0" /></div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Vencimiento</label>
                <input id="fin-cargo-vencimiento" type="date" className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Periodo</label>
                <input id="fin-cargo-periodo" className="form-control" placeholder="Ej. Agosto 2026" maxLength="30" />
              </div>
              <div className="col-md-8">
                <label className="form-label">Descripción</label>
                <input id="fin-cargo-descripcion" className="form-control" maxLength="200" placeholder="Detalle del servicio educativo" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" className="btn btn-primary">Crear cargo</button>
          </div>
        </form>
      </Modal>

      <Modal id="modalEditarCargo" title={<><i className="bi bi-pencil-square"></i> Modificar cargo</>} lg>
        <form id="fin-editar-cargo-form">
          <div className="modal-body p-4">
            <input id="fin-edit-cargo-id" type="hidden" />
            <div id="fin-edit-cargo-contexto" className="finance-payment-context mb-3"></div>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">Monto base</label><div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-edit-cargo-monto" type="number" min="0" step="0.01" className="form-control" required /></div></div>
              <div className="col-md-4"><label className="form-label">Descuento</label><div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-edit-cargo-descuento" type="number" min="0" step="0.01" className="form-control" required /></div></div>
              <div className="col-md-4"><label className="form-label">Vencimiento</label><input id="fin-edit-cargo-vencimiento" type="date" className="form-control" /></div>
              <div className="col-md-4"><label className="form-label">Periodo</label><input id="fin-edit-cargo-periodo" className="form-control" maxLength="30" /></div>
              <div className="col-md-8"><label className="form-label">Descripción</label><input id="fin-edit-cargo-descripcion" className="form-control" maxLength="200" required /></div>
              <div className="col-12"><div className="alert alert-light border small mb-0">El sistema no permite bajar el total por debajo de lo que ya fue pagado.</div></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar cambios</button></div>
        </form>
      </Modal>

      <Modal id="modalRegistrarPago" title={<><i className="bi bi-cash-stack"></i> Registrar pago</>} lg>
        <form id="fin-pago-form">
          <div className="modal-body p-4">
            <input id="fin-pago-cargo-id" type="hidden" />
            <div className="finance-payment-context mb-3" id="fin-pago-contexto"></div>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">Monto</label><div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-pago-monto" type="number" min="0.01" step="0.01" className="form-control" required /></div></div>
              <div className="col-md-4"><label className="form-label">Método</label><select id="fin-pago-metodo" className="form-select" required><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
              <div className="col-md-4"><label className="form-label">Referencia</label><input id="fin-pago-referencia" className="form-control" maxLength="100" /></div>
            </div>
            <hr className="my-4" />
            <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Responsable de facturación</h6><small className="text-muted">Se guarda para próximos pagos</small></div>
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">Nombre completo</label><input id="fin-resp-nombre" className="form-control" required /></div>
              <div className="col-md-3"><label className="form-label">Parentesco</label><input id="fin-resp-parentesco" className="form-control" placeholder="Madre, padre..." /></div>
              <div className="col-md-3"><label className="form-label">Teléfono</label><input id="fin-resp-telefono" className="form-control" /></div>
              <div className="col-md-5"><label className="form-label">Correo</label><input id="fin-resp-correo" type="email" className="form-control" required /></div>
              <div className="col-md-3"><label className="form-label">Tipo ID</label><select id="fin-resp-tipo-id" className="form-select"><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></div>
              <div className="col-md-4"><label className="form-label">Identificación</label><input id="fin-resp-numero-id" className="form-control" /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-success"><i className="bi bi-check-circle"></i> Aplicar pago</button></div>
        </form>
      </Modal>

      <Modal id="modalEditarPago" title={<><i className="bi bi-pencil"></i> Modificar datos del pago</>}>
        <form id="fin-editar-pago-form">
          <div className="modal-body p-4">
            <input id="fin-edit-pago-id" type="hidden" />
            <div id="fin-edit-pago-contexto" className="finance-payment-context mb-3"></div>
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">Método</label><select id="fin-edit-pago-metodo" className="form-select" required><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
              <div className="col-md-6"><label className="form-label">Referencia</label><input id="fin-edit-pago-referencia" className="form-control" maxLength="100" /></div>
            </div>
            <div className="form-text mt-3">Por integridad contable, el monto no se modifica desde aquí. Los pagos con factura externa generada quedan bloqueados.</div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar cambios</button></div>
        </form>
      </Modal>

      <Modal id="modalConceptoCobro" title={<><i className="bi bi-tags"></i> Gestionar conceptos de cobro</>}>
        <form id="fin-concepto-form">
          <div className="modal-body p-4"><div className="row g-3">
            <input id="fin-concepto-id" type="hidden" />
            <div className="col-12"><label className="form-label">Crear nuevo o editar existente</label><select id="fin-concepto-existente" className="form-select"><option value="">Nuevo concepto</option></select><div className="form-text">Selecciona un concepto para modificar su monto, nombre, descripción o estado.</div></div>
            <div className="col-md-6"><label className="form-label">Código</label><input id="fin-concepto-codigo" className="form-control" required placeholder="Ej. UNIFORME" /></div>
            <div className="col-md-6"><label className="form-label">Tipo</label><select id="fin-concepto-tipo" className="form-select"><option value="servicio">Servicio</option><option value="matricula">Matrícula</option><option value="mensualidad">Mensualidad</option><option value="otro">Otro</option></select></div>
            <div className="col-12"><label className="form-label">Nombre</label><input id="fin-concepto-nombre" className="form-control" required /></div>
            <div className="col-md-6"><label className="form-label">Monto base</label><input id="fin-concepto-monto" type="number" min="0" step="0.01" className="form-control" required /></div>
            <div className="col-md-6"><label className="form-label">Impuesto %</label><input id="fin-concepto-impuesto" type="number" min="0" max="100" step="0.01" className="form-control" defaultValue="0" /></div>
            <div className="col-12"><label className="form-label">Descripción</label><textarea id="fin-concepto-descripcion" className="form-control" rows="2" maxLength="250"></textarea></div><div className="col-12"><div className="form-check form-switch"><input id="fin-concepto-estado" className="form-check-input" type="checkbox" defaultChecked /><label className="form-check-label" htmlFor="fin-concepto-estado">Concepto activo</label></div></div>
          </div></div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar concepto</button></div>
        </form>
      </Modal>

      <Modal id="modalConfigFacturacion" title={<><i className="bi bi-building-gear"></i> Configuración de facturación</>} lg>
        <form id="fin-config-form">
          <div className="modal-body p-4">
            <div className="alert alert-light border small">Estos datos se envían como emisor cuando EduControl consume la API externa de facturación.</div>
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">Nombre de la institución</label><input id="fin-config-nombre" className="form-control" required /></div>
              <div className="col-md-2"><label className="form-label">Tipo ID</label><select id="fin-config-tipo-id" className="form-select"><option value="02">Jurídica</option><option value="01">Física</option><option value="03">DIMEX</option><option value="04">NITE</option></select></div>
              <div className="col-md-4"><label className="form-label">Identificación</label><input id="fin-config-numero-id" className="form-control" required /></div>
              <div className="col-md-6"><label className="form-label">Correo de facturación</label><input id="fin-config-correo" type="email" className="form-control" required /></div>
              <div className="col-md-6"><label className="form-label">Servicio de facturación</label><input className="form-control" value="FACTURACION_API_URL" readOnly /></div><div className="col-12"><div className="integration-slots"><span>PDF/Documentos: <code>DOCUMENTOS_API_URL</code></span><span>XML: <code>XML_API_URL</code></span><span>Firma: <code>FIRMA_API_URL</code></span><span>Tributación: <code>TRIBUTACION_API_URL</code></span></div><div className="form-text">Estos endpoints quedan en el backend. Cuando los demás equipos publiquen sus servicios, solo se configuran las URLs en Render.</div></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar configuración</button></div>
        </form>
      </Modal>
    </section>
  );
}
