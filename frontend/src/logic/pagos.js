import { apiFetch, showToast } from './ui.js';
import { pagarConBanky, describirResultadoBanco } from '../services/payments/bankyCheckout.js';

let conceptos = [];
let estudiantes = [];
let cargos = [];
let facturas = [];
let pagos = [];
let profesores = [];
let clasesExtra = [];
let estadoCuentas = [];
let facturaPreviewUrl = null;
let facturaPreviewCargoId = null;
let facturaPreviewFormato = 'pdf';
let logoFacturaData = null;
const documentosFacturaEnCurso = new Map();
const pagosEnCurso = new Set();

(function registerModule() {
  const moduleName = 'pagos';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = { name: moduleName, init: wirePagosEvents, load: loadPagosData };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

function currentUser() {
  try { return JSON.parse(sessionStorage.getItem('educontrol_usuario') || 'null'); }
  catch { return null; }
}

function esAdmin() {
  return String(currentUser()?.rol || '').toLowerCase() === 'administrador';
}

async function requestJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.mensaje || data.error || 'No se pudo completar la operación.');
  return data;
}

export async function loadPagosData() {
  aplicarPermisos();

  const resultadosBase = await Promise.allSettled([
    cargarEstudiantes(),
    cargarResumen(),
    cargarConceptos(),
    cargarCargos(),
    cargarFacturas(),
    cargarPagos(),
    esAdmin() ? cargarConfiguracion() : Promise.resolve()
  ]);

  const fallos = resultadosBase.filter((r) => r.status === 'rejected');
  if (fallos.length) {
    console.error('EduControl Finanzas: algunas secciones no pudieron cargar:', fallos.map(f => f.reason));
    showToast('Se cargó la información financiera disponible. Usa Refrescar si algún bloque tarda en aparecer.', 'warning');
  }

  await Promise.allSettled([
    cargarClasesExtra(),
    cargarEstadoCuentas()
  ]);
}


async function refrescarFinanzas(event) {
  const button = event?.currentTarget || document.getElementById('fin-refrescar');
  if (button?.dataset.busy === '1') return;
  const html = button?.innerHTML || '';
  if (button) {
    button.dataset.busy = '1';
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span class="visually-hidden">Actualizando</span>';
  }
  try {
    await loadPagosData();
    showToast('Información financiera actualizada.', 'success');
  } catch (error) {
    showToast(error.message || 'No se pudo actualizar Finanzas.', 'error');
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = html || '<i class="bi bi-arrow-clockwise"></i>';
      delete button.dataset.busy;
    }
  }
}

function textoFiltro(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function fechaIsoLocal(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') {
    const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function wirePagosEvents() {
  wire('fin-refrescar', 'click', refrescarFinanzas);
  wire('fin-busqueda', 'input', debounce(renderCargos, 180));
  wire('fin-filtro-estado', 'change', renderCargos);
  wire('fin-facturas-busqueda', 'input', debounce(renderFacturacion, 160));
  wire('fin-facturas-filtro', 'change', renderFacturacion);
  wire('fin-facturas-desde', 'change', renderFacturacion);
  wire('fin-facturas-hasta', 'change', renderFacturacion);
  wire('fin-facturas-limpiar', 'click', limpiarFiltrosFacturas);
  wire('fin-pagos-busqueda', 'input', debounce(renderHistorialPagos, 160));
  wire('fin-pagos-metodo', 'change', renderHistorialPagos);
  wire('fin-pagos-desde', 'change', renderHistorialPagos);
  wire('fin-pagos-hasta', 'change', renderHistorialPagos);
  wire('fin-pagos-limpiar', 'click', limpiarFiltrosPagos);
  wire('fin-cargo-form', 'submit', guardarCargo);
  wire('fin-pago-form', 'submit', guardarPago);
  wire('fin-pago-metodo', 'change', alternarMetodoPago);
  wire('fin-pago-plazo-habilitado', 'change', alternarPlazoPago);
  wire('fin-editar-cargo-form', 'submit', guardarEdicionCargo);
  wire('fin-editar-pago-form', 'submit', guardarEdicionPago);
  wire('fin-concepto-form', 'submit', guardarConcepto);
  wire('fin-concepto-existente', 'change', seleccionarConceptoExistente);
  wire('fin-config-form', 'submit', guardarConfiguracion);
  wire('fin-config-logo', 'change', manejarLogoFactura);
  wire('fin-config-logo-remove', 'click', quitarLogoFactura);
  wire('fin-integracion-probar', 'click', () => cargarEstadoIntegraciones(true));
  wire('fin-cargo-concepto', 'change', sincronizarConceptoCargo);
  wire('fin-cargo-vencimiento', 'change', () => sincronizarDescuentoConVencimiento('fin-cargo-vencimiento', 'fin-cargo-descuento'));
  wire('fin-edit-cargo-vencimiento', 'change', () => sincronizarDescuentoConVencimiento('fin-edit-cargo-vencimiento', 'fin-edit-cargo-descuento'));
  wire('fin-cargo-monto', 'input', () => actualizarResponsableExoneracion('nuevo'));
  wire('fin-cargo-descuento', 'input', () => actualizarResponsableExoneracion('nuevo'));
  wire('fin-cargo-estudiante', 'change', () => cargarResponsableExoneracion('nuevo'));
  wire('fin-edit-cargo-monto', 'input', () => actualizarResponsableExoneracion('editar'));
  wire('fin-edit-cargo-descuento', 'input', () => actualizarResponsableExoneracion('editar'));
  wire('fin-clase-extra-form', 'submit', guardarClaseExtra);
  wire('fin-extra-profesor', 'change', handleProfesorExtraChange);
  wire('fin-extra-profesor-search', 'input', (event) => renderProfesoresExtraSelect(event.target.value));
  wire('fin-extra-fecha', 'change', comprobarDisponibilidadExtra);

  const modalClaseExtra = document.getElementById('modalClaseExtra');
  if (modalClaseExtra && !modalClaseExtra.dataset.profesorLoadWired) {
    modalClaseExtra.dataset.profesorLoadWired = '1';
    modalClaseExtra.addEventListener('show.bs.modal', async () => {
      const search = document.getElementById('fin-extra-profesor-search');
      if (search) search.value = '';
      await cargarProfesoresExtra();
    });
  }

  if (!window.__educontrolFacturaBonitaBridge) {
    window.__educontrolFacturaBonitaBridge = true;
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type !== 'factura-bonita:registered' || !data.apiKey) return;
      const configured = String(document.getElementById('fin-config-factura-url')?.value || '').trim();
      let expectedOrigin = '';
      try { expectedOrigin = configured ? new URL(configured).origin : ''; } catch {}
      if (expectedOrigin && event.origin !== expectedOrigin) return;
      setValue('fin-config-factura-key', data.apiKey);
      if (data.baseUrl) setValue('fin-config-factura-url', data.baseUrl);
      showToast(`Cuenta ${data.empresa || 'Factura Bonita'} registrada. Guarda las conexiones para vincular EduControl.`, 'success');
      try { window.focus(); } catch {}
    });
  }

  const modalConfiguracion = document.getElementById('modalConfigFacturacion');
  if (modalConfiguracion && !modalConfiguracion.dataset.integrationWired) {
    modalConfiguracion.dataset.integrationWired = '1';
    modalConfiguracion.addEventListener('show.bs.modal', async () => {
      await Promise.allSettled([cargarConfiguracion(), cargarEstadoIntegraciones(false)]);
    });
  }

  const pagosView = document.getElementById('pagos-view');
  if (pagosView && !pagosView.dataset.cargoActionsWired) {
    pagosView.dataset.cargoActionsWired = '1';
    pagosView.addEventListener('click', async (event) => {
      const pagar = event.target.closest('[data-fin-pagar]');
      const descuento = event.target.closest('[data-fin-descuento]');
      const editar = event.target.closest('[data-fin-editar-cargo]');
      const documento = event.target.closest('[data-fin-documento]');

      if (descuento) {
        event.preventDefault();
        abrirEdicionCargo(Number(descuento.dataset.finDescuento), true);
        return;
      }
      if (editar) {
        event.preventDefault();
        abrirEdicionCargo(Number(editar.dataset.finEditarCargo));
        return;
      }
      if (pagar) {
        event.preventDefault();
        await abrirPago(Number(pagar.dataset.finPagar));
        return;
      }
      if (documento) {
        event.preventDefault();
        await abrirDocumentoFactura(Number(documento.dataset.finDocumento), documento.dataset.formato || 'pdf', documento);
      }
    });
  }

  document.querySelectorAll('.finance-section-toggle, .finance-open-section').forEach((btn) => {
    if (btn.dataset.collapseWired) return;
    btn.dataset.collapseWired = '1';
    const selector = btn.getAttribute('data-bs-target');
    const target = selector ? document.querySelector(selector) : null;
    if (!target) return;

    const showLabel = btn.dataset.labelShow || 'Mostrar';
    const hideLabel = btn.dataset.labelHide || 'Ocultar';

    const actualizarEtiqueta = (abierto) => {
      const label = abierto ? hideLabel : showLabel;
      if (btn.classList.contains('finance-open-section')) {
        btn.innerHTML = `<span><i class="bi bi-receipt-cutoff"></i> ${label}</span><i class="bi ${abierto ? 'bi-chevron-up' : 'bi-chevron-down'}"></i>`;
      } else {
        btn.innerHTML = `<i class="bi ${abierto ? 'bi-chevron-up' : 'bi-chevron-down'} me-1"></i> ${label}`;
      }
      btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    };

    target.addEventListener('shown.bs.collapse', () => {
      actualizarEtiqueta(true);
      target.closest('.finance-tool-card')?.classList.add('is-open');
      if (target.id === 'fin-facturacion-collapse') renderFacturacion();
    });
    target.addEventListener('hidden.bs.collapse', () => {
      actualizarEtiqueta(false);
      target.closest('.finance-tool-card')?.classList.remove('is-open');
    });
  });

  wire('fin-factura-preview-pdf', 'click', () => {
    if (!facturaPreviewUrl) {
      if (facturaPreviewCargoId) abrirDocumentoFactura(facturaPreviewCargoId, 'pdf');
      return;
    }

    const nueva = window.open(facturaPreviewUrl, '_blank', 'noopener,noreferrer');
    if (!nueva) {
      showToast(
        facturaPreviewFormato === 'html'
          ? 'El navegador bloqueó la vista imprimible. Permite ventanas emergentes para este sitio.'
          : 'El navegador bloqueó la apertura del PDF. Permite ventanas emergentes para este sitio.',
        'warning'
      );
    }
  });
  wire('fin-factura-preview-print', 'click', () => {
    if (!facturaPreviewUrl) {
      showToast('Primero espera a que termine de cargar el PDF.', 'warning');
      return;
    }

    const nueva = window.open(facturaPreviewUrl, '_blank');
    if (!nueva) {
      showToast('El navegador bloqueó la ventana de impresión.', 'warning');
      return;
    }

    window.setTimeout(() => {
      try {
        nueva.focus();
        nueva.print();
      } catch {
        // El visor PDF del navegador mantiene disponible su propio botón Imprimir.
      }
    }, 900);
  });

  const modalFacturaVisual = document.getElementById('modalFacturaVisual');
  if (modalFacturaVisual && !modalFacturaVisual.dataset.previewWired) {
    modalFacturaVisual.dataset.previewWired = '1';

    modalFacturaVisual.addEventListener('hidden.bs.modal', () => {
      const frame = document.getElementById('fin-factura-preview-frame');
      if (frame) frame.src = 'about:blank';
      if (facturaPreviewUrl) URL.revokeObjectURL(facturaPreviewUrl);
      facturaPreviewUrl = null;
      facturaPreviewCargoId = null;
      facturaPreviewFormato = 'pdf';

    });
  }

  const pagosBody = document.getElementById('fin-pagos-body');
  if (pagosBody && !pagosBody.dataset.wired) {
    pagosBody.dataset.wired = '1';
    pagosBody.addEventListener('click', (event) => {
      const editar = event.target.closest('[data-fin-editar-pago]');
      if (editar) abrirEdicionPago(Number(editar.dataset.finEditarPago));
    });
  }
}

