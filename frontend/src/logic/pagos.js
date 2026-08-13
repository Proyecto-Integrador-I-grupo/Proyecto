import { apiFetch, showToast } from './ui.js';

let conceptos = [];
let estudiantes = [];
let cargos = [];
let pagos = [];

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
  await Promise.all([
    cargarResumen(),
    cargarConceptos(),
    cargarEstudiantes(),
    cargarCargos(),
    cargarPagos(),
    esAdmin() ? cargarConfiguracion() : Promise.resolve()
  ]);
}

function wirePagosEvents() {
  wire('fin-refrescar', 'click', loadPagosData);
  wire('fin-busqueda', 'input', debounce(cargarCargos, 250));
  wire('fin-filtro-estado', 'change', cargarCargos);
  wire('fin-cargo-form', 'submit', guardarCargo);
  wire('fin-pago-form', 'submit', guardarPago);
  wire('fin-concepto-form', 'submit', guardarConcepto);
  wire('fin-config-form', 'submit', guardarConfiguracion);
  wire('fin-cargo-concepto', 'change', sincronizarConceptoCargo);

  const body = document.getElementById('fin-cargos-body');
  if (body && !body.dataset.wired) {
    body.dataset.wired = '1';
    body.addEventListener('click', async (event) => {
      const pagar = event.target.closest('[data-fin-pagar]');
      const facturar = event.target.closest('[data-fin-facturar]');
      if (pagar) await abrirPago(Number(pagar.dataset.finPagar));
      if (facturar) await reintentarFactura(Number(facturar.dataset.finFacturar));
    });
  }
}

function wire(id, eventName, handler) {
  const el = document.getElementById(id);
  if (!el || el.dataset.wired) return;
  el.dataset.wired = '1';
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
}

async function cargarEstudiantes() {
  estudiantes = await requestJson('/api/estudiantes/matriculados');
  const select = document.getElementById('fin-cargo-estudiante');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar estudiante</option>';
  const únicos = new Map();
  estudiantes.forEach((e) => {
    if (!únicos.has(e.id_estudiante)) únicos.set(e.id_estudiante, e);
  });
  [...únicos.values()].sort((a,b) => nombreEstudiante(a).localeCompare(nombreEstudiante(b))).forEach((e) => {
    select.add(new Option(`${nombreEstudiante(e)} · ${e.nombre_grupo || 'Sin grupo'} · Sección ${e.nombre_seccion || '-'}`, e.id_estudiante));
  });
}

async function cargarCargos() {
  const params = new URLSearchParams();
  const busqueda = document.getElementById('fin-busqueda')?.value.trim();
  const estado = document.getElementById('fin-filtro-estado')?.value;
  if (busqueda) params.set('busqueda', busqueda);
  if (estado) params.set('estado', estado);
  cargos = await requestJson(`/api/finanzas/cargos?${params.toString()}`);
  renderCargos();
}

async function cargarPagos() {
  pagos = await requestJson('/api/finanzas/pagos');
  const body = document.getElementById('fin-pagos-body');
  if (!body) return;
  body.innerHTML = '';
  if (!pagos.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Aún no hay pagos registrados.</td></tr>';
    return;
  }
  pagos.slice(0, 30).forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(fechaHora(p.fecha_pago))}</td><td>${esc(p.estudiante_nombre)}</td><td>${esc(p.descripcion)}</td><td>${esc(etiquetaMetodo(p.metodo_pago))}</td><td class="fw-semibold">${moneda(p.monto)}</td><td>${renderFactura(p)}</td>`;
    body.appendChild(tr);
  });
}

function renderCargos() {
  const body = document.getElementById('fin-cargos-body');
  if (!body) return;
  body.innerHTML = '';
  if (!cargos.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-5">No hay cargos con los filtros aplicados.</td></tr>';
    return;
  }

  cargos.forEach((c) => {
    const puedePagar = ['pendiente','parcial'].includes(c.estado);
    const requiereFactura = c.estado === 'pagado' && c.estado_factura !== 'generada';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(c.estudiante_nombre)}</strong><div class="small text-muted">ID ${c.id_estudiante}</div></td>
      <td><span class="fw-semibold">${esc(c.concepto_nombre)}</span><div class="small text-muted">${esc(c.descripcion)}</div></td>
      <td>${esc(c.periodo || '—')}</td>
      <td>${moneda(c.total)}</td>
      <td class="fw-semibold">${moneda(c.saldo)}</td>
      <td>${badgeEstado(c.estado, c.fecha_vencimiento)}</td>
      <td>${renderFactura(c)}</td>
      <td class="text-end"><div class="d-inline-flex gap-1 flex-wrap justify-content-end">
        ${puedePagar ? `<button class="btn btn-sm btn-success" data-fin-pagar="${c.id_cargo}"><i class="bi bi-cash"></i> Pagar</button>` : ''}
        ${requiereFactura ? `<button class="btn btn-sm btn-outline-primary" data-fin-facturar="${c.id_cargo}"><i class="bi bi-receipt"></i> Facturar</button>` : ''}
      </div></td>`;
    body.appendChild(tr);
  });
}

