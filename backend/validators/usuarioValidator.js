import { body, param } from "express-validator";

export const idParam = [
    param("id")
        .exists({ checkFalsy: true }).withMessage("El ID es obligatorio.")
        .isInt({ gt: 0 }).withMessage("El ID debe ser un número entero positivo.")
        .toInt()
];

export const usuarioCreateRules = [
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
        .isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres."),
    body("nombre")
        .exists({ checkFalsy: true }).withMessage("El nombre es obligatorio.")
        .isString().withMessage("El nombre debe ser texto.")
        .trim(),
    body("primer_apellido")
        .exists({ checkFalsy: true }).withMessage("El primer apellido es obligatorio.")
        .isString().withMessage("El primer apellido debe ser texto.")
        .trim(),
    body("id_rol")
        .exists({ checkFalsy: true }).withMessage("El ID de rol es obligatorio.")
        .isInt({ gt: 0 }).withMessage("El ID de rol debe ser un número entero positivo.")
        .toInt(),
    body("estado")
        .optional()
        .isBoolean().withMessage("El estado debe ser verdadero o falso.")
        .toBoolean()
];

export const usuarioUpdateRules = [
    body("correo")
        .optional({ nullable: true })
        .isString().withMessage("El correo debe ser texto.")
        .trim()
        .isEmail().withMessage("El correo no es válido.")
        .normalizeEmail(),
    body("contrasena")
        .optional({ nullable: true })
        .isString().withMessage("La contraseña debe ser texto.")
        .trim()
        .isLength({ min: 8 }).withMessage("La contraseña debe tener al menos 8 caracteres."),
    body("id_persona")
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage("El ID de persona debe ser un número entero positivo.")
        .toInt(),
    body("id_rol")
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage("El ID de rol debe ser un número entero positivo.")
        .toInt(),
    body("estado")
        .optional()
        .isBoolean().withMessage("El estado debe ser verdadero o falso.")
        .toBoolean()
];