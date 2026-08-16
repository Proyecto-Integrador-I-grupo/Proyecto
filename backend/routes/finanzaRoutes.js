import express from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getResumen, getConceptos, postConcepto, putConcepto,
  getCargos, postCargo, putCargo, getPagos, getEstadoCuentas, getEstudiantesFinanzas, postPago, putPago, postFacturar, getResponsable, getEstadoMatricula,
  getConfiguracion, putConfiguracion, getClasesExtra, getDisponibilidadClaseExtra, postClaseExtra
} from "../controllers/finanzaController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/resumen", requireRole("administrador", "asistente"), getResumen);
router.get("/conceptos", requireRole("administrador", "asistente"), getConceptos);
router.post("/conceptos", requireRole("administrador"), postConcepto);
router.put("/conceptos/:id", requireRole("administrador"), putConcepto);

router.get("/cargos", requireRole("administrador", "asistente"), getCargos);
router.post("/cargos", requireRole("administrador", "asistente"), postCargo);
router.put("/cargos/:id", requireRole("administrador", "asistente"), putCargo);
router.get("/estudiantes/:id/estado-matricula", requireRole("administrador", "asistente"), getEstadoMatricula);
router.get("/responsables/:id", requireRole("administrador", "asistente"), getResponsable);
router.get("/pagos", requireRole("administrador", "asistente"), getPagos);
router.get("/estado-cuentas", requireRole("administrador", "asistente"), getEstadoCuentas);
router.get("/estudiantes", requireRole("administrador", "asistente"), getEstudiantesFinanzas);
router.post("/cargos/:id/pagar", requireRole("administrador", "asistente"), postPago);
router.put("/pagos/:id", requireRole("administrador", "asistente"), putPago);
router.post("/cargos/:id/facturar", requireRole("administrador", "asistente"), postFacturar);
router.get("/clases-extra", requireRole("administrador", "asistente"), getClasesExtra);
router.get("/profesores/:id/disponibilidad-extra", requireRole("administrador", "asistente"), getDisponibilidadClaseExtra);
router.post("/clases-extra", requireRole("administrador", "asistente"), postClaseExtra);

router.get("/configuracion", requireRole("administrador"), getConfiguracion);
router.put("/configuracion", requireRole("administrador"), putConfiguracion);

export default router;