async function guardarCargo(event) {
  event.preventDefault();
  try {
    const payload = {
      id_estudiante: value('fin-cargo-estudiante'),
      id_concepto: value('fin-cargo-concepto'),
      monto_base: value('fin-cargo-monto'),
      descuento: value('fin-cargo-descuento') || 0,
      fecha_vencimiento: value('fin-cargo-vencimiento') || null,
      periodo: value('fin-cargo-periodo'),
      descripcion: value('fin-cargo-descripcion')
    };
    await requestJson('/api/finanzas/cargos', { method: 'POST', body: JSON.stringify(payload) });
    hideModal('modalNuevoCargo');
    event.currentTarget.reset();
    showToast('Cargo registrado correctamente.', 'success');
    await loadPagosData();
  } catch (e) { showToast(e.message, 'error'); }
}

function sincronizarConceptoCargo() {
  const id = Number(value('fin-cargo-concepto'));
  const concepto = conceptos.find((c) => Number(c.id_concepto) === id);
  if (!concepto) return;
  const monto = document.getElementById('fin-cargo-monto');
  const desc = document.getElementById('fin-cargo-descripcion');
  if (monto) monto.value = Number(concepto.monto_base || 0);
  if (desc && !desc.value) desc.value = concepto.nombre;
}

async function abrirPago(idCargo) {
  const cargo = cargos.find((c) => Number(c.id_cargo) === Number(idCargo));
  if (!cargo) return;
  setValue('fin-pago-cargo-id', cargo.id_cargo);
  setValue('fin-pago-monto', Number(cargo.saldo || 0));
  setValue('fin-pago-referencia', '');
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
  const idCargo = Number(value('fin-pago-cargo-id'));
  try {
    const payload = {
      monto: value('fin-pago-monto'),
      metodo_pago: value('fin-pago-metodo'),
      referencia: value('fin-pago-referencia'),
      responsable: {
        nombre: value('fin-resp-nombre'),
        parentesco: value('fin-resp-parentesco'),
        telefono: value('fin-resp-telefono'),
        correo: value('fin-resp-correo'),
        tipo_identificacion: value('fin-resp-tipo-id'),
        numero_identificacion: value('fin-resp-numero-id')
      }
    };
    const r = await requestJson(`/api/finanzas/cargos/${idCargo}/pagar`, { method: 'POST', body: JSON.stringify(payload) });
    hideModal('modalRegistrarPago');
    const fact = r.facturacion;
    if (fact?.ok) showToast(`Pago aplicado y factura ${fact.id_factura || ''} generada.`, 'success');
    else showToast(`Pago aplicado. ${fact?.mensaje || ''}`, fact?.estado === 'error' ? 'warning' : 'success');
    await loadPagosData();
  } catch (e) { showToast(e.message, 'error'); }
}

async function reintentarFactura(idCargo) {
  try {
    const r = await requestJson(`/api/finanzas/cargos/${idCargo}/facturar`, { method: 'POST', body: JSON.stringify({ metodo_pago: 'otro' }) });
    showToast(r.ok ? `Factura ${r.id_factura || ''} generada.` : (r.mensaje || 'Factura pendiente.'), r.ok ? 'success' : 'warning');
    await loadPagosData();
  } catch (e) { showToast(e.message, 'error'); }
}

