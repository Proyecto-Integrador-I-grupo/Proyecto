import { Router } from "express";
import { getSecciones, createSeccion } from "../controllers/seccionController.js";

const router = Router();

router.get("/", getSecciones);
router.post("/", createSeccion);

export default router;