function wire(id, eventName, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  const key = `eduWired${eventName.replace(/[^a-z0-9]/gi, '')}`;
  if (el.dataset[key]) return;
  el.dataset[key] = '1';
  el.addEventListener(eventName, handler);
}

function aplicarPermisos() {
  document.querySelectorAll('.fin-admin-only').forEach((el) => el.classList.toggle('hidden', !esAdmin()));
}

async function cargarResumen() {
  const r = await requestJson('/api/finanzas/resumen');
  text('fin-total-cobrado', moneda(r.cobrado));
  text('fin-total-pendiente', moneda(r.pendiente));
  text('fin-total-vencidos', r.vencidos ?? 0);
  text('fin-total-cargos', r.total_cargos ?? 0);
}

async function cargarConceptos() {
  conceptos = await requestJson('/api/finanzas/conceptos');
  const select = document.getElementById('fin-cargo-concepto');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar concepto</option>';
  conceptos.filter((c) => Number(c.estado) === 1).forEach((c) => {
    const op = new Option(`${c.nombre} · ${moneda(c.monto_base)}`, c.id_concepto);
    select.add(op);
  });
  const existente = document.getElementById('fin-concepto-existente');
  if (existente) {
    const actual = existente.value;
    existente.innerHTML = '<option value="">Nuevo concepto</option>';
    conceptos.forEach(c => existente.add(new Option(`${c.nombre} · ${Number(c.estado) === 1 ? 'Activo' : 'Inactivo'}`, c.id_concepto)));
    if ([...existente.options].some(o => o.value === actual)) existente.value = actual;
  }
}

async function cargarEstudiantes() {
  estudiantes = await requestJson('/api/finanzas/estudiantes');
  if (!Array.isArray(estudiantes)) estudiantes = [];

  const ordenar = (lista) => lista.slice().sort((a,b) => nombreEstudiante(a).localeCompare(nombreEstudiante(b)));

  const select = document.getElementById('fin-cargo-estudiante');
  if (select) {
    const actual = select.value;
    select.innerHTML = '<option value="">Seleccionar estudiante</option>';
    ordenar(estudiantes).forEach((e) => {
      const contexto = e.nombre_grupo
        ? ` · ${e.nombre_grupo}${e.nombre_seccion ? ` · Sección ${e.nombre_seccion}` : ''}`
        : ' · Pre-registro / sin grupo';
      const saldo = Number(e.saldo_pendiente || 0);
      const estado = saldo > 0
        ? ` · Debe ${moneda(saldo)}`
        : (Number(e.total_pagado || 0) > 0 ? ' · Al día' : '');
      select.add(new Option(`${nombreEstudiante(e)}${contexto}${estado}`, e.id_estudiante));
    });
    if ([...select.options].some(o => o.value === actual)) select.value = actual;
  }
}


async function cargarPagos() {
  const data = await requestJson('/api/finanzas/pagos');
  pagos = Array.isArray(data) ? data : [];
  renderHistorialPagos();
}

function renderHistorialPagos() {
  const body = document.getElementById('fin-pagos-body');
  const resumen = document.getElementById('fin-historial-resumen');
  if (!body) return;

  const busqueda = textoFiltro(document.getElementById('fin-pagos-busqueda')?.value);
  const metodo = textoFiltro(document.getElementById('fin-pagos-metodo')?.value);
  const desde = String(document.getElementById('fin-pagos-desde')?.value || '');
  const hasta = String(document.getElementById('fin-pagos-hasta')?.value || '');
  const filtrados = pagos.filter((pago) => {
    if (metodo && textoFiltro(pago.metodo_pago) !== metodo) return false;
    const fecha = fechaIsoLocal(pago.fecha_pago);
    if (desde && fecha && fecha < desde) return false;
    if (hasta && fecha && fecha > hasta) return false;
    if (!busqueda) return true;
    const texto = [pago.estudiante_nombre, pago.concepto_nombre, pago.descripcion, pago.referencia, pago.id_factura_externa, pago.metodo_pago]
      .join(' ');
    return textoFiltro(texto).includes(busqueda);
  });

  if (resumen) {
    const hayFiltros = Boolean(busqueda || metodo || desde || hasta);
    resumen.textContent = hayFiltros
      ? `${filtrados.length} de ${pagos.length} movimiento${pagos.length === 1 ? '' : 's'}`
      : `${pagos.length} movimiento${pagos.length === 1 ? '' : 's'}`;
    resumen.classList.toggle('is-empty', filtrados.length === 0);
  }

  if (!filtrados.length) {
    body.innerHTML = `
      <div class="finance-empty-state finance-empty-card compact">
        <i class="bi bi-clock-history"></i>
        <strong>${pagos.length ? 'No hay movimientos con esos filtros' : 'No hay movimientos registrados todavía'}</strong>
        <span>${pagos.length ? 'Ajusta los filtros para consultar otros movimientos.' : 'Los abonos, pagos completos y exoneraciones aparecerán aquí automáticamente.'}</span>
      </div>`;
    return;
  }

  body.innerHTML = filtrados.map((pago) => {
    const concepto = pago.concepto_nombre || pago.descripcion || `Cargo #${pago.id_cargo}`;
    const esExoneracion = String(pago.tipo_movimiento || pago.metodo_pago || '').toLowerCase() === 'exoneracion';
    const esPagoCierre = Boolean(Number(pago.pago_cierre || 0));
    const cargoFacturado = Boolean(pago.id_factura_externa);
    const facturaDelCierre = esPagoCierre ? pago.id_factura_externa : null;
    const puedeEditar = !esExoneracion && !cargoFacturado && Number.isFinite(Number(pago.id_pago));
    const referencia = pago.referencia ? esc(pago.referencia) : 'Sin referencia';
    const registradoPor = pago.registrado_por ? `Registrado por ${esc(pago.registrado_por)}` : '';
    const acumulado = Number(pago.acumulado_hasta_pago || pago.monto || 0);
    const montoPrincipal = esExoneracion ? Number(pago.monto_exonerado || 0) : Number(pago.monto || 0);

    return `
      <article class="finance-history-record ${esExoneracion ? 'is-exemption' : ''}">
        <div class="finance-history-date">
          <span class="finance-history-icon"><i class="bi ${esExoneracion ? 'bi-percent' : 'bi-check2-circle'}"></i></span>
          <div>
            <strong>${esc(fechaHora(pago.fecha_pago))}</strong>
            <small>${esExoneracion ? 'Exoneración 100%' : `Pago #${esc(pago.id_pago)}`}</small>
          </div>
        </div>

        <div class="finance-history-person">
          <strong>${esc(pago.estudiante_nombre || 'Estudiante')}</strong>
          <span>${esc(concepto)}</span>
        </div>

        <div class="finance-history-meta">
          <span>${esc(etiquetaMetodo(pago.metodo_pago))}</span>
          <small>${referencia}</small>
          ${registradoPor ? `<small>${registradoPor}</small>` : ''}
        </div>

        <div class="finance-history-amount">
          <small>${esExoneracion ? 'Monto exonerado' : 'Monto aplicado'}</small>
          <strong>${moneda(montoPrincipal)}</strong>
          <small>${esExoneracion ? 'Total final: CRC 0' : `Acumulado: ${moneda(acumulado)}`}</small>
        </div>

        <div class="finance-history-invoice">
          ${facturaDelCierre
            ? `<span class="invoice-chip"><i class="bi bi-receipt-cutoff"></i> ${esc(facturaDelCierre)}</span>`
            : (esPagoCierre
                ? '<span class="text-muted small">Factura final pendiente</span>'
                : (cargoFacturado
                    ? '<span class="text-muted small">Abono incluido en factura final</span>'
                    : '<span class="text-muted small">Abono registrado</span>'))}
        </div>

        <div class="finance-history-actions">
          ${puedeEditar
            ? `<button class="btn btn-sm btn-outline-secondary" data-fin-editar-pago="${pago.id_pago}"><i class="bi bi-pencil"></i> Modificar</button>`
            : `<span class="small text-muted">${esExoneracion ? 'Cierre por exoneración' : (esPagoCierre ? 'Pago de cierre facturado' : 'Abono consolidado')}</span>`}
        </div>
      </article>`;
  }).join('');
}


function construirEstadoCuentasLocal() {
  const mapa = new Map();

  estudiantes.forEach((e) => {
    mapa.set(Number(e.id_estudiante), {
      id_estudiante: Number(e.id_estudiante),
      estudiante_nombre: nombreEstudiante(e),
      total_cargos: 0,
      total_facturado: 0,
      saldo_pendiente: 0,
      total_pagado: 0,
      cargos_pagados: 0,
      cargos_parciales: 0,
      cargos_pendientes: 0,
      cargos_vencidos: 0,
      saldo_vencido: 0,
      ultimo_pago: e.ultimo_pago || null
    });
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  cargos
    .filter((c) => String(c.estado || '').toLowerCase() !== 'anulado')
    .forEach((c) => {
      const id = Number(c.id_estudiante);
      const item = mapa.get(id) || {
        id_estudiante: id,
        estudiante_nombre: c.estudiante_nombre || `Estudiante ${id}`,
        total_cargos: 0,
        total_facturado: 0,
        saldo_pendiente: 0,
        total_pagado: 0,
        cargos_pagados: 0,
        cargos_parciales: 0,
        cargos_pendientes: 0,
        cargos_vencidos: 0,
        saldo_vencido: 0,
        ultimo_pago: null
      };

      item.total_cargos += 1;
      item.total_facturado += Number(c.total || 0);
      item.saldo_pendiente += Number(c.saldo || 0);

      const estado = String(c.estado || '').toLowerCase();
      if (estado === 'pagado') item.cargos_pagados += 1;
      if (estado === 'parcial') item.cargos_parciales += 1;
      if (estado === 'pendiente') item.cargos_pendientes += 1;

      if (['pendiente', 'parcial'].includes(estado) && Number(c.saldo || 0) > 0 && c.fecha_vencimiento) {
        const vencimiento = new Date(`${String(c.fecha_vencimiento).slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(vencimiento.getTime()) && vencimiento < hoy) {
          item.cargos_vencidos += 1;
          item.saldo_vencido += Number(c.saldo || 0);
        }
      }

      mapa.set(id, item);
    });

  const cargoPorId = new Map(cargos.map((c) => [Number(c.id_cargo), c]));
  pagos.forEach((pg) => {
    const cargo = cargoPorId.get(Number(pg.id_cargo));
    const id = Number(pg.id_estudiante || cargo?.id_estudiante || 0);
    if (!id) return;

    const item = mapa.get(id) || {
      id_estudiante: id,
      estudiante_nombre: pg.estudiante_nombre || cargo?.estudiante_nombre || `Estudiante ${id}`,
      total_cargos: 0,
      total_facturado: 0,
      saldo_pendiente: 0,
      total_pagado: 0,
      cargos_pagados: 0,
      cargos_parciales: 0,
      cargos_pendientes: 0,
      cargos_vencidos: 0,
      saldo_vencido: 0,
      ultimo_pago: null
    };

    item.total_pagado += Number(pg.monto || 0);
    if (!item.ultimo_pago || new Date(pg.fecha_pago) > new Date(item.ultimo_pago)) {
      item.ultimo_pago = pg.fecha_pago;
    }
    mapa.set(id, item);
  });

  return [...mapa.values()];
}

