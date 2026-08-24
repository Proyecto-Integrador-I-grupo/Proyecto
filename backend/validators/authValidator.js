import { body } from "express-validator";

export const loginRules = [
    body("correo")
        .exists({ checkFalsy: true }).withMessage("El correo es obligatorio.")
        .isString().withMessage("El correo debe ser texto.")
        .trim()
        .isEmail().withMessage("El correo no es válido.")
        .isLength({ max: 150 }).withMessage("El correo no puede superar 150 caracteres.")
        .normalizeEmail(),
    body("contrasena")
        .exists({ checkFalsy: true }).withMessage("La contraseña es obligatoria.")
        .isString().withMessage("La contraseña debe ser texto.")
        .trim()
        .isLength({ min: 6, max: 128 }).withMessage("La contraseña debe tener entre 6 y 128 caracteres.")
];
