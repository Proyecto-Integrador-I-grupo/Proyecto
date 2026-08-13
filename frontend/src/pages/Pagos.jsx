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
            Controla cargos, pagos, responsables de pago y facturas de los servicios educativos.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button id="fin-refrescar" type="button" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-clockwise"></i> Refrescar
          </button>
          <button id="fin-nuevo-cargo" type="button" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalNuevoCargo">
            <i className="bi bi-plus-circle"></i> Nuevo cargo
          </button>
          <button id="fin-configuracion" type="button" className="btn btn-outline-primary fin-admin-only" data-bs-toggle="modal" data-bs-target="#modalConfigFacturacion">
            <i className="bi bi-gear"></i> Configuración
          </button>
        </div>
      </div>

      <div className="finance-summary mb-4">
        <div className="finance-summary-card">
          <span className="finance-summary-icon"><i className="bi bi-wallet2"></i></span>
          <div><small>Cobrado</small><strong id="fin-total-cobrado">₡0</strong></div>
        </div>
        <div className="finance-summary-card">
          <span className="finance-summary-icon warning"><i className="bi bi-hourglass-split"></i></span>
          <div><small>Pendiente</small><strong id="fin-total-pendiente">₡0</strong></div>
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
              <i className="bi bi-tags"></i> Nuevo concepto
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

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h3 className="h6 mb-1"><i className="bi bi-clock-history me-2"></i>Historial de pagos</h3>
              <p className="small text-muted mb-0">Últimos pagos registrados en el sistema.</p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Fecha</th><th>Estudiante</th><th>Concepto</th><th>Método</th><th>Monto</th><th>Factura</th></tr></thead>
              <tbody id="fin-pagos-body"></tbody>
            </table>
          </div>
        </div>
      </div>

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
                <div className="input-group"><span className="input-group-text">₡</span><input id="fin-cargo-monto" type="number" min="0" step="0.01" className="form-control" required /></div>
              </div>
              <div className="col-md-4">
                <label className="form-label">Descuento</label>
                <div className="input-group"><span className="input-group-text">₡</span><input id="fin-cargo-descuento" type="number" min="0" step="0.01" className="form-control" defaultValue="0" /></div>
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

      <Modal id="modalRegistrarPago" title={<><i className="bi bi-cash-stack"></i> Registrar pago</>} lg>
        <form id="fin-pago-form">
          <div className="modal-body p-4">
            <input id="fin-pago-cargo-id" type="hidden" />
            <div className="finance-payment-context mb-3" id="fin-pago-contexto"></div>
            <div className="row g-3">
              <div className="col-md-4"><label className="form-label">Monto</label><div className="input-group"><span className="input-group-text">₡</span><input id="fin-pago-monto" type="number" min="0.01" step="0.01" className="form-control" required /></div></div>
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

      <Modal id="modalConceptoCobro" title={<><i className="bi bi-tags"></i> Nuevo concepto de cobro</>}>
        <form id="fin-concepto-form">
          <div className="modal-body p-4"><div className="row g-3">
            <div className="col-md-6"><label className="form-label">Código</label><input id="fin-concepto-codigo" className="form-control" required placeholder="Ej. UNIFORME" /></div>
            <div className="col-md-6"><label className="form-label">Tipo</label><select id="fin-concepto-tipo" className="form-select"><option value="servicio">Servicio</option><option value="matricula">Matrícula</option><option value="mensualidad">Mensualidad</option><option value="otro">Otro</option></select></div>
            <div className="col-12"><label className="form-label">Nombre</label><input id="fin-concepto-nombre" className="form-control" required /></div>
            <div className="col-md-6"><label className="form-label">Monto base</label><input id="fin-concepto-monto" type="number" min="0" step="0.01" className="form-control" required /></div>
            <div className="col-md-6"><label className="form-label">Impuesto %</label><input id="fin-concepto-impuesto" type="number" min="0" max="100" step="0.01" className="form-control" defaultValue="0" /></div>
            <div className="col-12"><label className="form-label">Descripción</label><textarea id="fin-concepto-descripcion" className="form-control" rows="2" maxLength="250"></textarea></div>
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
              <div className="col-md-6"><label className="form-label">Servicio de facturación</label><input className="form-control" value="Configurado en el backend mediante FACTURACION_API_URL" readOnly /></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" className="btn btn-primary">Guardar configuración</button></div>
        </form>
      </Modal>
    </section>
  );
}
