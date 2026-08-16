import { apiFetch, showToast } from './ui.js';

let conceptos = [];
let estudiantes = [];
let cargos = [];
let pagos = [];
let profesores = [];
let clasesExtra = [];
let estadoCuentas = [];

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

  const resultados = await Promise.allSettled([
    cargarEstudiantes(),
    cargarResumen(),
    cargarConceptos(),
    cargarCargos(),
    cargarPagos(),
    cargarEstadoCuentas(),
    esAdmin() ? cargarConfiguracion() : Promise.resolve()
  ]);

  const fallos = resultados.filter((r) => r.status === 'rejected');
  if (fallos.length) {
    console.error('EduControl Finanzas: algunas secciones no pudieron cargar:', fallos.map(f => f.reason));
    showToast('Se cargó la información financiera disponible. Usa Refrescar si algún bloque tarda en aparecer.', 'warning');
  }

  await Promise.allSettled([
    cargarProfesoresExtra(),
    cargarClasesExtra()
  ]);
}

function wirePagosEvents() {
  wire('fin-refrescar', 'click', loadPagosData);
  wire('fin-busqueda', 'input', debounce(cargarCargos, 250));
  wire('fin-filtro-estado', 'change', cargarCargos);
  wire('fin-cargo-form', 'submit', guardarCargo);
  wire('fin-pago-form', 'submit', guardarPago);
  wire('fin-editar-cargo-form', 'submit', guardarEdicionCargo);
  wire('fin-editar-pago-form', 'submit', guardarEdicionPago);
  wire('fin-concepto-form', 'submit', guardarConcepto);
  wire('fin-concepto-existente', 'change', seleccionarConceptoExistente);
  wire('fin-config-form', 'submit', guardarConfiguracion);
  wire('fin-cargo-concepto', 'change', sincronizarConceptoCargo);
  wire('fin-clase-extra-form', 'submit', guardarClaseExtra);
  wire('fin-extra-profesor', 'change', comprobarDisponibilidadExtra);
  wire('fin-extra-fecha', 'change', comprobarDisponibilidadExtra);

  const body = document.getElementById('fin-cargos-body');
  if (body && !body.dataset.wired) {
    body.dataset.wired = '1';
    body.addEventListener('click', async (event) => {
      const pagar = event.target.closest('[data-fin-pagar]');
      const facturar = event.target.closest('[data-fin-facturar]');
      const editar = event.target.closest('[data-fin-editar-cargo]');
      if (editar) abrirEdicionCargo(Number(editar.dataset.finEditarCargo));
      if (pagar) await abrirPago(Number(pagar.dataset.finPagar));
      if (facturar) await reintentarFactura(Number(facturar.dataset.finFacturar));
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

  const extra = document.getElementById('fin-extra-estudiante');
  if (extra) {
    const actual = extra.value;
    extra.innerHTML = '<option value="">Seleccionar estudiante</option>';
    ordenar(estudiantes).forEach((e) => {
      const contexto = e.nombre_grupo ? ` · ${e.nombre_grupo}` : ' · Pre-registro';
      extra.add(new Option(`${nombreEstudiante(e)}${contexto}`, e.id_estudiante));
    });
    if ([...extra.options].some(o => o.value === actual)) extra.value = actual;
  }
}


async function cargarEstadoCuentas() {
  estadoCuentas = await requestJson('/api/finanzas/estado-cuentas');
  const body = document.getElementById('fin-estado-cuentas-body');
  if (!body) return;

  if (!estadoCuentas.length) {
    body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay estudiantes con información financiera registrada.</td></tr>';
    return;
  }

  body.innerHTML = estadoCuentas.map((e) => {
    const pendiente = Number(e.saldo_pendiente || 0);
    const pagado = Number(e.total_pagado || 0);
    let situacion = '<span class="badge rounded-pill account-status neutral">Sin movimientos</span>';
    if (pendiente > 0 && pagado > 0) situacion = '<span class="badge rounded-pill account-status partial">Pago parcial</span>';
    else if (pendiente > 0) situacion = '<span class="badge rounded-pill account-status pending">Pendiente</span>';
    else if (Number(e.total_cargos || 0) > 0) situacion = '<span class="badge rounded-pill account-status paid">Al día</span>';

    return `<tr>
      <td><strong>${esc(e.estudiante_nombre)}</strong><div class="small text-muted">ID ${e.id_estudiante}</div></td>
      <td>${situacion}</td>
      <td>${Number(e.total_cargos || 0)}</td>
      <td class="fw-semibold text-success-emphasis">${moneda(e.total_pagado)}</td>
      <td class="fw-semibold ${pendiente > 0 ? 'text-danger-emphasis' : 'text-muted'}">${moneda(pendiente)}</td>
      <td>${e.ultimo_pago ? esc(fechaHora(e.ultimo_pago)) : '<span class="text-muted">—</span>'}</td>
    </tr>`;
  }).join('');
}

async function cargarProfesoresExtra() {
  profesores = await requestJson('/api/profesores');
  const select = document.getElementById('fin-extra-profesor');
  if (!select) return;
  select.innerHTML = '<option value="">Seleccionar profesor</option>';
  profesores
    .filter((p) => p.estado == 1 || p.estado === true)
    .sort((a,b) => `${a.nombre} ${a.apellido1}`.localeCompare(`${b.nombre} ${b.apellido1}`))
    .forEach((p) => {
      select.add(new Option(`${p.nombre} ${p.apellido1} · ${p.materia || 'Sin materia'}`, p.id_profesor ?? p.id));
    });

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

    const r = await requestJson('/api/finanzas/clases-extra', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    hideModal('modalClaseExtra');
    event.currentTarget.reset();
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
  }
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
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Aún no hay pagos registrados.</td></tr>';
    return;
  }
  pagos.slice(0, 30).forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(fechaHora(p.fecha_pago))}</td><td>${esc(p.estudiante_nombre)}</td><td>${esc(p.descripcion)}</td><td>${esc(etiquetaMetodo(p.metodo_pago))}</td><td class="fw-semibold">${moneda(p.monto)}</td><td>${renderFactura(p)}</td><td class="text-end">${p.id_factura_externa ? '<span class="text-muted small">Bloqueado</span>' : `<button class="btn btn-sm btn-outline-secondary" data-fin-editar-pago="${p.id_pago}"><i class="bi bi-pencil"></i></button>`}</td>`;
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
        <button class="btn btn-sm btn-outline-secondary" data-fin-editar-cargo="${c.id_cargo}"><i class="bi bi-pencil"></i> Modificar</button>
        ${puedePagar ? `<button class="btn btn-sm btn-success" data-fin-pagar="${c.id_cargo}"><i class="bi bi-cash"></i> Pagar</button>` : ''}
        ${requiereFactura ? `<button class="btn btn-sm btn-outline-primary" data-fin-facturar="${c.id_cargo}"><i class="bi bi-receipt"></i> Facturar</button>` : ''}
      </div></td>`;
    body.appendChild(tr);
  });
}

