import { Router } from "express";
import { getSecciones, createSeccion, deleteSeccion } from "../controllers/seccionController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, getSecciones);
router.post("/", requireAuth, requireRole("Administrador", "Asistente"), createSeccion);
router.delete("/:id", requireAuth, requireRole("Administrador"), deleteSeccion);
//cambios git
export default router;