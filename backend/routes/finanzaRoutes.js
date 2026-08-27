import express from "express";
import { requireAuth, requireRole, requirePermission } from "../middleware/authMiddleware.js";
import {
  getResumen, getConceptos, postConcepto, putConcepto,
  getCargos, getFacturas, postCargo, putCargo, getPagos, getEstadoCuentas, getEstudiantesFinanzas, postPago, putPago, postFacturar, getResponsable, getEstadoMatricula,
  getConfiguracion, putConfiguracion, getClasesExtra, getProfesoresExtra, getDisponibilidadClaseExtra, getEstudiantesProfesorExtra, postClaseExtra,
  getEstadoIntegraciones, getDocumentoFactura, getDocumentoElectronico, getDocumentosIntegrados, postConfirmarFacturaCliente, postIniciarPagoBanco, postConfirmarPagoBanco, postResultadoPagoBanco, postVincularFacturaSmart
} from "../controllers/finanzaController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/resumen", requireRole("administrador", "asistente"), getResumen);
router.get("/conceptos", requireRole("administrador", "asistente"), getConceptos);
router.post("/conceptos", requireRole("administrador"), postConcepto);
router.put("/conceptos/:id", requireRole("administrador"), putConcepto);

router.get("/cargos", requireRole("administrador", "asistente"), getCargos);
router.get("/facturas", requireRole("administrador", "asistente"), getFacturas);
router.post("/cargos", requirePermission("finanzas.crear_cargo"), postCargo);
router.put("/cargos/:id", requirePermission("finanzas.modificar_cargo"), putCargo);
router.get("/estudiantes/:id/estado-matricula", requireRole("administrador", "asistente"), getEstadoMatricula);
router.get("/responsables/:id", requireRole("administrador", "asistente"), getResponsable);
router.get("/pagos", requireRole("administrador", "asistente"), getPagos);
router.get("/estado-cuentas", requireRole("administrador", "asistente"), getEstadoCuentas);
router.get("/estudiantes", requireRole("administrador", "asistente"), getEstudiantesFinanzas);
router.post("/cargos/:id/pagar", requirePermission("finanzas.registrar_pago"), postPago);
router.post("/cargos/:id/pago-banco/iniciar", requirePermission("finanzas.registrar_pago"), postIniciarPagoBanco);
router.post("/cargos/:id/pago-banco/confirmar", requirePermission("finanzas.registrar_pago"), postConfirmarPagoBanco);
router.post("/cargos/:id/pago-banco/resultado", requirePermission("finanzas.registrar_pago"), postResultadoPagoBanco);
router.put("/pagos/:id", requirePermission("finanzas.registrar_pago"), putPago);
router.post("/cargos/:id/facturar", requirePermission("finanzas.facturar_manual"), postFacturar);
router.post("/cargos/:id/factura-confirmar", requirePermission("finanzas.facturar_manual"), postConfirmarFacturaCliente);
router.get("/cargos/:id/documento", requireRole("administrador", "asistente"), getDocumentoFactura);
router.get("/cargos/:id/factura-electronica", requireRole("administrador", "asistente"), getDocumentoElectronico);
router.get("/cargos/:id/documentos-integrados", requireRole("administrador", "asistente"), getDocumentosIntegrados);
router.get("/clases-extra", requireRole("administrador", "asistente"), getClasesExtra);
router.get("/profesores-extra", requireRole("administrador", "asistente"), getProfesoresExtra);
router.get("/profesores/:id/estudiantes-extra", requireRole("administrador", "asistente"), getEstudiantesProfesorExtra);
router.get("/profesores/:id/disponibilidad-extra", requireRole("administrador", "asistente"), getDisponibilidadClaseExtra);
router.post("/clases-extra", requireRole("administrador", "asistente"), postClaseExtra);

router.get("/configuracion", requireRole("administrador"), getConfiguracion);
router.put("/configuracion", requireRole("administrador"), putConfiguracion);
router.get("/integraciones/estado", requireRole("administrador", "asistente"), getEstadoIntegraciones);
router.post("/integraciones/facturasmart/vincular", requireRole("administrador"), postVincularFacturaSmart);

export default router;