async function cargarEstadoCuentas() {
  const body = document.getElementById('fin-estado-cuentas-body');
  if (!body) return;

  try {
    const respuesta = await requestJson('/api/finanzas/estado-cuentas');
    estadoCuentas = Array.isArray(respuesta) ? respuesta : [];
  } catch (error) {
    console.error('EduControl Finanzas: no se pudo obtener estado-cuentas, se usará cálculo local.', error);
    estadoCuentas = [];
  }

  if (!estadoCuentas.length && (estudiantes.length || cargos.length || pagos.length)) {
    estadoCuentas = construirEstadoCuentasLocal();
  }

  const pendientes = estadoCuentas
    .filter((e) => Number(e.saldo_pendiente || 0) > 0)
    .sort((a, b) => {
      const va = Number(a.cargos_vencidos || 0) > 0 ? 1 : 0;
      const vb = Number(b.cargos_vencidos || 0) > 0 ? 1 : 0;
      if (va !== vb) return vb - va;
      return Number(b.saldo_pendiente || 0) - Number(a.saldo_pendiente || 0);
    });

  const resumen = document.getElementById('fin-morosos-resumen');
  if (resumen) {
    resumen.innerHTML = pendientes.length
      ? `<span class="badge rounded-pill account-status pending">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}</span>`
      : '<span class="badge rounded-pill account-status paid">Sin saldos pendientes</span>';
  }

  if (!pendientes.length) {
    body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay estudiantes con saldos pendientes.</td></tr>';
    return;
  }

  body.innerHTML = pendientes.map((e) => {
    const pendiente = Number(e.saldo_pendiente || 0);
    const pagado = Number(e.total_pagado || 0);
    const vencido = Number(e.cargos_vencidos || 0) > 0 && Number(e.saldo_vencido || 0) > 0;

    const estado = vencido
      ? '<span class="badge rounded-pill account-status overdue">Vencido</span>'
      : (pagado > 0
          ? '<span class="badge rounded-pill account-status partial">Abono registrado</span>'
          : '<span class="badge rounded-pill account-status pending">Pendiente</span>');

    return `<tr class="${vencido ? 'finance-row-overdue' : ''}">
      <td><strong>${esc(e.estudiante_nombre)}</strong></td>
      <td>${estado}</td>
      <td class="fw-semibold">${moneda(pagado)}</td>
      <td class="fw-semibold text-danger-emphasis">${moneda(pendiente)}</td>
    </tr>`;
  }).join('');
}

function renderProfesoresExtraSelect(termino = '') {
  const select = document.getElementById('fin-extra-profesor');
  if (!select) return;

  const actual = select.value;
  const busqueda = String(termino || '').trim().toLowerCase();
  const lista = (Array.isArray(profesores) ? profesores : [])
    .filter((p) => p.estado == 1 || p.estado === true)
    .filter((p) => {
      if (!busqueda) return true;
      const texto = `${p.nombre || ''} ${p.apellido1 || ''} ${p.apellido2 || ''} ${p.profesor_nombre || ''} ${p.materia || ''}`.toLowerCase();
      return texto.includes(busqueda);
    })
    .sort((a, b) => `${a.apellido1 || ''} ${a.apellido2 || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido1 || ''} ${b.apellido2 || ''} ${b.nombre || ''}`));

  select.innerHTML = '<option value="">Seleccionar profesor</option>';
  lista.forEach((p) => {
    const nombre = p.profesor_nombre || `${p.nombre || ''} ${p.apellido1 || ''} ${p.apellido2 || ''}`.trim();
    const grupos = Number(p.grupos_activos || 0);
    const contexto = grupos ? ` · ${grupos} grupo${grupos === 1 ? '' : 's'}` : ' · sin grupo activo';
    select.add(new Option(`${nombre} · ${p.materia || 'Sin materia'}${contexto}`, p.id_profesor ?? p.id));
  });

  if ([...select.options].some((o) => o.value === actual)) select.value = actual;
}

async function cargarProfesoresExtra() {
  const select = document.getElementById('fin-extra-profesor');
  const estudianteSelect = document.getElementById('fin-extra-estudiante');
  if (!select) return;

  const actual = select.value;
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando profesores...</option>';

  try {
    const data = await requestJson('/api/finanzas/profesores-extra');
    profesores = Array.isArray(data) ? data : [];
    select.disabled = false;
    renderProfesoresExtraSelect(document.getElementById('fin-extra-profesor-search')?.value || '');

    if ([...select.options].some((o) => o.value === actual)) {
      select.value = actual;
    }

    if (!profesores.length) {
      select.innerHTML = '<option value="">No hay profesores activos</option>';
      select.disabled = true;
    }

    if (estudianteSelect && !select.value) {
      estudianteSelect.innerHTML = '<option value="">Selecciona un profesor primero</option>';
      estudianteSelect.disabled = true;
    }

    if (select.value) await cargarEstudiantesProfesorExtra(Number(select.value));
  } catch (error) {
    console.error('EduControl Finanzas: no se pudieron cargar profesores para hora extra.', error);
    profesores = [];
    select.innerHTML = '<option value="">No se pudo cargar profesores</option>';
    select.disabled = false;
    showToast(error.message || 'No se pudo cargar la lista de profesores.', 'error');
  }
}

async function cargarEstudiantesProfesorExtra(idProfesor) {
  const select = document.getElementById('fin-extra-estudiante');
  if (!select) return;

  if (!idProfesor) {
    select.innerHTML = '<option value="">Selecciona un profesor primero</option>';
    select.disabled = true;
    return;
  }

  const anterior = select.value;
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando estudiantes del profesor...</option>';

  try {
    const lista = await requestJson(`/api/finanzas/profesores/${idProfesor}/estudiantes-extra`);
    select.innerHTML = '<option value="">Seleccionar estudiante</option>';

    if (!Array.isArray(lista) || !lista.length) {
      select.innerHTML = '<option value="">El profesor no tiene estudiantes asignados</option>';
      select.disabled = true;
      return;
    }

    lista.forEach((e) => {
      const seccion = e.nombre_seccion ? ` · Sección ${e.nombre_seccion}` : '';
      const grupo = e.nombre_grupo ? ` · ${e.nombre_grupo}` : '';
      select.add(new Option(`${nombreEstudiante(e)}${grupo}${seccion}`, e.id_estudiante));
    });

    select.disabled = false;
    if ([...select.options].some((o) => o.value === anterior)) select.value = anterior;
  } catch (error) {
    console.error('EduControl Finanzas: no se pudieron cargar estudiantes del profesor.', error);
    select.innerHTML = '<option value="">No se pudo cargar la lista</option>';
    select.disabled = true;
  }
}

async function handleProfesorExtraChange() {
  const idProfesor = Number(value('fin-extra-profesor') || 0);
  await cargarEstudiantesProfesorExtra(idProfesor);
  await comprobarDisponibilidadExtra();
}

async function cargarClasesExtra() {
  clasesExtra = await requestJson('/api/finanzas/clases-extra');
  const body = document.getElementById('fin-clases-extra-body');
  if (!body) return;
  if (!clasesExtra.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay clases extra programadas.</td></tr>';
    return;
  }
  body.innerHTML = clasesExtra.slice(0,40).map((c) => {
    const horario = c.hora_inicio && c.hora_fin
      ? `${String(c.hora_inicio).slice(0,5)} - ${String(c.hora_fin).slice(0,5)}`
      : 'Horario por coordinar';
    return `<tr>
      <td>${esc(String(c.fecha || '').slice(0,10))}</td>
      <td>${esc(c.estudiante_nombre)}</td>
      <td>${esc(c.profesor_nombre)}</td>
      <td>${esc(c.materia || '—')}</td>
      <td>${esc(horario)}</td>
      <td><span class="badge rounded-pill text-bg-${c.estado_cargo === 'pagado' ? 'success' : 'warning'}">${moneda(c.total || 0)}</span></td>
    </tr>`;
  }).join('');
}

async function comprobarDisponibilidadExtra() {
  const idProfesor = Number(value('fin-extra-profesor') || 0);
  const fecha = value('fin-extra-fecha');
  const box = document.getElementById('fin-extra-disponibilidad');
  const guardar = document.getElementById('fin-extra-guardar');

  if (!idProfesor || !fecha) {
    if (box) {
      box.className = 'extra-availability neutral';
      box.textContent = 'Selecciona profesor y fecha para comprobar disponibilidad.';
    }
    if (guardar) guardar.disabled = false;
    return;
  }

  try {
    const r = await requestJson(`/api/finanzas/profesores/${idProfesor}/disponibilidad-extra?fecha=${encodeURIComponent(fecha)}`);
    if (box) {
      box.className = `extra-availability ${r.disponible ? 'ok' : 'blocked'}`;
      box.innerHTML = `<i class="bi ${r.disponible ? 'bi-calendar-check' : 'bi-calendar-x'}"></i><span>${esc(r.motivo)}</span>`;
    }
    if (guardar) guardar.disabled = !r.disponible;
  } catch (e) {
    if (box) {
      box.className = 'extra-availability blocked';
      box.textContent = e.message;
    }
    if (guardar) guardar.disabled = true;
  }
}

