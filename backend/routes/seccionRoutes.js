import { Router } from "express";
import { getSecciones, createSeccion, deleteSeccion } from "../controllers/seccionController.js";

const router = Router();

router.get("/", getSecciones);
router.post("/", createSeccion);
router.delete("/:id", deleteSeccion);

export default router;