import express from "express";
import { login } from "../controllers/authController.js";
import { loginRules } from "../validators/authValidator.js";
import { validarCampos } from "../middleware/validationMiddleware.js";

const router = express.Router();

router.post("/login", loginRules, validarCampos, login);

export default router;