async function guardarClaseExtra(event) {
  event.preventDefault();
  try {
    const payload = {
      id_estudiante: value('fin-extra-estudiante'),
      id_profesor: value('fin-extra-profesor'),
      fecha: value('fin-extra-fecha'),
      hora_inicio: value('fin-extra-inicio') || null,
      hora_fin: value('fin-extra-fin') || null,
      monto_base: value('fin-extra-monto'),
      observaciones: value('fin-extra-observaciones')
    };

    if (!payload.id_profesor) {
      showToast('Selecciona el profesor que impartirá la clase extra.', 'warning');
      document.getElementById('fin-extra-profesor')?.focus();
      return;
    }
    if (!payload.id_estudiante) {
      showToast('Selecciona un estudiante de los grupos del profesor.', 'warning');
      document.getElementById('fin-extra-estudiante')?.focus();
      return;
    }
    if (!payload.fecha) {
      showToast('Selecciona la fecha de la clase extra.', 'warning');
      document.getElementById('fin-extra-fecha')?.focus();
      return;
    }
    if (!Number(payload.monto_base) || Number(payload.monto_base) <= 0) {
      showToast('Indica un monto válido para la clase extra.', 'warning');
      document.getElementById('fin-extra-monto')?.focus();
      return;
    }
    if ((payload.hora_inicio && !payload.hora_fin) || (!payload.hora_inicio && payload.hora_fin)) {
      showToast('Indica tanto la hora de inicio como la hora de finalización.', 'warning');
      return;
    }
    if (payload.hora_inicio && payload.hora_fin && payload.hora_fin <= payload.hora_inicio) {
      showToast('La hora de finalización debe ser posterior a la hora de inicio.', 'warning');
      return;
    }

    const guardar = document.getElementById('fin-extra-guardar');
    if (guardar) guardar.disabled = true;

    const r = await requestJson('/api/finanzas/clases-extra', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    hideModal('modalClaseExtra');
    event.currentTarget.reset();
    const estudianteExtra = document.getElementById('fin-extra-estudiante');
    if (estudianteExtra) {
      estudianteExtra.innerHTML = '<option value="">Selecciona un profesor primero</option>';
      estudianteExtra.disabled = true;
    }
    setValue('fin-extra-monto', 10000);
    const box = document.getElementById('fin-extra-disponibilidad');
    if (box) {
      box.className = 'extra-availability neutral';
      box.textContent = 'Selecciona profesor y fecha para comprobar disponibilidad.';
    }
    showToast(`Clase extra programada. Se generó el cargo ${moneda(r.total || 0)}.`, 'success');
    await loadPagosData();
  } catch (e) {
    showToast(e.message || 'No se pudo programar la clase extra.', 'error');
  } finally {
    const guardar = document.getElementById('fin-extra-guardar');
    if (guardar) guardar.disabled = false;
  }
}

async function cargarCargos() {
  // Siempre se conserva el catálogo completo en memoria. Los filtros de la
  // sección administrativa se aplican localmente para no alterar los bloques
  // principales de Pendientes y Facturación.
  cargos = await requestJson('/api/finanzas/cargos');
  if (!Array.isArray(cargos)) cargos = [];
  renderCargos();
}

async function cargarFacturas() {
  const data = await requestJson('/api/finanzas/facturas');
  facturas = Array.isArray(data) ? data : [];
  actualizarResumenFacturacion();

  const facturacion = document.getElementById('fin-facturacion-collapse');
  if (facturacion?.classList.contains('show')) renderFacturacion();
}

function renderCargos() {
  renderPendientesPago();
  actualizarResumenFacturacion();
  renderAdministracionCargos();
  const facturacion = document.getElementById('fin-facturacion-collapse');
  if (facturacion?.classList.contains('show')) renderFacturacion();
}

function obtenerCargosPagados() {
  // La API /facturas trae el estado de EduControl, pero no debe convertirse
  // en la única fuente visual. Si por una migración o registro histórico falta
  // factura_cargo, el cargo pagado debe seguir apareciendo como "por generar".
  const porId = new Map();

  (Array.isArray(cargos) ? cargos : [])
    .filter((c) => {
      const exonerado = esExoneracionCompleta(c.monto_base, c.descuento) && Number(c.saldo || 0) <= 0;
      return (Number(c.total || 0) > 0 || exonerado) &&
        (String(c.estado || '').toLowerCase() === 'pagado' || Number(c.saldo || 0) <= 0);
    })
    .forEach((c) => porId.set(Number(c.id_cargo), { ...c, estado_cargo: c.estado_cargo || c.estado }));

  (Array.isArray(facturas) ? facturas : [])
    .filter((c) => Number(c.total || 0) > 0 || esExoneracionCompleta(c.monto_base, c.descuento))
    .forEach((c) => {
      const id = Number(c.id_cargo);
      porId.set(id, { ...(porId.get(id) || {}), ...c });
    });

  return [...porId.values()].sort((a, b) => {
    const fa = new Date(a.fecha_actualizacion || a.fecha_solicitud || a.fecha_emision || 0).getTime();
    const fb = new Date(b.fecha_actualizacion || b.fecha_solicitud || b.fecha_emision || 0).getTime();
    return fb - fa || Number(b.id_cargo || 0) - Number(a.id_cargo || 0);
  });
}

function actualizarResumenFacturacion() {
  const resumen = document.getElementById('fin-facturas-resumen');
  if (!resumen) return;
  const registros = obtenerCargosPagados();
  const facturados = registros.filter((r) => Boolean(r.id_factura_externa)).length;
  const procesando = Math.max(0, registros.length - facturados);
  resumen.textContent = `${facturados} facturado${facturados === 1 ? '' : 's'} · ${procesando} procesando`;
  resumen.classList.toggle('is-empty', registros.length === 0);
}

function renderPendientesPago() {
  const body = document.getElementById('fin-pendientes-body');
  const resumen = document.getElementById('fin-pendientes-resumen');
  if (!body) return;

  const pendientes = cargos
    .filter((c) => ['pendiente', 'parcial'].includes(String(c.estado || '').toLowerCase()) && Number(c.saldo || 0) > 0)
    .sort((a, b) => {
      const va = estaVencido(a) ? 1 : 0;
      const vb = estaVencido(b) ? 1 : 0;
      if (va !== vb) return vb - va;
      return Number(b.saldo || 0) - Number(a.saldo || 0);
    });

  if (resumen) {
    resumen.textContent = `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}`;
    resumen.classList.toggle('is-empty', pendientes.length === 0);
  }

  if (!pendientes.length) {
    body.innerHTML = `
      <div class="finance-empty-state finance-empty-card">
        <i class="bi bi-check-circle"></i>
        <strong>No hay pagos pendientes</strong>
        <span>Todos los cargos activos están al día.</span>
      </div>`;
    return;
  }

  body.innerHTML = pendientes.map((c) => {
    const abonado = Math.max(0, Number(c.total || 0) - Number(c.saldo || 0));
    const vencido = estaVencido(c);
    const detalle = c.descripcion && c.descripcion !== c.concepto_nombre
      ? c.descripcion
      : `Cargo #${c.id_cargo}`;

    return `
      <article class="finance-record-card ${vencido ? 'is-overdue' : ''}">
        <div class="finance-record-person">
          <span class="finance-record-avatar"><i class="bi bi-person"></i></span>
          <div>
            <strong>${esc(c.estudiante_nombre)}</strong>
            <span>${esc(c.concepto_nombre)}</span>
            <small>${esc(detalle)}</small>
          </div>
        </div>

        <div class="finance-record-money">
          <div><span>Total</span><strong>${moneda(c.total)}</strong></div>
          <div><span>Abonado</span><strong>${moneda(abonado)}</strong></div>
          <div class="finance-record-balance"><span>Saldo</span><strong>${moneda(c.saldo)}</strong></div>
        </div>

        <div class="finance-record-state">
          ${badgeEstado(c.estado, c.fecha_vencimiento)}
          ${c.fecha_vencimiento ? `<small>Vence: ${esc(String(c.fecha_vencimiento).slice(0, 10))}</small>` : ''}
        </div>

        <div class="finance-record-actions">
          ${esAdmin() ? `<button class="btn btn-sm btn-outline-secondary" data-fin-descuento="${c.id_cargo}" title="Aplicar o modificar descuento"><i class="bi bi-percent"></i> Descuento</button>` : ''}
          <button class="btn btn-sm btn-success finance-pay-btn" data-fin-pagar="${c.id_cargo}">
            <i class="bi bi-cash-coin"></i> Pagar
          </button>
        </div>
      </article>`;
  }).join('');
}

function renderFacturacion() {
  const body = document.getElementById('fin-facturas-body');
  if (!body) return;

  const todos = obtenerCargosPagados();
  actualizarResumenFacturacion();

  const busqueda = textoFiltro(document.getElementById('fin-facturas-busqueda')?.value);
  const filtro = textoFiltro(document.getElementById('fin-facturas-filtro')?.value);
  const desde = String(document.getElementById('fin-facturas-desde')?.value || '');
  const hasta = String(document.getElementById('fin-facturas-hasta')?.value || '');
  const registros = todos.filter((c) => {
    const tieneFactura = Boolean(c.id_factura_externa);
    const esError = !tieneFactura && String(c.estado_factura || '').toLowerCase() === 'error';
    if (filtro === 'facturada' && !tieneFactura) return false;
    if (filtro === 'pendiente' && tieneFactura) return false;
    const fecha = fechaIsoLocal(c.fecha_actualizacion || c.fecha_solicitud || c.fecha_emision);
    if (desde && fecha && fecha < desde) return false;
    if (hasta && fecha && fecha > hasta) return false;
    if (!busqueda) return true;
    return textoFiltro([c.estudiante_nombre, c.concepto_nombre, c.descripcion, c.id_factura_externa, c.id_cargo].join(' ')).includes(busqueda);
  });

  if (!registros.length) {
    body.innerHTML = `
      <div class="finance-empty-state finance-empty-card compact">
        <i class="bi bi-receipt"></i>
        <strong>${todos.length ? 'No hay coincidencias' : 'Aún no hay comprobantes'}</strong>
        <span>${todos.length ? 'Ajusta la búsqueda o el filtro para ver otros comprobantes.' : 'Los cargos pagados se facturan automáticamente y aparecerán aquí para consultar su PDF.'}</span>
      </div>`;
    return;
  }

  body.innerHTML = registros.map((c) => {
    const tieneFactura = Boolean(c.id_factura_externa);
    const esExoneracion = esExoneracionCompleta(c.monto_base, c.descuento) && Number(c.saldo || 0) <= 0;
    const detalleErrorFactura = !tieneFactura && c.error_mensaje
      ? `<small class="finance-invoice-error-detail">${esc(c.error_mensaje)}</small>`
      : '';

    const estadoFactura = tieneFactura
      ? '<span class="badge rounded-pill finance-invoice-ready"><i class="bi bi-check2-circle me-1"></i>PDF disponible</span>'
      : (c.estado_factura === 'error'
          ? `<div class="finance-invoice-error"><span class="badge rounded-pill text-bg-warning">Reintento automático</span>${detalleErrorFactura}</div>`
          : '<span class="badge rounded-pill text-bg-info">Generando automáticamente</span>');

    const acciones = tieneFactura
      ? `<button class="btn btn-sm btn-primary finance-pdf-only-btn" data-fin-documento="${c.id_cargo}" data-formato="pdf" title="Abrir comprobante PDF">
           <i class="bi bi-file-earmark-pdf"></i> Ver PDF
         </button>`
      : '<span class="text-muted small"><i class="bi bi-arrow-repeat me-1"></i>Automático</span>';

    return `
      <article class="finance-invoice-record">
        <div class="finance-invoice-record-main">
          <span class="finance-record-avatar invoice"><i class="bi bi-file-earmark-pdf"></i></span>
          <div>
            <strong>${esc(c.estudiante_nombre || 'Estudiante')}</strong>
            <span>${esc(c.concepto_nombre || c.descripcion || 'Comprobante')}</span>
            <small>${tieneFactura ? esc(c.id_factura_externa) : 'Sin número de factura'}</small>
          </div>
        </div>
        <div class="finance-invoice-record-total">
          <span>${esExoneracion ? 'Total final' : 'Total pagado'}</span>
          <strong>${moneda(c.total)}</strong>
          ${esExoneracion ? `<small>Exonerado: ${moneda(c.descuento || c.monto_base)}</small>` : ''}
        </div>
        <div class="finance-invoice-record-status">${estadoFactura}</div>
        <div class="finance-invoice-record-actions">${acciones}</div>
      </article>`;
  }).join('');
}

function renderAdministracionCargos() {
  const body = document.getElementById('fin-cargos-body');
  if (!body) return;

  const busqueda = textoFiltro(document.getElementById('fin-busqueda')?.value);
  const estado = textoFiltro(document.getElementById('fin-filtro-estado')?.value);

  const filtrados = cargos.filter((c) => {
    if (estado && textoFiltro(c.estado) !== estado) return false;
    if (!busqueda) return true;
    const texto = [
      c.estudiante_nombre,
      c.concepto_nombre,
      c.descripcion,
      c.periodo,
      c.id_estudiante,
      c.id_cargo,
      c.id_factura_externa
    ].join(' ');
    return textoFiltro(texto).includes(busqueda);
  });

  if (!filtrados.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No hay cargos con los filtros aplicados.</td></tr>';
    return;
  }

  body.innerHTML = filtrados.map((c) => `
    <tr>
      <td><strong>${esc(c.estudiante_nombre)}</strong><div class="small text-muted">ID ${c.id_estudiante}</div></td>
      <td><span class="fw-semibold">${esc(c.concepto_nombre)}</span><div class="small text-muted">${esc(c.descripcion || '')}</div></td>
      <td>${esc(c.periodo || '—')}</td>
      <td>${moneda(c.total)}</td>
      <td class="fw-semibold">${moneda(c.saldo)}</td>
      <td>${badgeEstado(c.estado, c.fecha_vencimiento)}</td>
      <td>${renderFactura(c)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-fin-editar-cargo="${c.id_cargo}">
          <i class="bi bi-pencil"></i> Modificar
        </button>
      </td>
    </tr>
  `).join('');
}

function fechaVencimientoPasada(valor) {
  if (!valor) return false;
  const fecha = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
  return fecha < hoy;
}

function sincronizarDescuentoConVencimiento(idFecha, idDescuento) {
  const input = document.getElementById(idDescuento);
  if (!input) return;
  // El vencimiento informa mora, pero no elimina ni bloquea un descuento
  // administrativo ya definido para el cargo.
  input.disabled = false;
  input.removeAttribute('title');
}

function validarDescuentoNoVencido(fecha, descuento) {
  return true;
}

function esExoneracionCompleta(base, descuento) {
  const b = Number(base || 0);
  const d = Number(descuento || 0);
  return b > 0 && d + 0.001 >= b;
}

function idsResponsableExoneracion(modo) {
  const prefijo = modo === 'editar' ? 'fin-edit-resp' : 'fin-cargo-resp';
  return {
    contenedor: modo === 'editar' ? 'fin-edit-exoneracion-responsable' : 'fin-cargo-exoneracion-responsable',
    nombre: `${prefijo}-nombre`, parentesco: `${prefijo}-parentesco`, telefono: `${prefijo}-telefono`,
    correo: `${prefijo}-correo`, tipo: `${prefijo}-tipo-id`, numero: `${prefijo}-numero-id`
  };
}

function actualizarResponsableExoneracion(modo) {
  const editar = modo === 'editar';
  const base = Number(value(editar ? 'fin-edit-cargo-monto' : 'fin-cargo-monto') || 0);
  const descuento = Number(value(editar ? 'fin-edit-cargo-descuento' : 'fin-cargo-descuento') || 0);
  const exonerado = esExoneracionCompleta(base, descuento);
  const ids = idsResponsableExoneracion(modo);
  const box = document.getElementById(ids.contenedor);
  box?.classList.toggle('hidden', !exonerado);
  const modal = document.getElementById(editar ? 'modalEditarCargo' : 'modalNuevoCargo');
  modal?.classList.toggle('is-exemption-active', exonerado);
  [ids.nombre, ids.correo, ids.numero].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.required = exonerado;
    el.setAttribute('aria-required', exonerado ? 'true' : 'false');
  });
  return exonerado;
}

