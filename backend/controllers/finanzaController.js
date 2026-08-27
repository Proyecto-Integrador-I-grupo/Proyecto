import * as finanzaService from "../services/finanzaService.js";
import { usuarioTienePermiso } from "../models/usuarioModel.js";
import { iniciarPagoBanco, confirmarPagoBanco, registrarResultadoNoCompletadoBanco } from "../services/bankPaymentIntegrationService.js";
import {
  obtenerConfiguracionFacturacion,
  actualizarConfiguracionFacturacion,
  obtenerEstadoServiciosFacturacion,
  obtenerDocumentoDeCargo,
  confirmarFacturaGeneradaDesdeCliente,
  obtenerDocumentosIntegrados,
  vincularCuentaFacturaSmart,
  obtenerDocumentoElectronicoFacturaSmart
} from "../services/facturacionIntegrationService.js";

function responderError(res, error, status = 400) {
  const httpStatus = Number(error?.statusCode) || status;
  const mensaje = error?.message || "No se pudo completar la operación.";

  if (httpStatus >= 500) {
    console.error("Finanzas:", error);
  } else if (!error?.esperado) {
    console.warn(`Finanzas: ${mensaje}`);
  }

  res.status(httpStatus).json({
    mensaje,
    ...(error?.code ? { codigo: error.code } : {})
  });
}

export async function getResumen(req, res) {
  try { res.json(await finanzaService.obtenerResumenFinanciero()); }
  catch (e) { responderError(res, e, 500); }
}

export async function getConceptos(req, res) {
  try { res.json(await finanzaService.listarConceptos()); }
  catch (e) { responderError(res, e, 500); }
}

export async function postConcepto(req, res) {
  try { res.status(201).json(await finanzaService.crearConcepto(req.body)); }
  catch (e) { responderError(res, e); }
}

export async function putConcepto(req, res) {
  try { res.json(await finanzaService.actualizarConcepto(req.params.id, req.body)); }
  catch (e) { responderError(res, e); }
}

export async function getCargos(req, res) {
  try { res.json(await finanzaService.listarCargos(req.query)); }
  catch (e) { responderError(res, e, 500); }
}

export async function getFacturas(req, res) {
  try { res.json(await finanzaService.listarFacturas()); }
  catch (e) { responderError(res, e, 500); }
}

export async function postCargo(req, res) {
  try {
    const descuento = Number(req.body?.descuento || 0);
    const rol = String(req.usuarioActual?.rol || '').toLowerCase();
    if (descuento > 0 && rol !== 'administrador') {
      const permitido = await usuarioTienePermiso(req.usuarioActual?.id_usuario, 'finanzas.aplicar_descuento');
      if (!permitido) return res.status(403).json({ mensaje: 'No tienes permiso para crear cargos con descuento.' });
    }
    res.status(201).json(await finanzaService.crearCargo(req.body, req.usuarioActual?.id_usuario));
  } catch (e) { responderError(res, e); }
}

export async function getResponsable(req, res) {
  try { res.json((await finanzaService.obtenerResponsablePrincipal(req.params.id)) || {}); }
  catch (e) { responderError(res, e, 500); }
}

export async function getPagos(req, res) {
  try { res.json(await finanzaService.listarPagos(req.query)); }
  catch (e) { responderError(res, e, 500); }
}

export async function getEstudiantesFinanzas(req, res) {
  try { res.json(await finanzaService.listarEstudiantesFinanzas()); }
  catch (e) { responderError(res, e, 500); }
}

export async function getEstadoCuentas(req, res) {
  try { res.json(await finanzaService.listarEstadoCuentas()); }
  catch (e) { responderError(res, e, 500); }
}

export async function postPago(req, res) {
  try {
    res.status(201).json(
      await finanzaService.registrarPago(req.params.id, req.body, req.usuarioActual?.id_usuario)
    );
  } catch (e) { responderError(res, e); }
}


export async function getEstadoMatricula(req, res) {
  try { res.json(await finanzaService.obtenerEstadoFinancieroMatricula(req.params.id, req.query?.anio)); }
  catch (e) { responderError(res, e, 500); }
}

export async function putCargo(req, res) {
  try {
    const rol = String(req.usuarioActual?.rol || '').toLowerCase();
    if (req.body?.descuento !== undefined && rol !== 'administrador') {
      const permitido = await usuarioTienePermiso(req.usuarioActual?.id_usuario, 'finanzas.aplicar_descuento');
      if (!permitido) return res.status(403).json({ mensaje: 'No tienes permiso para aplicar o modificar descuentos.' });
    }
    res.json(await finanzaService.actualizarCargo(req.params.id, req.body, req.usuarioActual?.id_usuario));
  }
  catch (e) { responderError(res, e); }
}

export async function putPago(req, res) {
  try { res.json(await finanzaService.actualizarPago(req.params.id, req.body)); }
  catch (e) { responderError(res, e); }
}

