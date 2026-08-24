import express from "express";
import { login } from "../controllers/authController.js";
import { loginRules } from "../validators/authValidator.js";
import { validarCampos } from "../middleware/validationMiddleware.js";
import { loginRateLimit } from "../middleware/loginRateLimit.js";

const router = express.Router();

router.post("/login", loginRateLimit, loginRules, validarCampos, login);

export default router;