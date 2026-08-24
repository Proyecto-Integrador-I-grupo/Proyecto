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
      <header className="finance-page-header">
        <div className="finance-page-header-main">
          <div className="finance-page-title-block">
            <p className="eyebrow mb-1">Administración financiera</p>
            <h2 className="card-title-serif mb-1">
              <i className="bi bi-cash-stack me-2"></i>Pagos y facturación
            </h2>
            <p className="finance-page-subtitle mb-0">
              Registra pagos y consulta comprobantes y movimientos desde un solo lugar.
            </p>
          </div>

          <div className="finance-toolbar-actions">
            <button id="fin-nuevo-cargo" type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalNuevoCargo">
              <i className="bi bi-plus-circle"></i> Nuevo cargo
            </button>
            <button id="fin-nueva-clase-extra" type="button" className="btn btn-external" data-bs-toggle="modal" data-bs-target="#modalClaseExtra">
              <i className="bi bi-calendar2-plus"></i> Hora extra
            </button>
            <button id="fin-configuracion" type="button" className="btn btn-outline-primary fin-admin-only" data-bs-toggle="modal" data-bs-target="#modalConfigFacturacion" title="Configuración de facturación">
              <i className="bi bi-gear"></i> Configuración
            </button>
            <button id="fin-refrescar" type="button" className="btn btn-outline-secondary" title="Actualizar información">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        <div className="finance-api-strip is-local" aria-live="polite">
          <span id="fin-api-page-dot" className="finance-api-dot online"></span>
          <div className="finance-api-copy">
            <small>Comprobantes EduControl</small>
            <strong id="fin-api-page-status">Facturación local activa</strong>
            <span id="fin-api-page-detail">Los pagos completos generan su PDF dentro del sistema, sin depender de servicios externos.</span>
          </div>
        </div>
      </header>

      <div className="finance-summary finance-summary-compact">
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
          <div><small>Cargos activos</small><strong id="fin-total-cargos">0</strong></div>
        </div>
      </div>

      <article className="finance-panel finance-payment-panel finance-primary-panel">
        <div className="finance-panel-header">
          <div className="finance-panel-title">
            <span className="finance-step">1</span>
            <div>
              <h3>Pendientes de pago</h3>
              <p>Abona o cancela el saldo. Al llegar a cero, el sistema genera la factura automáticamente.</p>
            </div>
          </div>
          <span id="fin-pendientes-resumen" className="finance-count-badge">0 pendientes</span>
        </div>
        <div id="fin-pendientes-body" className="finance-record-list"></div>
      </article>

      <div className="finance-tools-stack">
        <article className="finance-tool-card finance-tool-card-invoice">
          <div className="finance-card-heading">
            <div className="finance-tool-main">
              <span className="finance-tool-index">2</span>
              <div>
                <span className="finance-tool-eyebrow">Comprobantes</span>
                <h3><i className="bi bi-receipt-cutoff me-2"></i>Facturación</h3>
                <p>Todos los cargos pagados aparecen aquí. La factura se genera automáticamente al completar el pago y queda disponible para consultar su PDF.</p>
              </div>
            </div>
            <div className="finance-tool-heading-actions">
              <span id="fin-facturas-resumen" className="finance-count-badge invoice">0 facturados · 0 procesando</span>
              <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-facturacion-collapse" data-label-show="Abrir" data-label-hide="Cerrar" aria-expanded="false" aria-controls="fin-facturacion-collapse">
                <i className="bi bi-chevron-down me-1"></i> Abrir
              </button>
            </div>
          </div>
          <div className="collapse" id="fin-facturacion-collapse">
            <div className="finance-tool-body">
              <div className="finance-filter-row finance-invoice-filter-row mb-3">
                <div className="input-group input-group-sm finance-search">
                  <span className="input-group-text"><i className="bi bi-search"></i></span>
                  <input id="fin-facturas-busqueda" className="form-control" placeholder="Estudiante, concepto o número de factura" />
                </div>
                <select id="fin-facturas-filtro" className="form-select form-select-sm finance-state-filter" defaultValue="">
                  <option value="">Todos los comprobantes</option>
                  <option value="facturada">PDF disponible</option>
                  <option value="pendiente">Pendientes de generar</option>
                </select>
                <input id="fin-facturas-desde" type="date" className="form-control form-control-sm finance-date-filter" title="Desde" />
                <input id="fin-facturas-hasta" type="date" className="form-control form-control-sm finance-date-filter" title="Hasta" />
                <button id="fin-facturas-limpiar" type="button" className="btn btn-sm btn-outline-secondary"><i className="bi bi-eraser"></i> Limpiar</button>
              </div>
              <div id="fin-facturas-body" className="finance-record-list finance-invoice-list"></div>
            </div>
          </div>
        </article>

        <article className="finance-tool-card">
          <div className="finance-card-heading">
            <div className="finance-tool-main">
              <span className="finance-tool-index">3</span>
              <div>
                <span className="finance-tool-eyebrow">Administración</span>
                <h3><i className="bi bi-sliders me-2"></i>Cargos y descuentos</h3>
                <p>Busca cargos, modifica vencimientos, montos o aplica descuentos.</p>
              </div>
            </div>
            <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-cargos-collapse" data-label-show="Abrir" data-label-hide="Cerrar" aria-expanded="false" aria-controls="fin-cargos-collapse">
              <i className="bi bi-chevron-down me-1"></i> Abrir
            </button>
          </div>
          <div className="collapse" id="fin-cargos-collapse">
            <div className="finance-tool-body">
              <div className="finance-filter-row">
                <div className="input-group input-group-sm finance-search"><span className="input-group-text"><i className="bi bi-search"></i></span><input id="fin-busqueda" className="form-control" placeholder="Estudiante, concepto o descripción" /></div>
                <select id="fin-filtro-estado" className="form-select form-select-sm finance-state-filter"><option value="">Todos los estados</option><option value="pendiente">Pendientes</option><option value="parcial">Pagos parciales</option><option value="pagado">Pagados</option></select>
                <button id="fin-nuevo-concepto" type="button" className="btn btn-sm btn-outline-secondary fin-admin-only" data-bs-toggle="modal" data-bs-target="#modalConceptoCobro"><i className="bi bi-tags"></i> Conceptos</button>
              </div>
              <div className="finance-local-scroll"><table className="table align-middle table-hover mb-0 finance-table"><thead><tr><th>Estudiante</th><th>Concepto</th><th>Periodo</th><th>Total</th><th>Saldo</th><th>Estado</th><th>Factura</th><th className="text-end">Acción</th></tr></thead><tbody id="fin-cargos-body"></tbody></table></div>
            </div>
          </div>
        </article>

        <article className="finance-tool-card">
          <div className="finance-card-heading">
            <div className="finance-tool-main">
              <span className="finance-tool-index">4</span>
              <div>
                <span className="finance-tool-eyebrow">Servicios</span>
                <h3><i className="bi bi-calendar2-week me-2"></i>Clases extra</h3>
                <p>Consulta las clases adicionales programadas y el cargo relacionado.</p>
              </div>
            </div>
            <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-clases-extra-collapse" data-label-show="Abrir" data-label-hide="Cerrar" aria-expanded="false" aria-controls="fin-clases-extra-collapse">
              <i className="bi bi-chevron-down me-1"></i> Abrir
            </button>
          </div>
          <div className="collapse" id="fin-clases-extra-collapse">
            <div className="finance-tool-body"><div className="finance-local-scroll"><table className="table table-sm align-middle mb-0"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Profesor</th><th>Materia</th><th>Horario</th><th>Cargo</th></tr></thead><tbody id="fin-clases-extra-body"></tbody></table></div></div>
          </div>
        </article>

        <article className="finance-tool-card finance-tool-card-history">
          <div className="finance-card-heading">
            <div className="finance-tool-main">
              <span className="finance-tool-index">5</span>
              <div>
                <span className="finance-tool-eyebrow">Consulta</span>
                <h3><i className="bi bi-clock-history me-2"></i>Historial de pagos</h3>
                <p>Abonos y pagos completos, ordenados del más reciente al más antiguo.</p>
              </div>
            </div>
            <div className="finance-tool-heading-actions">
              <span id="fin-historial-resumen" className="finance-count-badge">0 pagos</span>
              <button className="btn btn-sm btn-outline-secondary finance-section-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#fin-historial-collapse" data-label-show="Abrir" data-label-hide="Cerrar" aria-expanded="false" aria-controls="fin-historial-collapse">
                <i className="bi bi-chevron-down me-1"></i> Abrir
              </button>
            </div>
          </div>
          <div className="collapse" id="fin-historial-collapse">
            <div className="finance-tool-body">
              <div className="finance-filter-row mb-3">
                <div className="input-group input-group-sm finance-search"><span className="input-group-text"><i className="bi bi-search"></i></span><input id="fin-pagos-busqueda" className="form-control" maxLength="120" placeholder="Estudiante, concepto o referencia" /></div>
                <select id="fin-pagos-metodo" className="form-select form-select-sm finance-state-filter"><option value="">Todos los métodos</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select>
                <input id="fin-pagos-desde" type="date" className="form-control form-control-sm finance-date-filter" title="Desde" />
                <input id="fin-pagos-hasta" type="date" className="form-control form-control-sm finance-date-filter" title="Hasta" />
                <button id="fin-pagos-limpiar" type="button" className="btn btn-sm btn-outline-secondary"><i className="bi bi-eraser"></i> Limpiar</button>
              </div>
              <div id="fin-pagos-body" className="finance-history-list"></div>
            </div>
          </div>
        </article>
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
                <label className="form-label">Profesor</label>
                <div className="input-group mb-2">
                  <span className="input-group-text"><i className="bi bi-search"></i></span>
                  <input id="fin-extra-profesor-search" className="form-control" placeholder="Filtrar por profesor o materia" autoComplete="off" />
                </div>
                <select id="fin-extra-profesor" className="form-select" required>
                  <option value="">Seleccionar profesor</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Estudiante</label>
                <select id="fin-extra-estudiante" className="form-select" required disabled>
                  <option value="">Selecciona un profesor primero</option>
                </select>
                <div className="form-text">Solo se muestran estudiantes de los grupos asignados al profesor.</div>
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
              <div className="col-md-6"><label className="form-label">Nombre completo</label><input id="fin-resp-nombre" className="form-control" maxLength="100" required /></div>
              <div className="col-md-3"><label className="form-label">Parentesco</label><input id="fin-resp-parentesco" className="form-control" maxLength="40" placeholder="Madre, padre..." /></div>
              <div className="col-md-3"><label className="form-label">Teléfono</label><input id="fin-resp-telefono" className="form-control" maxLength="25" /></div>
              <div className="col-md-5"><label className="form-label">Correo</label><input id="fin-resp-correo" type="email" className="form-control" maxLength="150" required /></div>
              <div className="col-md-3"><label className="form-label">Tipo ID</label><select id="fin-resp-tipo-id" className="form-select"><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></div>
              <div className="col-md-4"><label className="form-label">Identificación</label><input id="fin-resp-numero-id" className="form-control" maxLength="30" /></div>
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
            <div className="col-md-6"><label className="form-label">Código</label><input id="fin-concepto-codigo" className="form-control" maxLength="50" required placeholder="Ej. UNIFORME" /></div>
            <div className="col-md-6"><label className="form-label">Tipo</label><select id="fin-concepto-tipo" className="form-select"><option value="servicio">Servicio</option><option value="matricula">Matrícula</option><option value="mensualidad">Mensualidad</option><option value="otro">Otro</option></select></div>
            <div className="col-12"><label className="form-label">Nombre</label><input id="fin-concepto-nombre" className="form-control" maxLength="100" required /></div>
            <div className="col-md-6"><label className="form-label">Monto base</label><input id="fin-concepto-monto" type="number" min="0" step="0.01" className="form-control" required /></div>
            <div className="col-md-6"><label className="form-label">Impuesto %</label><input id="fin-concepto-impuesto" type="number" min="0" max="100" step="0.01" className="form-control" defaultValue="0" /></div>
            <div className="col-12"><label className="form-label">Descripción</label><textarea id="fin-concepto-descripcion" className="form-control" rows="2" maxLength="250"></textarea></div><div className="col-12"><div className="form-check form-switch"><input id="fin-concepto-estado" className="form-check-input" type="checkbox" defaultChecked /><label className="form-check-label" htmlFor="fin-concepto-estado">Concepto activo</label></div></div>
          </div></div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar concepto</button></div>
        </form>
      </Modal>

      <Modal id="modalConfigFacturacion" title={<><i className="bi bi-building-gear"></i> Configuración de facturación</>} lg>
        <form id="fin-config-form">
          <div className="modal-body billing-config-modal">
            <div className="billing-config-intro">
              <div className="billing-config-intro-icon"><i className="bi bi-receipt-cutoff"></i></div>
              <div>
                <span>Comprobantes EduControl</span>
                <strong>Configura los datos del emisor y el comprobante</strong>
                <p>Estos datos se aplican directamente a las facturas generadas por EduControl.</p>
              </div>
              <button id="fin-integracion-probar" type="button" className="btn btn-outline-primary">
                <i className="bi bi-check2-circle"></i> Verificar módulo
              </button>
            </div>

            <div className="billing-service-overview">
              <div className="billing-service-card primary-service">
                <span className="billing-service-icon"><i className="bi bi-cloud-check"></i></span>
                <div className="billing-service-copy">
                  <small>Servicio principal</small>
                  <strong>Comprobantes EduControl</strong>
                  <span id="fin-service-factura-detail">Comprobando conexión…</span>
                </div>
                <span id="fin-service-factura-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
              </div>

              <div className="billing-service-card">
                <span className="billing-service-icon"><i className="bi bi-file-earmark-pdf"></i></span>
                <div className="billing-service-copy">
                  <small>Documento</small>
                  <strong>PDF de solo lectura</strong>
                  <span id="fin-service-documentos-detail">Comprobante PDF generado por Comprobantes EduControl.</span>
                </div>
                <span id="fin-service-documentos-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
              </div>
            </div>

            <section className="billing-emitter-card">
              <div className="billing-emitter-heading">
                <span><i className="bi bi-building"></i></span>
                <div>
                  <strong>Datos del emisor</strong>
                  <small>Esta información se utiliza para identificar a la institución en cada comprobante generado.</small>
                </div>
              </div>

              <div className="billing-emitter-grid">
                <div className="billing-field billing-field-wide">
                  <label className="form-label">Nombre de la institución</label>
                  <input id="fin-config-nombre" className="form-control" maxLength="100" required placeholder="Colegio EduControl" autoComplete="organization" />
                </div>
                <div className="billing-field">
                  <label className="form-label">Tipo de identificación</label>
                  <select id="fin-config-tipo-id" className="form-select">
                    <option value="02">Jurídica</option>
                    <option value="01">Física</option>
                    <option value="03">DIMEX</option>
                    <option value="04">NITE</option>
                  </select>
                </div>
                <div className="billing-field">
                  <label className="form-label">Identificación</label>
                  <input id="fin-config-numero-id" className="form-control" maxLength="30" required placeholder="3-101-123456" autoComplete="off" />
                </div>
                <div className="billing-field billing-field-wide">
                  <label className="form-label">Correo de facturación</label>
                  <input id="fin-config-correo" type="email" className="form-control" maxLength="150" required placeholder="facturacion@educontrol.com" autoComplete="off" />
                </div>

                <div className="billing-field billing-field-wide">
                  <label className="form-label">Logo para la factura</label>
                  <div className="billing-logo-picker">
                    <div className="billing-logo-preview">
                      <img id="fin-config-logo-preview" className="hidden" alt="Vista previa del logo" />
                      <span id="fin-config-logo-empty"><i className="bi bi-image"></i> Sin logo</span>
                    </div>
                    <div className="billing-logo-actions">
                      <input id="fin-config-logo" type="file" className="form-control" accept="image/png,image/jpeg,image/webp" />
                      <small>PNG, JPG o WEBP, máximo 500 KB. Se incluirá automáticamente en las nuevas facturas.</small>
                      <button id="fin-config-logo-remove" type="button" className="btn btn-sm btn-outline-danger hidden">
                        <i className="bi bi-trash"></i> Quitar logo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>



            <div className="billing-config-note">
              <i className="bi bi-shield-check"></i>
              <span>Los comprobantes se generan directamente en EduControl y quedan disponibles para consulta e impresión desde este módulo.</span>
            </div>
          </div>
          <div className="modal-footer billing-config-footer">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="submit" className="btn btn-primary"><i className="bi bi-check2-circle"></i> Guardar configuración</button>
          </div>
        </form>
      </Modal>

      <div className="modal fade finance-invoice-preview-modal" id="modalFacturaVisual" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content border-0">
            <div className="modal-header bg-navy text-white finance-invoice-preview-header">
              <div>
                <small className="d-block text-white-50 text-uppercase">EduControl</small>
                <h5 className="modal-title mb-0" id="fin-factura-preview-title">Factura en PDF</h5>
              </div>
              <div className="finance-invoice-preview-actions">
                <button id="fin-factura-preview-pdf" type="button" className="btn btn-sm btn-light">
                  <i className="bi bi-file-earmark-pdf"></i> PDF
                </button>
                <button id="fin-factura-preview-print" type="button" className="btn btn-sm btn-outline-light">
                  <i className="bi bi-printer"></i> Imprimir
                </button>
                <button type="button" className="btn-close btn-close-white ms-1" data-bs-dismiss="modal" aria-label="Cerrar"></button>
              </div>
            </div>
            <div className="modal-body p-0 finance-invoice-preview-body">
              <div id="fin-factura-preview-loading" className="finance-invoice-preview-loading hidden">
                <div className="spinner-border text-primary" role="status"></div>
                <strong>Preparando comprobante…</strong>
                <span>EduControl está generando el PDF de solo lectura.</span>
              </div>
              <object id="fin-factura-preview-frame" type="application/pdf" aria-label="Factura EduControl" className="finance-invoice-preview-frame"></object>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