function abrirEdicionCargo(idCargo) {
  const c = cargos.find(x => Number(x.id_cargo) === Number(idCargo));
  if (!c) return;
  setValue('fin-edit-cargo-id', c.id_cargo);
  setValue('fin-edit-cargo-monto', Number(c.monto_base || 0));
  setValue('fin-edit-cargo-descuento', Number(c.descuento || 0));
  setValue('fin-edit-cargo-vencimiento', c.fecha_vencimiento ? String(c.fecha_vencimiento).slice(0,10) : '');
  setValue('fin-edit-cargo-periodo', c.periodo || '');
  setValue('fin-edit-cargo-descripcion', c.descripcion || '');
  const ctx = document.getElementById('fin-edit-cargo-contexto');
  if (ctx) ctx.innerHTML = `<strong>${esc(c.estudiante_nombre)}</strong><span>${esc(c.concepto_nombre)}</span><span>Pagado: ${moneda(Number(c.total||0)-Number(c.saldo||0))}</span>`;
  showModal('modalEditarCargo');
}

async function guardarEdicionCargo(event) {
  event.preventDefault();
  const id = Number(value('fin-edit-cargo-id'));
  try {
    await requestJson(`/api/finanzas/cargos/${id}`, { method:'PUT', body:JSON.stringify({
      monto_base:value('fin-edit-cargo-monto'), descuento:value('fin-edit-cargo-descuento') || 0,
      fecha_vencimiento:value('fin-edit-cargo-vencimiento') || null, periodo:value('fin-edit-cargo-periodo'), descripcion:value('fin-edit-cargo-descripcion')
    })});
    hideModal('modalEditarCargo');
    showToast('Cargo actualizado correctamente.', 'success');
    await loadPagosData();
  } catch(e) { showToast(e.message,'error'); }
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
function moneda(v) { return `CRC ${new Intl.NumberFormat('es-CR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(v||0))}`; }
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