async function guardarConcepto(event) {
  event.preventDefault();
  try {
    await requestJson('/api/finanzas/conceptos', { method: 'POST', body: JSON.stringify({
      codigo: value('fin-concepto-codigo'), nombre: value('fin-concepto-nombre'), tipo: value('fin-concepto-tipo'),
      monto_base: value('fin-concepto-monto'), impuesto_tarifa: value('fin-concepto-impuesto') || 0,
      descripcion: value('fin-concepto-descripcion')
    }) });
    hideModal('modalConceptoCobro');
    event.currentTarget.reset();
    showToast('Concepto creado correctamente.', 'success');
    await cargarConceptos();
  } catch (e) { showToast(e.message, 'error'); }
}

async function cargarConfiguracion() {
  try {
    const c = await requestJson('/api/finanzas/configuracion');
    setValue('fin-config-nombre', c.institucion_nombre || '');
    setValue('fin-config-tipo-id', c.tipo_identificacion || '02');
    setValue('fin-config-numero-id', c.numero_identificacion || '');
    setValue('fin-config-correo', c.correo || '');
  } catch {}
}

async function guardarConfiguracion(event) {
  event.preventDefault();
  try {
    await requestJson('/api/finanzas/configuracion', { method: 'PUT', body: JSON.stringify({
      institucion_nombre: value('fin-config-nombre'), tipo_identificacion: value('fin-config-tipo-id'),
      numero_identificacion: value('fin-config-numero-id'), correo: value('fin-config-correo')
    }) });
    hideModal('modalConfigFacturacion');
    showToast('Configuración de facturación actualizada.', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

function renderFactura(r) {
  if (r.id_factura_externa) return `<span class="invoice-chip"><i class="bi bi-receipt-cutoff"></i> ${esc(r.id_factura_externa)}</span>`;
  if (r.estado_factura === 'error') return '<span class="badge text-bg-danger">Error</span>';
  if (r.estado_factura === 'pendiente_datos') return '<span class="badge text-bg-warning">Faltan datos</span>';
  if (r.estado_factura === 'pendiente_configuracion') return '<span class="badge text-bg-warning">Configurar</span>';
  return '<span class="text-muted">—</span>';
}

function badgeEstado(estado, vencimiento) {
  const vencido = vencimiento && new Date(`${String(vencimiento).slice(0,10)}T23:59:59`) < new Date() && estado !== 'pagado';
  if (vencido) return '<span class="badge rounded-pill text-bg-danger">Vencido</span>';
  const map = { pendiente: 'warning', parcial: 'info', pagado: 'success', anulado: 'secondary' };
  return `<span class="badge rounded-pill text-bg-${map[estado] || 'secondary'}">${esc(cap(estado))}</span>`;
}

function nombreEstudiante(e) { return `${e.nombre || ''} ${e.apellido1 || ''} ${e.apellido2 || ''}`.replace(/\s+/g,' ').trim(); }
function moneda(v) { return new Intl.NumberFormat('es-CR',{style:'currency',currency:'CRC',maximumFractionDigits:2}).format(Number(v||0)); }
function fechaHora(v) { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CR'); }
function etiquetaMetodo(v) { return ({efectivo:'Efectivo',tarjeta:'Tarjeta',sinpe:'SINPE',transferencia:'Transferencia',otro:'Otro'})[v] || cap(v); }
function cap(v) { const s=String(v||''); return s ? s[0].toUpperCase()+s.slice(1) : '—'; }
function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function value(id) { return document.getElementById(id)?.value ?? ''; }
function setValue(id,v) { const e=document.getElementById(id); if(e) e.value=v ?? ''; }
function text(id,v) { const e=document.getElementById(id); if(e) e.textContent=String(v); }
function showModal(id) { const el=document.getElementById(id); if(el && window.bootstrap?.Modal) (window.bootstrap.Modal.getInstance(el)||new window.bootstrap.Modal(el)).show(); }
function hideModal(id) { const el=document.getElementById(id); if(el && window.bootstrap?.Modal) window.bootstrap.Modal.getInstance(el)?.hide(); }
function debounce(fn,ms){let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>fn(...args),ms);};}