async function cargarResponsableExoneracion(modo, idEstudianteForzado = null) {
  const editar = modo === 'editar';
  const form = document.getElementById(editar ? 'fin-editar-cargo-form' : 'fin-cargo-form');
  const idEstudiante = Number(idEstudianteForzado || form?.dataset.idEstudiante || value('fin-cargo-estudiante') || 0);
  if (!idEstudiante) return;
  const ids = idsResponsableExoneracion(modo);
  try {
    const r = await requestJson(`/api/finanzas/responsables/${idEstudiante}`);
    setValue(ids.nombre, r.nombre || '');
    setValue(ids.parentesco, r.parentesco || '');
    setValue(ids.telefono, r.telefono || '');
    setValue(ids.correo, r.correo || '');
    setValue(ids.tipo, r.tipo_identificacion || '01');
    setValue(ids.numero, r.numero_identificacion || '');
  } catch {
    // Si es un estudiante nuevo simplemente dejamos los campos vacíos.
  }
}

function leerResponsableExoneracion(modo) {
  const ids = idsResponsableExoneracion(modo);
  const responsable = {
    nombre: value(ids.nombre), parentesco: value(ids.parentesco), telefono: value(ids.telefono),
    correo: value(ids.correo), tipo_identificacion: value(ids.tipo) || '01', numero_identificacion: value(ids.numero)
  };
  const faltantes = [];
  if (!String(responsable.nombre || '').trim()) faltantes.push(['nombre completo', ids.nombre]);
  if (!String(responsable.correo || '').trim()) faltantes.push(['correo', ids.correo]);
  if (!String(responsable.numero_identificacion || '').trim()) faltantes.push(['identificación', ids.numero]);
  if (faltantes.length) {
    document.getElementById(faltantes[0][1])?.focus();
    throw new Error(`Para una exoneración del 100% completa ${faltantes.map(([nombre]) => nombre).join(', ')} del responsable de facturación.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(responsable.correo).trim())) {
    document.getElementById(ids.correo)?.focus();
    throw new Error('Indica un correo válido para el responsable de facturación.');
  }
  return responsable;
}

function estaVencido(cargo) {
  if (!cargo?.fecha_vencimiento) return false;
  if (!['pendiente', 'parcial'].includes(String(cargo.estado || '').toLowerCase())) return false;
  const fecha = new Date(`${String(cargo.fecha_vencimiento).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(fecha.getTime()) && fecha < new Date();
}

async function abrirEdicionCargo(idCargo, enfocarDescuento = false) {
  const c = cargos.find(x => Number(x.id_cargo) === Number(idCargo));
  if (!c) return;
  setValue('fin-edit-cargo-id', c.id_cargo);
  setValue('fin-edit-cargo-monto', Number(c.monto_base || 0));
  setValue('fin-edit-cargo-descuento', Number(c.descuento || 0));
  setValue('fin-edit-cargo-vencimiento', c.fecha_vencimiento ? String(c.fecha_vencimiento).slice(0,10) : '');
  setValue('fin-edit-cargo-periodo', c.periodo || '');
  setValue('fin-edit-cargo-descripcion', c.descripcion || '');
  setValue('fin-edit-cargo-extension', 0);
  setValue('fin-edit-cargo-motivo-extension', '');
  const editForm = document.getElementById('fin-editar-cargo-form');
  if (editForm) editForm.dataset.idEstudiante = String(c.id_estudiante || '');
  await cargarResponsableExoneracion('editar', c.id_estudiante);
  actualizarResponsableExoneracion('editar');
  sincronizarDescuentoConVencimiento('fin-edit-cargo-vencimiento', 'fin-edit-cargo-descuento');
  const ctx = document.getElementById('fin-edit-cargo-contexto');
  if (ctx) ctx.innerHTML = `<strong>${esc(c.estudiante_nombre)}</strong><span>${esc(c.concepto_nombre)}</span><span>Pagado: ${moneda(Number(c.total||0)-Number(c.saldo||0))}</span>`;
  showModal('modalEditarCargo');
  if (enfocarDescuento) {
    window.setTimeout(() => {
      const input = document.getElementById('fin-edit-cargo-descuento');
      input?.focus();
      input?.select();
    }, 180);
  }
}

async function guardarEdicionCargo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form?.querySelector('button[type="submit"]');
  const html = submit?.innerHTML || '';
  if (submit?.dataset.busy === '1') return;
  if (submit) { submit.dataset.busy = '1'; submit.disabled = true; submit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando…'; }

  const id = Number(value('fin-edit-cargo-id'));
  try {
    const fechaVencimiento = value('fin-edit-cargo-vencimiento') || null;
    const base = Number(value('fin-edit-cargo-monto') || 0);
    const descuento = Number(value('fin-edit-cargo-descuento') || 0);
    validarDescuentoNoVencido(fechaVencimiento, descuento);
    const exoneracionTotal = esExoneracionCompleta(base, descuento);
    actualizarResponsableExoneracion('editar');

    const payload = {
      monto_base: base, descuento,
      fecha_vencimiento: fechaVencimiento, periodo: value('fin-edit-cargo-periodo'), descripcion: value('fin-edit-cargo-descripcion'),
      extender_plazo_dias: Number(value('fin-edit-cargo-extension') || 0), motivo_extension: value('fin-edit-cargo-motivo-extension')
    };
    if (exoneracionTotal) payload.responsable = leerResponsableExoneracion('editar');

    const r = await requestJson(`/api/finanzas/cargos/${id}`, { method:'PUT', body:JSON.stringify(payload) });
    hideModal('modalEditarCargo');
    if (r.exoneracion_total) {
      if (r.facturacion?.ok) showToast(`Exoneración del 100% aplicada. Factura ${r.facturacion.id_factura || ''} generada correctamente.`, 'success');
      else showToast(`Exoneración aplicada. ${r.facturacion?.mensaje || 'El comprobante quedó pendiente de generación.'}`, 'warning');
    } else {
      showToast('Cargo actualizado correctamente.', 'success');
    }
    await loadPagosData();
    if (r.exoneracion_total && r.facturacion?.ok) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await abrirDocumentoFactura(id, 'pdf', null, true).catch(() => {});
    }
  } catch(e) {
    showToast(e.message,'error');
  } finally {
    if (submit?.isConnected) { submit.disabled = false; submit.innerHTML = html || 'Guardar cambios'; delete submit.dataset.busy; }
  }
}

async function guardarCargo(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form?.querySelector('button[type="submit"]');
  const html = submit?.innerHTML || '';
  if (submit?.dataset.busy === '1') return;
  if (submit) { submit.dataset.busy = '1'; submit.disabled = true; submit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando…'; }

  try {
    const fechaVencimiento = value('fin-cargo-vencimiento') || null;
    const base = Number(value('fin-cargo-monto') || 0);
    const descuento = Number(value('fin-cargo-descuento') || 0);
    validarDescuentoNoVencido(fechaVencimiento, descuento);
    const exoneracionTotal = esExoneracionCompleta(base, descuento);
    actualizarResponsableExoneracion('nuevo');
    const payload = {
      id_estudiante: value('fin-cargo-estudiante'),
      id_concepto: value('fin-cargo-concepto'),
      monto_base: base,
      descuento,
      fecha_vencimiento: fechaVencimiento,
      plazo_dias: Number(value('fin-cargo-plazo') || 0),
      periodo: value('fin-cargo-periodo'),
      descripcion: value('fin-cargo-descripcion')
    };
    if (exoneracionTotal) payload.responsable = leerResponsableExoneracion('nuevo');

    const r = await requestJson('/api/finanzas/cargos', { method: 'POST', body: JSON.stringify(payload) });
    hideModal('modalNuevoCargo');
    form.reset();
    actualizarResponsableExoneracion('nuevo');
    if (r.exoneracion_total) {
      if (r.facturacion?.ok) showToast(`Cargo exonerado al 100%. Factura ${r.facturacion.id_factura || ''} generada correctamente.`, 'success');
      else showToast(`Cargo exonerado al 100%. ${r.facturacion?.mensaje || 'El comprobante quedó pendiente.'}`, 'warning');
    } else {
      showToast('Cargo registrado correctamente.', 'success');
    }
    await loadPagosData();
    if (r.exoneracion_total && r.facturacion?.ok && r.id_cargo) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await abrirDocumentoFactura(Number(r.id_cargo), 'pdf', null, true).catch(() => {});
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (submit?.isConnected) { submit.disabled = false; submit.innerHTML = html || 'Crear cargo'; delete submit.dataset.busy; }
  }
}

function sincronizarConceptoCargo() {
  const id = Number(value('fin-cargo-concepto'));
  const concepto = conceptos.find((c) => Number(c.id_concepto) === id);
  if (!concepto) return;
  const monto = document.getElementById('fin-cargo-monto');
  const desc = document.getElementById('fin-cargo-descripcion');
  if (monto) monto.value = Number(concepto.monto_base || 0);
  if (desc && !desc.value) desc.value = concepto.nombre;
  actualizarResponsableExoneracion('nuevo');
}

async function refrescarDespuesDePago() {
  const resultados = await Promise.allSettled([
    cargarResumen(),
    cargarEstudiantes(),
    cargarCargos(),
    cargarFacturas(),
    cargarPagos(),
    cargarEstadoCuentas()
  ]);

  const fallos = resultados.filter((resultado) => resultado.status === 'rejected');
  if (fallos.length) {
    console.warn('EduControl Finanzas: recarga parcial después del pago:', fallos.map((f) => f.reason));
  }
}

function alternarMetodoPago() {
  const metodo = String(value('fin-pago-metodo') || '').toLowerCase();
  const nota = document.getElementById('fin-pago-banco-ayuda');
  nota?.classList.toggle('hidden', metodo !== 'tarjeta');
  const referencia = document.getElementById('fin-pago-referencia');
  if (referencia) {
    referencia.disabled = metodo === 'tarjeta';
    referencia.placeholder = metodo === 'tarjeta' ? 'La asigna el banco al aprobar el pago' : '';
    if (metodo === 'tarjeta') referencia.value = '';
  }
}

function alternarPlazoPago() {
  const habilitado = Boolean(document.getElementById('fin-pago-plazo-habilitado')?.checked);
  const campos = document.getElementById('fin-pago-plazo-campos');
  campos?.classList.toggle('hidden', !habilitado);
  if (!habilitado) {
    setValue('fin-pago-plazo-fecha', '');
    setValue('fin-pago-plazo-dias', '0');
    setValue('fin-pago-plazo-motivo', '');
  }
}

async function abrirPago(idCargo) {
  const cargo = cargos.find((c) => Number(c.id_cargo) === Number(idCargo));
  if (!cargo) return;
  if (pagosEnCurso.has(Number(idCargo))) {
    showToast('Este pago ya se está procesando.', 'warning');
    return;
  }
  if (String(cargo.estado || '').toLowerCase() === 'pagado' || Number(cargo.saldo || 0) <= 0) {
    showToast('Este cargo ya está pagado.', 'warning');
    await cargarCargos().catch(() => {});
    return;
  }
  setValue('fin-pago-cargo-id', cargo.id_cargo);
  setValue('fin-pago-monto', Number(cargo.saldo || 0));
  setValue('fin-pago-metodo', 'efectivo');
  setValue('fin-pago-referencia', '');
  alternarMetodoPago();
  const plazoToggle = document.getElementById('fin-pago-plazo-habilitado');
  if (plazoToggle) plazoToggle.checked = false;
  setValue('fin-pago-plazo-fecha', cargo.fecha_vencimiento ? String(cargo.fecha_vencimiento).slice(0, 10) : '');
  setValue('fin-pago-plazo-dias', '0');
  setValue('fin-pago-plazo-motivo', '');
  alternarPlazoPago();
  const contexto = document.getElementById('fin-pago-contexto');
  if (contexto) contexto.innerHTML = `<strong>${esc(cargo.estudiante_nombre)}</strong><span>${esc(cargo.descripcion)}</span><span>Saldo: ${moneda(cargo.saldo)}</span>`;

  try {
    const r = await requestJson(`/api/finanzas/responsables/${cargo.id_estudiante}`);
    setValue('fin-resp-nombre', r.nombre || '');
    setValue('fin-resp-parentesco', r.parentesco || '');
    setValue('fin-resp-telefono', r.telefono || '');
    setValue('fin-resp-correo', r.correo || '');
    setValue('fin-resp-tipo-id', r.tipo_identificacion || '01');
    setValue('fin-resp-numero-id', r.numero_identificacion || '');
  } catch {}

  showModal('modalRegistrarPago');
}

async function guardarPago(event) {
  event.preventDefault();

  // El datáfono debe abrirse dentro del gesto directo del usuario. Si se espera
  // primero una petición al backend, Edge/Chrome pueden bloquear la ventana.
  let popupBanco = null;
  const metodoInicial = String(value('fin-pago-metodo') || '').toLowerCase();
  if (metodoInicial === 'tarjeta') {
    popupBanco = window.open('about:blank', 'educontrolBankCheckout', 'width=620,height=820,resizable=yes,scrollbars=yes');
    if (!popupBanco) {
      showToast('El navegador bloqueó el datáfono. Habilita ventanas emergentes para EduControl e inténtalo nuevamente.', 'warning');
      return;
    }
    try {
      popupBanco.document.title = 'Datáfono bancario';
      popupBanco.document.body.style.margin = '0';
      popupBanco.document.body.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;background:#f5f8fb;font-family:system-ui;color:#18324a;padding:28px;box-sizing:border-box">
          <section style="max-width:430px;width:100%;background:#fff;border:1px solid #d8e3ed;border-radius:18px;padding:28px;box-shadow:0 14px 36px rgba(24,50,74,.12);text-align:center">
            <div style="font-size:42px;margin-bottom:10px">💳</div>
            <h2 style="margin:0 0 8px">Conectando con el datáfono</h2>
            <p style="margin:0;color:#64788d;line-height:1.5">EduControl está preparando el cobro seguro. La tarjeta del responsable se ingresa únicamente en la interfaz del banco.</p>
          </section>
        </main>`;
    } catch {}
  }

  const form = event.currentTarget;
  const idCargo = Number(value('fin-pago-cargo-id'));
  const submit = form?.querySelector('button[type="submit"]');
  const submitHtml = submit?.innerHTML || '';

  if (!idCargo || pagosEnCurso.has(idCargo)) {
    showToast('Este pago ya se está procesando.', 'warning');
    return;
  }

  const cargoLocal = cargos.find((c) => Number(c.id_cargo) === idCargo);
  if (cargoLocal && (String(cargoLocal.estado || '').toLowerCase() === 'pagado' || Number(cargoLocal.saldo || 0) <= 0)) {
    hideModal('modalRegistrarPago');
    showToast('Este cargo ya está pagado.', 'warning');
    await cargarCargos().catch(() => {});
    return;
  }

  pagosEnCurso.add(idCargo);
  if (submit) {
    submit.disabled = true;
    submit.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Procesando…';
  }

  try {
    const payload = {
      monto: value('fin-pago-monto'),
      metodo_pago: value('fin-pago-metodo'),
      referencia: value('fin-pago-referencia'),
      plazo: {
        habilitado: Boolean(document.getElementById('fin-pago-plazo-habilitado')?.checked),
        fecha_vencimiento: value('fin-pago-plazo-fecha') || null,
        extender_dias: Number(value('fin-pago-plazo-dias') || 0),
        motivo: value('fin-pago-plazo-motivo')
      },
      responsable: {
        nombre: value('fin-resp-nombre'),
        parentesco: value('fin-resp-parentesco'),
        telefono: value('fin-resp-telefono'),
        correo: value('fin-resp-correo'),
        tipo_identificacion: value('fin-resp-tipo-id'),
        numero_identificacion: value('fin-resp-numero-id')
      }
    };

    let r;
    if (String(payload.metodo_pago || '').toLowerCase() === 'tarjeta') {
      const inicio = await requestJson(`/api/finanzas/cargos/${idCargo}/pago-banco/iniciar`, {
        method: 'POST',
        body: JSON.stringify({
          monto: payload.monto,
          responsable: payload.responsable,
          plazo: payload.plazo,
          origin: window.location.origin
        })
      });

      showToast('Completa el pago en la ventana segura del servicio bancario.', 'info');
      const resultadoBanco = await pagarConBanky({
        checkoutUrl: inicio.checkoutUrl,
        expectedOrigin: inicio.expectedOrigin,
        channel: inicio.channel,
        popup: popupBanco
      });
      popupBanco = null;
      const estadoBanco = String(resultadoBanco?.status || '').toLowerCase();
      if (estadoBanco !== 'completed') {
        await requestJson(`/api/finanzas/cargos/${idCargo}/pago-banco/resultado`, {
          method: 'POST',
          body: JSON.stringify({ token: inicio.token, payload: resultadoBanco })
        }).catch(() => {});
        throw new Error(describirResultadoBanco(resultadoBanco));
      }

      r = await requestJson(`/api/finanzas/cargos/${idCargo}/pago-banco/confirmar`, {
        method: 'POST',
        body: JSON.stringify({
          token: inicio.token,
          sourceOrigin: inicio.expectedOrigin,
          payload: resultadoBanco
        })
      });
      if (r?.banco?.transactionCode) setValue('fin-pago-referencia', r.banco.transactionCode);
    } else {
      r = await requestJson(`/api/finanzas/cargos/${idCargo}/pagar`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    const cargo = cargos.find((c) => Number(c.id_cargo) === idCargo);
    if (cargo) {
      cargo.saldo = Number(r.saldo || 0);
      cargo.estado = r.estado_cargo || (Number(r.saldo || 0) <= 0 ? 'pagado' : 'parcial');
      renderCargos();
    }

    hideModal('modalRegistrarPago');
    const fact = r.facturacion;
    if (fact?.ok) showToast(`Pago aplicado. Factura ${fact.id_factura || ''} generada correctamente.`, 'success');
    else if (r.estado_cargo === 'pagado') showToast(`Pago aplicado. ${fact?.mensaje || 'La factura se generará automáticamente.'}`, 'warning');
    else showToast(`Pago aplicado. ${fact?.mensaje || ''}`, 'success');

    await refrescarDespuesDePago();

    if (fact?.ok && r.estado_cargo === 'pagado') {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      await abrirDocumentoFactura(idCargo, 'pdf', null, true);
    }
  } catch (e) {
    if (popupBanco && !popupBanco.closed) {
      try { popupBanco.close(); } catch {}
      popupBanco = null;
    }
    if (/cargo ya está pagado/i.test(String(e.message || ''))) {
      hideModal('modalRegistrarPago');
      showToast('El cargo ya había sido pagado. La información se actualizó.', 'warning');
      await refrescarDespuesDePago();
    } else {
      showToast(e.message, 'error');
    }
  } finally {
    pagosEnCurso.delete(idCargo);
    if (submit?.isConnected) {
      submit.disabled = false;
      submit.innerHTML = submitHtml;
    }
  }
}

function limpiarFiltrosFacturas() {
  ['fin-facturas-busqueda','fin-facturas-filtro','fin-facturas-desde','fin-facturas-hasta'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderFacturacion();
}

function limpiarFiltrosPagos() {
  ['fin-pagos-busqueda','fin-pagos-metodo','fin-pagos-desde','fin-pagos-hasta'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderHistorialPagos();
}

async function reintentarFactura(idCargo, button = null) {
  const htmlOriginal = button?.innerHTML || '';

  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generando…';
  }

  try {
    const r = await requestJson(`/api/finanzas/cargos/${idCargo}/facturar`, {
      method: 'POST',
      body: JSON.stringify({ metodo_pago: 'otro' }),
      timeout: 100000
    });

    let facturaResultado = r;


    if (!facturaResultado.ok) {
      const mensaje = facturaResultado.mensaje || 'La factura todavía no se puede generar.';
      showToast(mensaje, 'error');
      await cargarCargos();
      renderFacturacion();
      return;
    }

    showToast(`Factura ${facturaResultado.id_factura || ''} generada correctamente.`, 'success');
    await Promise.allSettled([cargarCargos(), cargarFacturas(), cargarPagos()]);
    renderFacturacion();

    // El comprobante se presenta dentro de EduControl; no se abre una pestaña externa.
    await abrirDocumentoFactura(idCargo, 'pdf', null, true);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = htmlOriginal;
    }
  }
}

async function abrirDocumentoFactura(idCargo, formato = 'pdf', button = null, abrirModal = true) {
  const claveDocumento = `${Number(idCargo)}:pdf`;
  if (documentosFacturaEnCurso.has(claveDocumento)) {
    return documentosFacturaEnCurso.get(claveDocumento);
  }

  const tareaDocumento = (async () => {
  const formatoNormalizado = 'pdf';
  const htmlOriginal = button?.innerHTML || '';
  const modalEl = document.getElementById('modalFacturaVisual');
  const frame = document.getElementById('fin-factura-preview-frame');
  const loading = document.getElementById('fin-factura-preview-loading');
  const title = document.getElementById('fin-factura-preview-title');
  const pdfBtn = document.getElementById('fin-factura-preview-pdf');

  facturaPreviewCargoId = idCargo;
  facturaPreviewFormato = 'pdf';

  if (title) title.textContent = 'Factura en PDF';
  if (pdfBtn) {
    pdfBtn.classList.add('btn-light');
    pdfBtn.classList.remove('btn-outline-light');
    pdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> PDF';
    pdfBtn.title = 'Abrir el PDF en otra pestaña';
  }

  if (abrirModal && modalEl && window.bootstrap?.Modal) {
    const modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl, { focus: false });
    modal.show();
  }

  if (loading) {
    loading.innerHTML = `
      <div class="spinner-border text-primary" role="status"></div>
      <strong>Preparando comprobante…</strong>
      <span>Preparando el comprobante PDF de solo lectura.</span>`;
    loading.classList.remove('hidden');
  }
  frame?.classList.add('is-loading');

  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Abriendo PDF…';
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120000);

  try {
    const res = await apiFetch(`/api/finanzas/cargos/${idCargo}/documento?formato=pdf`, {
      method: 'GET',
      signal: controller.signal
    });

    if (!res.ok) {
      const tipo = res.headers.get('content-type') || '';
      let mensaje = 'EduControl no pudo generar el PDF.';
      if (tipo.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        mensaje = data.mensaje || data.detalle || data.error || mensaje;
      } else {
        const texto = await res.text().catch(() => '');
        if (texto) mensaje = texto.slice(0, 240);
      }
      throw new Error(mensaje);
    }

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) throw new Error('EduControl devolvió un comprobante vacío.');

    let mime = 'application/pdf';
    let modo = 'pdf';

    if (contentType.includes('text/html')) {
      mime = 'text/html;charset=utf-8';
      modo = 'html';
    } else {
      const firmaPdf = String.fromCharCode(...bytes.slice(0, 5));
      if (!firmaPdf.startsWith('%PDF')) {
        const texto = new TextDecoder('utf-8').decode(bytes.slice(0, 300));
        throw new Error(texto || 'La respuesta recibida no es un comprobante válido.');
      }
    }

    const blob = new Blob([bytes], { type: mime });

    if (facturaPreviewUrl) URL.revokeObjectURL(facturaPreviewUrl);
    facturaPreviewUrl = URL.createObjectURL(blob);
    facturaPreviewFormato = modo;

    if (title) title.textContent = modo === 'html' ? 'Factura · vista imprimible' : 'Factura en PDF';
    if (pdfBtn) {
      pdfBtn.innerHTML = modo === 'html'
        ? '<i class="bi bi-box-arrow-up-right"></i> Abrir'
        : '<i class="bi bi-file-earmark-pdf"></i> PDF';
      pdfBtn.title = modo === 'html'
        ? 'Abrir la vista imprimible en otra pestaña'
        : 'Abrir el PDF en otra pestaña';
    }

    if (frame) {
      frame.src = 'about:blank';
      window.requestAnimationFrame(() => {
        frame.src = modo === 'pdf' ? `${facturaPreviewUrl}#view=FitH` : facturaPreviewUrl;
        frame.classList.remove('is-loading');
        loading?.classList.add('hidden');
      });
    } else {
      loading?.classList.add('hidden');
    }

    if (modo === 'html') {
      showToast('El PDF remoto tardó demasiado; se abrió la misma factura en vista imprimible.', 'warning');
    }
  } catch (e) {
    frame?.classList.remove('is-loading');
    const mensaje = e.name === 'AbortError'
      ? 'La generación del PDF tardó demasiado.'
      : (e.message || 'No se pudo cargar el PDF.');

    if (loading) {
      loading.classList.remove('hidden');
      loading.innerHTML = `
        <i class="bi bi-exclamation-triangle text-danger fs-2"></i>
        <strong>No se pudo preparar el comprobante</strong>
        <span>${esc(mensaje)}</span>`;
    }
    showToast(mensaje, 'error');
  } finally {
    window.clearTimeout(timeout);
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = htmlOriginal;
    }
  }
  })();

  documentosFacturaEnCurso.set(claveDocumento, tareaDocumento);
  try {
    return await tareaDocumento;
  } finally {
    documentosFacturaEnCurso.delete(claveDocumento);
  }
}