export async function postFacturar(req, res) {
  try {
    res.json(await finanzaService.reintentarFactura(req.params.id, req.body?.metodo_pago || 'otro'));
  } catch (e) { responderError(res, e); }
}

export async function postConfirmarFacturaCliente(req, res) {
  try {
    res.json(await confirmarFacturaGeneradaDesdeCliente(req.params.id, req.body || {}));
  } catch (e) { responderError(res, e); }
}


export async function getClasesExtra(req, res) {
  try { res.json(await finanzaService.listarClasesExtra()); }
  catch (e) { responderError(res, e, 500); }
}


export async function getProfesoresExtra(req, res) {
  try { res.json(await finanzaService.listarProfesoresParaClaseExtra()); }
  catch (e) { responderError(res, e, 500); }
}

export async function getEstudiantesProfesorExtra(req, res) {
  try { res.json(await finanzaService.listarEstudiantesProfesorExtra(req.params.id)); }
  catch (e) { responderError(res, e, 500); }
}

export async function getDisponibilidadClaseExtra(req, res) {
  try { res.json(await finanzaService.obtenerDisponibilidadProfesorExtra(req.params.id, req.query?.fecha)); }
  catch (e) { responderError(res, e); }
}

export async function postClaseExtra(req, res) {
  try {
    res.status(201).json(await finanzaService.registrarClaseExtra(req.body, req.usuarioActual?.id_usuario));
  } catch (e) { responderError(res, e); }
}

export async function getConfiguracion(req, res) {
  try { res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"); res.json((await obtenerConfiguracionFacturacion()) || {}); }
  catch (e) { responderError(res, e, 500); }
}

export async function putConfiguracion(req, res) {
  try {
    let configuracion = await actualizarConfiguracionFacturacion(req.body);
    let facturasmartValidacion = null;

    // Guardar cambios es la única acción de persistencia. Si FacturaSmart ya
    // tiene correo y contraseña guardados, se valida automáticamente en el
    // mismo flujo y el estado queda persistido como Activo cuando el login es
    // correcto.
    if (configuracion?.factura_electronica_correo && configuracion?.factura_electronica_password_configurada) {
      try {
        const vinculacion = await vincularCuentaFacturaSmart();
        facturasmartValidacion = { ok: true, correo: vinculacion?.correo || configuracion.factura_electronica_correo };
      } catch (errorFacturaSmart) {
        facturasmartValidacion = { ok: false, error: errorFacturaSmart?.message || 'No se pudo validar la cuenta de FacturaSmart.' };
      }
      configuracion = await obtenerConfiguracionFacturacion();
    }

    res.json({ ...configuracion, facturasmart_validacion: facturasmartValidacion });
  }
  catch (e) { responderError(res, e); }
}


export async function getEstadoIntegraciones(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(await obtenerEstadoServiciosFacturacion());
  } catch (e) { responderError(res, e, 500); }
}

export async function postVincularFacturaSmart(req, res) {
  try { res.json(await vincularCuentaFacturaSmart()); }
  catch (e) { responderError(res, e, 502); }
}

export async function getDocumentosIntegrados(req, res) {
  try { res.json(await obtenerDocumentosIntegrados(req.params.id)); }
  catch (e) { responderError(res, e, 500); }
}

export async function getDocumentoFactura(req, res) {
  try {
    const documento = await obtenerDocumentoDeCargo(req.params.id, req.query?.formato || "pdf");
    res.setHeader("Content-Type", documento.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${documento.filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-EduControl-Document-Mode", documento.formatoEntregado || (documento.contentType?.includes('html') ? 'html' : 'pdf'));
    res.send(documento.buffer);
  } catch (e) { responderError(res, e, 502); }
}

export async function getDocumentoElectronico(req, res) {
  try {
    const documento = await obtenerDocumentoElectronicoFacturaSmart(req.params.id, req.query?.formato || 'xml');
    res.setHeader('Content-Type', documento.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${documento.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(documento.buffer);
  } catch (e) { responderError(res, e, 502); }
}

export async function postIniciarPagoBanco(req, res) {
  try {
    const origin = req.headers.origin || req.body?.origin || '';
    res.json(await iniciarPagoBanco(req.params.id, req.body || {}, req.usuarioActual?.id_usuario, origin));
  } catch (e) { responderError(res, e); }
}

export async function postConfirmarPagoBanco(req, res) {
  try {
    res.status(201).json(await confirmarPagoBanco(req.params.id, req.body || {}, req.usuarioActual?.id_usuario));
  } catch (e) { responderError(res, e); }
}

export async function postResultadoPagoBanco(req, res) {
  try { res.json(await registrarResultadoNoCompletadoBanco(req.params.id, req.body || {})); }
  catch (e) { responderError(res, e); }
}
