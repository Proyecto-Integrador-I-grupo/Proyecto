import { body } from "express-validator";

export const loginRules = [
    body("correo")
        .exists({ checkFalsy: true }).withMessage("El correo es obligatorio.")
        .isString().withMessage("El correo debe ser texto.")
        .trim()
        .isEmail().withMessage("El correo no es válido.")
        .normalizeEmail(),
    body("contrasena")
        .exists({ checkFalsy: true }).withMessage("La contraseña es obligatoria.")
        .isString().withMessage("La contraseña debe ser texto.")
        .trim()
        .isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres.")
];
