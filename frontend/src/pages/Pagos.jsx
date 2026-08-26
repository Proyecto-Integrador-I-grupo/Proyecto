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
                <select id="fin-pagos-metodo" className="form-select form-select-sm finance-state-filter"><option value="">Todos los métodos</option><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta / servicio bancario</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option><option value="exoneracion">Exoneración 100%</option></select>
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
              <div className="col-md-4 finance-discount-field">
                <label className="form-label">Descuento</label>
                <div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-cargo-descuento" type="number" min="0" step="0.01" className="form-control" defaultValue="0" /></div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Vencimiento</label>
                <input id="fin-cargo-vencimiento" type="date" className="form-control" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Plazo de pago</label>
                <select id="fin-cargo-plazo" className="form-select" defaultValue="0"><option value="0">Usar fecha indicada</option><option value="15">15 días</option><option value="30">30 días</option><option value="45">45 días</option><option value="60">60 días</option><option value="90">90 días</option></select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Periodo</label>
                <input id="fin-cargo-periodo" className="form-control" placeholder="Ej. Agosto 2026" maxLength="30" />
              </div>
              <div className="col-md-8">
                <label className="form-label">Descripción</label>
                <input id="fin-cargo-descripcion" className="form-control" maxLength="200" placeholder="Detalle del servicio educativo" />
              </div>

              <div id="fin-cargo-exoneracion-responsable" className="col-12 hidden">
                <div className="finance-exemption-box finance-exemption-compact">
                  <div className="finance-exemption-heading finance-exemption-heading-compact">
                    <span className="finance-exemption-icon"><i className="bi bi-person-vcard"></i></span>
                    <div><strong>Responsable de la exoneración</strong><small>Completa los datos para emitir el comprobante final.</small></div>
                    <span className="finance-exemption-zero"><i className="bi bi-receipt"></i> Total CRC 0</span>
                  </div>
                  <div className="row g-2 finance-exemption-grid">
                    <div className="col-md-6"><label className="form-label">Nombre completo <span className="finance-required-mark">*</span></label><input id="fin-cargo-resp-nombre" className="form-control" maxLength="100" /></div>
                    <div className="col-md-3"><label className="form-label">Parentesco <span className="finance-optional-tag">Opcional</span></label><input id="fin-cargo-resp-parentesco" className="form-control" maxLength="40" placeholder="Madre, padre..." /></div>
                    <div className="col-md-3"><label className="form-label">Teléfono <span className="finance-optional-tag">Opcional</span></label><input id="fin-cargo-resp-telefono" className="form-control" maxLength="25" /></div>
                    <div className="col-md-5"><label className="form-label">Correo <span className="finance-required-mark">*</span></label><input id="fin-cargo-resp-correo" type="email" className="form-control" maxLength="150" /></div>
                    <div className="col-md-3"><label className="form-label">Tipo ID</label><select id="fin-cargo-resp-tipo-id" className="form-select" defaultValue="01"><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></div>
                    <div className="col-md-4"><label className="form-label">Identificación <span className="finance-required-mark">*</span></label><input id="fin-cargo-resp-numero-id" className="form-control" maxLength="30" /></div>
                  </div>
                </div>
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
              <div className="col-md-4 finance-discount-field"><label className="form-label">Descuento</label><div className="input-group"><span className="input-group-text" title="Monto en colones"><i className="bi bi-cash-coin"></i></span><input id="fin-edit-cargo-descuento" type="number" min="0" step="0.01" className="form-control" required /></div><div className="form-text">Puede cubrir hasta el 100% del monto base.</div></div>
              <div className="col-md-4"><label className="form-label">Vencimiento</label><input id="fin-edit-cargo-vencimiento" type="date" className="form-control" /></div><div className="col-md-4"><label className="form-label">Extender plazo</label><select id="fin-edit-cargo-extension" className="form-select" defaultValue="0"><option value="0">Sin extensión</option><option value="7">+ 7 días</option><option value="15">+ 15 días</option><option value="30">+ 30 días</option><option value="60">+ 60 días</option><option value="90">+ 90 días</option></select></div><div className="col-md-8"><label className="form-label">Motivo de extensión <span className="text-muted fw-normal">(opcional)</span></label><input id="fin-edit-cargo-motivo-extension" className="form-control" maxLength="250" placeholder="Ej.: acuerdo de pago con responsable" /></div>
              <div className="col-md-4"><label className="form-label">Periodo</label><input id="fin-edit-cargo-periodo" className="form-control" maxLength="30" /></div>
              <div className="col-md-8"><label className="form-label">Descripción <span className="text-muted fw-normal">(opcional)</span></label><input id="fin-edit-cargo-descripcion" className="form-control" maxLength="200" /></div>

              <div id="fin-edit-exoneracion-responsable" className="col-12 hidden">
                <div className="finance-exemption-box finance-exemption-compact">
                  <div className="finance-exemption-heading finance-exemption-heading-compact">
                    <span className="finance-exemption-icon"><i className="bi bi-person-vcard"></i></span>
                    <div><strong>Responsable de la exoneración</strong><small>El descuento cubre el 100%. Completa los datos para emitir la factura final.</small></div>
                    <span className="finance-exemption-zero"><i className="bi bi-receipt"></i> Total CRC 0</span>
                  </div>
                  <div className="row g-2 finance-exemption-grid">
                    <div className="col-md-6"><label className="form-label">Nombre completo <span className="finance-required-mark">*</span></label><input id="fin-edit-resp-nombre" className="form-control" maxLength="100" /></div>
                    <div className="col-md-3"><label className="form-label">Parentesco <span className="finance-optional-tag">Opcional</span></label><input id="fin-edit-resp-parentesco" className="form-control" maxLength="40" placeholder="Madre, padre..." /></div>
                    <div className="col-md-3"><label className="form-label">Teléfono <span className="finance-optional-tag">Opcional</span></label><input id="fin-edit-resp-telefono" className="form-control" maxLength="25" /></div>
                    <div className="col-md-5"><label className="form-label">Correo <span className="finance-required-mark">*</span></label><input id="fin-edit-resp-correo" type="email" className="form-control" maxLength="150" /></div>
                    <div className="col-md-3"><label className="form-label">Tipo ID</label><select id="fin-edit-resp-tipo-id" className="form-select" defaultValue="01"><option value="01">Física</option><option value="02">Jurídica</option><option value="03">DIMEX</option><option value="04">NITE</option></select></div>
                    <div className="col-md-4"><label className="form-label">Identificación <span className="finance-required-mark">*</span></label><input id="fin-edit-resp-numero-id" className="form-control" maxLength="30" /></div>
                  </div>
                </div>
              </div>
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
              <div className="col-md-4"><label className="form-label">Método</label><select id="fin-pago-metodo" className="form-select" required><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta / servicio bancario</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
              <div className="col-md-4"><label className="form-label">Referencia</label><input id="fin-pago-referencia" className="form-control" maxLength="100" /></div>
              <div id="fin-pago-banco-ayuda" className="col-12 hidden"><div className="finance-bank-payment-note"><i className="bi bi-shield-check"></i><span>Al elegir tarjeta, EduControl abrirá el servicio bancario afiliado. El pago solo se registrará después de recibir una confirmación válida del banco.</span></div></div>
              <div className="col-12">
                <div className="finance-term-box">
                  <div className="form-check form-switch mb-0">
                    <input id="fin-pago-plazo-habilitado" className="form-check-input" type="checkbox" role="switch" />
                    <label className="form-check-label fw-semibold" htmlFor="fin-pago-plazo-habilitado">Habilitar o extender plazo de pago</label>
                  </div>
                  <small className="text-muted">Úsalo cuando exista un acuerdo de pago. Un abono parcial mantiene el cargo pendiente y no genera factura.</small>
                  <div id="fin-pago-plazo-campos" className="row g-2 mt-1 hidden">
                    <div className="col-md-4"><label className="form-label">Nueva fecha</label><input id="fin-pago-plazo-fecha" type="date" className="form-control" /></div>
                    <div className="col-md-3"><label className="form-label">O extender</label><select id="fin-pago-plazo-dias" className="form-select" defaultValue="0"><option value="0">Sin extensión</option><option value="7">+ 7 días</option><option value="15">+ 15 días</option><option value="30">+ 30 días</option><option value="60">+ 60 días</option><option value="90">+ 90 días</option></select></div>
                    <div className="col-md-5"><label className="form-label">Motivo</label><input id="fin-pago-plazo-motivo" className="form-control" maxLength="250" placeholder="Ej.: acuerdo con responsable" /></div>
                  </div>
                </div>
              </div>
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
              <div className="col-md-6"><label className="form-label">Método</label><select id="fin-edit-pago-metodo" className="form-select" required><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta / servicio bancario</option><option value="sinpe">SINPE</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
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

      <Modal id="modalConfigFacturacion" title={<><i className="bi bi-diagram-3"></i> Servicios de facturación</>} lg>
        <form id="fin-config-form">
          <div className="modal-body billing-config-modal integration-config-modal integration-config-v3">
            <div className="integration-head-v3">
              <div className="integration-head-copy-v3">
                <span className="integration-head-icon-v3"><i className="bi bi-plug"></i></span>
                <div>
                  <span className="eyebrow">INTEGRACIONES</span>
                  <strong>Conexiones externas de EduControl</strong>
                  <small>Configura únicamente los servicios que participan en pagos y facturación.</small>
                </div>
              </div>
              <button id="fin-integracion-probar" type="button" className="btn btn-outline-primary integration-verify-v3">
                <i className="bi bi-arrow-repeat"></i> Verificar
              </button>
            </div>

            <div className="integration-tabs-v3 nav nav-pills" role="tablist">
              <button className="nav-link active" id="fin-tab-activos" data-bs-toggle="pill" data-bs-target="#fin-panel-activos" type="button" role="tab" aria-controls="fin-panel-activos" aria-selected="true">
                <i className="bi bi-check2-circle"></i><span>Servicios activos</span>
              </button>
              <button className="nav-link" id="fin-tab-pendientes" data-bs-toggle="pill" data-bs-target="#fin-panel-pendientes" type="button" role="tab" aria-controls="fin-panel-pendientes" aria-selected="false">
                <i className="bi bi-hourglass-split"></i><span>Próximas integraciones</span>
              </button>
              <button className="nav-link" id="fin-tab-emisor" data-bs-toggle="pill" data-bs-target="#fin-panel-emisor" type="button" role="tab" aria-controls="fin-panel-emisor" aria-selected="false">
                <i className="bi bi-building"></i><span>Datos del emisor</span>
              </button>
            </div>

            <div className="tab-content integration-tab-content-v3">
              <div className="tab-pane fade show active" id="fin-panel-activos" role="tabpanel" aria-labelledby="fin-tab-activos" tabIndex="0">
                <div className="integration-active-grid-v3">
                  <article className="integration-service-v3 invoice-service">
                    <div className="integration-service-head-v3">
                      <span className="integration-service-icon-v3"><i className="bi bi-file-earmark-pdf"></i></span>
                      <div className="integration-service-title-v3"><small>FACTURA VISUAL</small><strong>Factura Bonita</strong><span>Genera el comprobante PDF y aplica el logo de la cuenta registrada.</span></div>
                      <span id="fin-service-factura-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
                    </div>
                    <p id="fin-service-factura-detail" className="integration-service-detail-v3">Comprobando conexión…</p>
                    <div className="integration-input-grid-v3">
                      <label><span>URL del servicio</span><input id="fin-config-factura-url" className="form-control" placeholder="https://..." /></label>
                      <label><span>Clave X-Api-Key</span><input id="fin-config-factura-key" type="password" className="form-control" autoComplete="new-password" placeholder="Clave guardada · escribe solo para reemplazar" /></label>
                    </div>
                    <div className="integration-service-foot-v3">
                      <div className="integration-actions-v3">
                        <a id="fin-factura-registro" className="btn btn-primary" href="https://proyecto-kn7p.onrender.com/?registro=1" target="_blank" rel="opener"><i className="bi bi-person-plus"></i> Registrar</a>
                        <a id="fin-factura-portal" className="btn btn-outline-secondary" href="https://proyecto-kn7p.onrender.com" target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"></i> Abrir portal</a>
                      </div>
                      <small id="fin-factura-key-hint" className="integration-hint-v3">La X-Api-Key vincula las facturas con la cuenta de EduControl.</small>
                    </div>
                  </article>

                  <article className="integration-service-v3 bank-service">
                    <div className="integration-service-head-v3">
                      <span className="integration-service-icon-v3 bank"><i className="bi bi-credit-card"></i></span>
                      <div className="integration-service-title-v3"><small>PAGOS</small><strong>Servicio bancario</strong><span>Procesa pagos con el comercio afiliado antes de registrar el movimiento.</span></div>
                      <span id="fin-service-banco-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
                    </div>
                    <p id="fin-service-banco-detail" className="integration-service-detail-v3">Comprobando conexión…</p>
                    <label className="integration-field-wide-v3"><span>Identificador de comercio</span><input id="fin-config-banco-merchant" className="form-control" maxLength="128" placeholder="Credencial entregada por el banco" /></label>
                    <label className="integration-affiliation-v3"><input id="fin-config-banco-afiliado" type="checkbox" /><span><strong>Negocio afiliado</strong><small>Habilita el checkout bancario para EduControl.</small></span></label>
                    <div className="integration-service-foot-v3">
                      <div className="integration-actions-v3">
                        <a id="fin-banco-registro" className="btn btn-primary" href="https://bankyfinanzas.netlify.app/registro/negocio" target="_blank" rel="noreferrer"><i className="bi bi-building-add"></i> Afiliar</a>
                        <a id="fin-banco-login" className="btn btn-outline-secondary" href="https://bankyfinanzas.netlify.app/login" target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"></i> Abrir banco</a>
                      </div>
                    </div>
                  </article>
                </div>
                <div className="integration-flow-note-v3"><i className="bi bi-info-circle"></i><span><strong>Flujo actual:</strong> pago aprobado → EduControl registra el movimiento → al cancelar el saldo se solicita el PDF a Factura Bonita.</span></div>
              </div>

              <div className="tab-pane fade" id="fin-panel-pendientes" role="tabpanel" aria-labelledby="fin-tab-pendientes" tabIndex="0">
                <div className="integration-pending-intro-v3"><strong>Preparadas para la siguiente integración</strong><span>Cuando recibas cada endpoint y contrato JSON, solo tendrás que completar la dirección y verificar.</span></div>
                <div className="integration-pending-list-v3">
                  <article className="integration-pending-row-v3">
                    <span className="integration-service-icon-v3"><i className="bi bi-pen"></i></span>
                    <div className="integration-pending-copy-v3"><small>SEGURIDAD</small><strong>Firma Digital</strong><p id="fin-service-firma-detail">Pendiente de recibir el endpoint y contrato JSON.</p></div>
                    <span id="fin-service-firma-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
                    <input id="fin-config-firma-url" className="form-control" placeholder="Endpoint de Firma Digital" aria-label="Endpoint de Firma Digital" />
                  </article>
                  <article className="integration-pending-row-v3">
                    <span className="integration-service-icon-v3"><i className="bi bi-filetype-xml"></i></span>
                    <div className="integration-pending-copy-v3"><small>DOCUMENTO FISCAL</small><strong>Facturación Electrónica</strong><p id="fin-service-electronica-detail">Pendiente de recibir el endpoint y contrato JSON.</p></div>
                    <span id="fin-service-electronica-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
                    <input id="fin-config-electronica-url" className="form-control" placeholder="Endpoint de Facturación Electrónica" aria-label="Endpoint de Facturación Electrónica" />
                  </article>
                  <article className="integration-pending-row-v3">
                    <span className="integration-service-icon-v3"><i className="bi bi-bank2"></i></span>
                    <div className="integration-pending-copy-v3"><small>VALIDACIÓN FISCAL</small><strong>Tributación</strong><p id="fin-service-tributacion-detail">Pendiente del endpoint para enviar el XML y recuperar el acuse.</p></div>
                    <span id="fin-service-tributacion-status" className="billing-service-status pending"><i className="bi bi-clock"></i> Pendiente</span>
                    <input id="fin-config-tributacion-url" className="form-control" placeholder="Endpoint de Tributación" aria-label="Endpoint de Tributación" />
                  </article>
                </div>
              </div>

              <div className="tab-pane fade" id="fin-panel-emisor" role="tabpanel" aria-labelledby="fin-tab-emisor" tabIndex="0">
                <div className="integration-emitter-intro-v3"><i className="bi bi-building-check"></i><div><strong>Datos enviados por EduControl</strong><span>Se incluyen como información del emisor en los comprobantes generados por los servicios conectados.</span></div></div>
                <div className="integration-emitter-grid-v3">
                  <label className="wide"><span>Nombre de la institución</span><input id="fin-config-nombre" className="form-control" maxLength="100" required /></label>
                  <label><span>Tipo de identificación</span><select id="fin-config-tipo-id" className="form-select"><option value="02">Jurídica</option><option value="01">Física</option><option value="03">DIMEX</option><option value="04">NITE</option></select></label>
                  <label><span>Identificación</span><input id="fin-config-numero-id" className="form-control" maxLength="30" required /></label>
                  <label className="wide"><span>Correo de facturación</span><input id="fin-config-correo" type="email" className="form-control" maxLength="150" required /></label>
                </div>
                <div className="integration-logo-note-v3"><i className="bi bi-image"></i><span>El logo no se almacena aquí. Se administra en Factura Bonita y se aplica al PDF mediante la cuenta vinculada.</span></div>
              </div>
            </div>
          </div>
          <div className="modal-footer billing-config-footer integration-footer-v3">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="submit" className="btn btn-primary"><i className="bi bi-check2-circle"></i> Guardar cambios</button>
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
              <iframe id="fin-factura-preview-frame" title="Factura EduControl" aria-label="Factura EduControl" className="finance-invoice-preview-frame" src="about:blank"></iframe>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