function seleccionarConceptoExistente() {
  const id = Number(value('fin-concepto-existente') || 0);
  const c = conceptos.find(x => Number(x.id_concepto) === id);
  setValue('fin-concepto-id', c?.id_concepto || '');
  setValue('fin-concepto-codigo', c?.codigo || '');
  setValue('fin-concepto-tipo', c?.tipo || 'servicio');
  setValue('fin-concepto-nombre', c?.nombre || '');
  setValue('fin-concepto-monto', c ? Number(c.monto_base || 0) : '');
  setValue('fin-concepto-impuesto', c ? Number(c.impuesto_tarifa || 0) : 0);
  setValue('fin-concepto-descripcion', c?.descripcion || '');
  const estado = document.getElementById('fin-concepto-estado'); if (estado) estado.checked = c ? Number(c.estado) === 1 : true;
  const codigo = document.getElementById('fin-concepto-codigo'); if (codigo) codigo.readOnly = !!c;
  const tipo = document.getElementById('fin-concepto-tipo'); if (tipo) tipo.disabled = !!c;
}

async function guardarConcepto(event) {
  event.preventDefault();
  try {
    const id = Number(value('fin-concepto-id') || 0);
    const payload = { codigo:value('fin-concepto-codigo'), nombre:value('fin-concepto-nombre'), tipo:value('fin-concepto-tipo'),
      monto_base:value('fin-concepto-monto'), impuesto_tarifa:value('fin-concepto-impuesto') || 0, descripcion:value('fin-concepto-descripcion'),
      estado:document.getElementById('fin-concepto-estado')?.checked !== false };
    await requestJson(id ? `/api/finanzas/conceptos/${id}` : '/api/finanzas/conceptos', { method:id ? 'PUT' : 'POST', body:JSON.stringify(payload) });
    showToast(id ? 'Concepto actualizado correctamente.' : 'Concepto creado correctamente.', 'success');
    await cargarConceptos();
    if (!id) { event.currentTarget.reset(); setValue('fin-concepto-id',''); }
    seleccionarConceptoExistente();
  } catch (e) { showToast(e.message, 'error'); }
}

