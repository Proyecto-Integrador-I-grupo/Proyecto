import { Router } from "express";
import { getSecciones, createSeccion, deleteSeccion, getPeriodos, putPeriodo } from "../controllers/seccionController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, getSecciones);
router.get("/periodos", requireAuth, getPeriodos);
router.put("/periodos/:anio", requireAuth, requireRole("Administrador"), putPeriodo);
router.post("/", requireAuth, requireRole("Administrador", "Asistente"), createSeccion);
router.delete("/:id", requireAuth, requireRole("Administrador"), deleteSeccion);
//cambios git
export default router;