import express from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import {
  getResumen, getConceptos, postConcepto, putConcepto,
  getCargos, postCargo, getPagos, postPago, postFacturar, getResponsable,
  getConfiguracion, putConfiguracion
} from "../controllers/finanzaController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/resumen", requireRole("administrador", "asistente"), getResumen);
router.get("/conceptos", requireRole("administrador", "asistente"), getConceptos);
router.post("/conceptos", requireRole("administrador"), postConcepto);
router.put("/conceptos/:id", requireRole("administrador"), putConcepto);

router.get("/cargos", requireRole("administrador", "asistente"), getCargos);
router.post("/cargos", requireRole("administrador", "asistente"), postCargo);
router.get("/responsables/:id", requireRole("administrador", "asistente"), getResponsable);
router.get("/pagos", requireRole("administrador", "asistente"), getPagos);
router.post("/cargos/:id/pagar", requireRole("administrador", "asistente"), postPago);
router.post("/cargos/:id/facturar", requireRole("administrador", "asistente"), postFacturar);

router.get("/configuracion", requireRole("administrador"), getConfiguracion);
router.put("/configuracion", requireRole("administrador"), putConfiguracion);

export default router;