function abrirEdicionPago(idPago) {
  const p = pagos.find(x => Number(x.id_pago) === Number(idPago));
  if (!p || p.id_factura_externa) return;
  setValue('fin-edit-pago-id', p.id_pago); setValue('fin-edit-pago-metodo', p.metodo_pago || 'otro'); setValue('fin-edit-pago-referencia', p.referencia || '');
  const ctx=document.getElementById('fin-edit-pago-contexto'); if(ctx) ctx.innerHTML=`<strong>${esc(p.estudiante_nombre)}</strong><span>${esc(p.descripcion)}</span><span>${moneda(p.monto)}</span>`;
  showModal('modalEditarPago');
}

async function guardarEdicionPago(event) {
  event.preventDefault(); const id=Number(value('fin-edit-pago-id'));
  try {
    await requestJson(`/api/finanzas/pagos/${id}`, {method:'PUT',body:JSON.stringify({metodo_pago:value('fin-edit-pago-metodo'),referencia:value('fin-edit-pago-referencia')})});
    hideModal('modalEditarPago'); showToast('Datos del pago actualizados.', 'success'); await cargarPagos();
  } catch(e){ showToast(e.message,'error'); }
}

function estadoServicioTexto(servicio, prefijo = '') {
  const remoto = String(servicio?.estado || '');
  if (!servicio?.configurado || remoto === 'pendiente_endpoint') return { texto: 'Pendiente endpoint', clase: 'pending', icono: 'bi-clock' };
  if (remoto === 'configurado_sin_contrato') return { texto: 'Endpoint recibido', clase: 'configured', icono: 'bi-link-45deg' };
  if (prefijo === 'banco' && servicio?.disponible === true && servicio?.listo_cobro !== true) {
    return { texto: 'Falta afiliación', clase: 'configured', icono: 'bi-building-check' };
  }
  if (prefijo === 'factura' && servicio?.disponible === true && servicio?.cuenta_vinculada !== true) {
    return { texto: 'Falta vincular', clase: 'configured', icono: 'bi-key' };
  }
  if (remoto === 'degradado') return { texto: 'Vista disponible', clase: 'degraded', icono: 'bi-file-earmark-text' };
  if (remoto === 'limitado') return { texto: 'Disponible', clase: 'degraded', icono: 'bi-hourglass-split' };
  if (servicio.disponible === true) return { texto: 'Listo', clase: 'online', icono: 'bi-check-circle' };
  if (servicio.disponible === false) return { texto: 'Sin conexión', clase: 'offline', icono: 'bi-exclamation-circle' };
  return { texto: 'Configurado', clase: 'configured', icono: 'bi-link-45deg' };
}

function pintarEstadoIntegracionPagina(estado) {
  const label = document.getElementById('fin-api-page-status');
  const detail = document.getElementById('fin-api-page-detail');
  const dot = document.getElementById('fin-api-page-dot');
  if (!label || !dot) return;

  const facturaOk = estado?.facturacion?.disponible === true;
  const documentosOk = estado?.documentos?.disponible === true;
  const documentosDegradados = String(estado?.documentos?.estado || '') === 'degradado';
  const estadoFactura = String(estado?.facturacion?.estado || '');

  dot.className = 'finance-api-dot';
  if (facturaOk && documentosOk && documentosDegradados) {
    dot.classList.add('warning');
    label.textContent = 'Factura Bonita conectada · vista imprimible activa';
  } else if (facturaOk && documentosOk) {
    dot.classList.add('online');
    label.textContent = 'Factura Bonita conectada';
  } else if (facturaOk) {
    dot.classList.add('warning');
    label.textContent = 'Factura registrada · PDF pendiente';
  } else if (estadoFactura === 'timeout') {
    dot.classList.add('warning');
    label.textContent = 'Conectando con Factura Bonita';
  } else if (estado?.facturacion?.configurado) {
    dot.classList.add('offline');
    label.textContent = 'Factura Bonita no disponible';
  } else {
    dot.classList.add('offline');
    label.textContent = 'Configuración de facturación pendiente';
  }

  if (detail) {
    const detalle = documentosDegradados
      ? (estado?.documentos?.detalle || 'La factura puede abrirse en vista imprimible mientras se prepara el motor PDF.')
      : (estado?.facturacion?.detalle || estado?.facturacion?.url || '');
    detail.textContent = detalle;
  }
}

function pintarEstadoServicio(prefijo, servicio) {
  const badge = document.getElementById(`fin-service-${prefijo}-status`);
  const detalle = document.getElementById(`fin-service-${prefijo}-detail`);
  if (!badge) return;

  const estado = estadoServicioTexto(servicio, prefijo);
  badge.className = `billing-service-status ${estado.clase}`;
  badge.innerHTML = `<i class="bi ${estado.icono}"></i> ${estado.texto}`;

  if (detalle) {
    detalle.textContent = servicio?.url
      ? (servicio.detalle || 'Módulo disponible en el backend.')
      : (servicio?.detalle || (servicio?.configurado ? 'Módulo configurado.' : 'Configuración pendiente.'));
  }
}

