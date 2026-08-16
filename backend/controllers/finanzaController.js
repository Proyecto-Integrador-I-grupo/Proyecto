import * as finanzaService from "../services/finanzaService.js";
import {
  obtenerConfiguracionFacturacion,
  actualizarConfiguracionFacturacion
} from "../services/facturacionIntegrationService.js";

function responderError(res, error, status = 400) {
  console.error("Finanzas:", error);
  res.status(status).json({ mensaje: error.message || "No se pudo completar la operación." });
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

export async function postCargo(req, res) {
  try {
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
  try { res.json(await finanzaService.actualizarCargo(req.params.id, req.body)); }
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


export async function getClasesExtra(req, res) {
  try { res.json(await finanzaService.listarClasesExtra()); }
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
  try { res.json((await obtenerConfiguracionFacturacion()) || {}); }
  catch (e) { responderError(res, e, 500); }
}

export async function putConfiguracion(req, res) {
  try { res.json(await actualizarConfiguracionFacturacion(req.body)); }
  catch (e) { responderError(res, e); }
}