async function cargarEstadoIntegraciones(notificar = false) {
  const botones = [
    document.getElementById('fin-integracion-probar'),
    document.getElementById('fin-api-page-test')
  ].filter(Boolean);
  const originales = botones.map((btn) => btn.innerHTML);

  botones.forEach((btn) => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Verificando…';
  });

  try {
    const estado = await requestJson('/api/finanzas/integraciones/estado', { timeout: 80000 });
    pintarEstadoServicio('factura', estado.facturacion);
    pintarEstadoServicio('banco', estado.banco);
    pintarEstadoServicio('firma', estado.firma_digital);
    pintarEstadoServicio('electronica', estado.factura_electronica);
    pintarEstadoServicio('tributacion', estado.tributacion);
    pintarEstadoIntegracionPagina(estado);

    const facturaRegistro = document.getElementById('fin-factura-registro');
    const facturaPortal = document.getElementById('fin-factura-portal');
    const facturaBase = String(estado?.facturacion?.url || '').replace(/\/+$/, '');
    if (facturaRegistro && facturaBase) facturaRegistro.href = `${facturaBase}/?registro=1&returnUrl=${encodeURIComponent(window.location.origin)}`;
    if (facturaPortal && facturaBase) facturaPortal.href = facturaBase;

    const bancoRegistro = document.getElementById('fin-banco-registro');
    const bancoLogin = document.getElementById('fin-banco-login');
    if (bancoRegistro && estado?.banco?.registro_url) bancoRegistro.href = estado.banco.registro_url;
    if (bancoLogin && estado?.banco?.login_url) bancoLogin.href = estado.banco.login_url;

    if (notificar) {
      const actual = estado?.facturacion?.disponible && estado?.banco?.disponible;
      const completa = estado?.flujo?.listo_completo;
      showToast(
        completa
          ? 'Todos los servicios están configurados para el flujo completo.'
          : actual
            ? 'Factura Bonita y el servicio de pago responden. Los demás servicios siguen pendientes de endpoint.'
            : 'La verificación terminó; revisa los servicios marcados como pendientes.',
        completa ? 'success' : (actual ? 'info' : 'warning')
      );
    }
    return estado;
  } catch (e) {
    if (notificar) showToast(e.message, 'error');
    const errorEstado = { configurado: true, disponible: false, detalle: e.message };
    ['factura','banco','firma','electronica','tributacion'].forEach((prefijo) => pintarEstadoServicio(prefijo, errorEstado));
    pintarEstadoIntegracionPagina({ facturacion: errorEstado, documentos: errorEstado });
    throw e;
  } finally {
    botones.forEach((btn, index) => {
      btn.disabled = false;
      btn.innerHTML = originales[index] || '<i class="bi bi-arrow-repeat"></i> Verificar';
    });
  }
}

async function cargarConfiguracion() {
  try {
    const c = (await requestJson('/api/finanzas/configuracion')) || {};
    setValue('fin-config-nombre', c.institucion_nombre || '');
    setValue('fin-config-tipo-id', c.tipo_identificacion || '02');
    setValue('fin-config-numero-id', c.numero_identificacion || '');
    setValue('fin-config-correo', c.correo || '');

    setValue('fin-config-factura-url', c.factura_bonita_url || '');
    setValue('fin-config-factura-key', '');
    const keyInput = document.getElementById('fin-config-factura-key');
    if (keyInput) {
      keyInput.placeholder = c.factura_bonita_api_key_configurada
        ? 'Clave guardada · escribe solo para reemplazarla'
        : 'Pega la clave de la cuenta de EduControl';
    }
    const keyHint = document.getElementById('fin-factura-key-hint');
    if (keyHint) {
      keyHint.textContent = c.factura_bonita_api_key_configurada
        ? 'EduControl ya tiene una X-Api-Key guardada. El campo puede quedar vacío.'
        : 'Después del registro copia la clave desde Integración en Factura Bonita.';
    }

    setValue('fin-config-banco-merchant', c.banco_merchant_id || '');
    const afiliado = document.getElementById('fin-config-banco-afiliado');
    if (afiliado) afiliado.checked = Boolean(c.banco_afiliado);
    setValue('fin-config-firma-url', c.firma_digital_url || '');
    setValue('fin-config-electronica-url', c.factura_electronica_url || '');
    setValue('fin-config-tributacion-url', c.tributacion_url || '');

    logoFacturaData = c.logo_data || null;
    renderLogoFacturaPreview();

    const facturaBase = String(c.factura_bonita_url || '').replace(/\/+$/, '');
    const facturaRegistro = document.getElementById('fin-factura-registro');
    const facturaPortal = document.getElementById('fin-factura-portal');
    if (facturaBase) {
      if (facturaRegistro) facturaRegistro.href = `${facturaBase}/?registro=1&returnUrl=${encodeURIComponent(window.location.origin)}`;
      if (facturaPortal) facturaPortal.href = facturaBase;
    }

    const bancoRegistro = document.getElementById('fin-banco-registro');
    const bancoLogin = document.getElementById('fin-banco-login');
    if (bancoRegistro && c.banco_registro_url) bancoRegistro.href = c.banco_registro_url;
    if (bancoLogin && c.banco_login_url) bancoLogin.href = c.banco_login_url;
  } catch (error) {
    logoFacturaData = null;
    renderLogoFacturaPreview();
    showToast(error?.message || 'No se pudo cargar la configuración guardada de servicios.', 'error');
    throw error;
  }
}

function renderLogoFacturaPreview() {
  const preview = document.getElementById('fin-config-logo-preview');
  const empty = document.getElementById('fin-config-logo-empty');
  const remove = document.getElementById('fin-config-logo-remove');

  if (preview) {
    if (logoFacturaData) {
      preview.src = logoFacturaData;
      preview.classList.remove('hidden');
    } else {
      preview.removeAttribute('src');
      preview.classList.add('hidden');
    }
  }

  empty?.classList.toggle('hidden', Boolean(logoFacturaData));
  remove?.classList.toggle('hidden', !logoFacturaData);
}

async function convertirLogoConFondoTransparente(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const limiteDataUrl = 690000;
        let maxSide = 760;

        const render = (ladoMaximo) => {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, ladoMaximo / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const px = imageData.data;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], g = px[i + 1], b = px[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (r >= 238 && g >= 238 && b >= 238 && max - min <= 18) {
              const lum = (r + g + b) / 3;
              px[i + 3] = Math.max(0, Math.min(255, Math.round((255 - lum) * 18)));
            }
          }
          ctx.putImageData(imageData, 0, 0);
          return canvas;
        };

        let canvas = render(maxSide);
        let salida = canvas.toDataURL('image/webp', 0.9);
        while (salida.length > limiteDataUrl && maxSide > 220) {
          maxSide = Math.round(maxSide * 0.82);
          canvas = render(maxSide);
          salida = canvas.toDataURL('image/webp', 0.86);
        }

        if (!salida.startsWith('data:image/')) salida = canvas.toDataURL('image/png');
        resolve(salida);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function manejarLogoFactura(event) {
  const archivo = event.target.files?.[0];
  if (!archivo) return;

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo.type)) {
    event.target.value = '';
    showToast('El logo debe ser una imagen PNG, JPG o WEBP.', 'warning');
    return;
  }

  if (archivo.size > 500 * 1024) {
    event.target.value = '';
    showToast('El logo debe pesar menos de 500 KB.', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const original = String(reader.result || '');
    logoFacturaData = await convertirLogoConFondoTransparente(original);
    renderLogoFacturaPreview();
  };
  reader.onerror = () => showToast('No se pudo leer la imagen seleccionada.', 'error');
  reader.readAsDataURL(archivo);
}

function quitarLogoFactura() {
  logoFacturaData = null;
  const input = document.getElementById('fin-config-logo');
  if (input) input.value = '';
  renderLogoFacturaPreview();
}

async function guardarConfiguracion(event) {
  event.preventDefault();
  const submit = event.currentTarget?.querySelector('button[type="submit"]');
  const original = submit?.innerHTML;
  if (submit) {
    submit.disabled = true;
    submit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Guardando...';
  }

  try {
    const payload = {
      institucion_nombre: value('fin-config-nombre'),
      tipo_identificacion: value('fin-config-tipo-id'),
      numero_identificacion: value('fin-config-numero-id'),
      correo: value('fin-config-correo'),
      factura_bonita_url: value('fin-config-factura-url'),
      factura_bonita_api_key: value('fin-config-factura-key'),
      banco_merchant_id: value('fin-config-banco-merchant'),
      banco_afiliado: Boolean(document.getElementById('fin-config-banco-afiliado')?.checked),
      firma_digital_url: value('fin-config-firma-url'),
      factura_electronica_url: value('fin-config-electronica-url'),
      tributacion_url: value('fin-config-tributacion-url')
    };

    const guardada = await requestJson('/api/finanzas/configuracion', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    setValue('fin-config-factura-key', '');
    const keyInput = document.getElementById('fin-config-factura-key');
    if (keyInput && guardada?.factura_bonita_api_key_configurada) {
      keyInput.placeholder = 'Clave guardada · escribe solo para reemplazarla';
    }

    const verificacion = await requestJson('/api/finanzas/configuracion');
    const esperadoFacturaUrl = String(value('fin-config-factura-url') || '').trim().replace(/\/+$/, '');
    const guardadoFacturaUrl = String(verificacion?.factura_bonita_url || '').trim().replace(/\/+$/, '');
    const merchantEsperado = String(value('fin-config-banco-merchant') || '').trim();
    const afiliadoEsperado = Boolean(document.getElementById('fin-config-banco-afiliado')?.checked);
    const coincideServicios =
      (!esperadoFacturaUrl || guardadoFacturaUrl === esperadoFacturaUrl) &&
      (!merchantEsperado || String(verificacion?.banco_merchant_id || '').trim() === merchantEsperado) &&
      Boolean(verificacion?.banco_afiliado) === afiliadoEsperado &&
      (!value('fin-config-factura-key').trim() || Boolean(verificacion?.factura_bonita_api_key_configurada));

    if (!coincideServicios) throw new Error('La configuración respondió, pero no fue posible confirmar todos los datos de integración.');

    await cargarConfiguracion();
    await cargarEstadoIntegraciones(false);
    showToast('Conexiones guardadas. Los datos permanecerán disponibles al volver a abrir esta ventana.', 'success');
  } catch (e) {
    showToast(e.message || 'No se pudo guardar la configuración.', 'error');
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.innerHTML = original || 'Guardar conexiones';
    }
  }
}

function renderFactura(r) {
  if (r.id_factura_externa) return `<span class="invoice-chip"><i class="bi bi-receipt-cutoff"></i> ${esc(r.id_factura_externa)}</span>`;
  if (r.estado_factura === 'error') return '<span class="badge text-bg-danger">Error</span>';
  if (r.estado_factura === 'pendiente_datos') return '<span class="badge text-bg-warning">Faltan datos</span>';
  if (r.estado_factura === 'pendiente_configuracion') return '<span class="badge text-bg-warning">Configurar</span>';
  if (String(r.estado || '').toLowerCase() === 'pagado' || Number(r.saldo || 0) <= 0) {
    return '<span class="badge text-bg-info">Automático</span>';
  }
  return '<span class="text-muted">—</span>';
}

function badgeEstado(estado, vencimiento) {
  const vencido = vencimiento && new Date(`${String(vencimiento).slice(0,10)}T23:59:59`) < new Date() && estado !== 'pagado';
  if (vencido) return '<span class="badge rounded-pill text-bg-danger">Vencido</span>';
  const map = { pendiente: 'warning', parcial: 'info', pagado: 'success', anulado: 'secondary' };
  return `<span class="badge rounded-pill text-bg-${map[estado] || 'secondary'}">${esc(cap(estado))}</span>`;
}

function nombreEstudiante(e) { return `${e.nombre || ''} ${e.apellido1 || ''} ${e.apellido2 || ''}`.replace(/\s+/g,' ').trim(); }
function moneda(v) { return `CRC ${new Intl.NumberFormat('es-CR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(v||0))}`; }
function fechaHora(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CR'); }
function etiquetaMetodo(v) { return ({efectivo:'Efectivo',tarjeta:'Tarjeta',sinpe:'SINPE',transferencia:'Transferencia',otro:'Otro',exoneracion:'Exoneración 100%'})[v] || cap(v); }
function cap(v) { const s=String(v||''); return s ? s[0].toUpperCase()+s.slice(1) : '—'; }
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function value(id) { return document.getElementById(id)?.value ?? ''; }
function setValue(id,v) { const e=document.getElementById(id); if(e) e.value=v ?? ''; }
function text(id,v) { const e=document.getElementById(id); if(e) e.textContent=String(v); }
function showModal(id) { const el=document.getElementById(id); if(el && window.bootstrap?.Modal) (window.bootstrap.Modal.getInstance(el)||new window.bootstrap.Modal(el)).show(); }
function hideModal(id) { const el=document.getElementById(id); if(el && window.bootstrap?.Modal) window.bootstrap.Modal.getInstance(el)?.hide(); }
function debounce(fn,ms){let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>fn(...args),ms);};}
