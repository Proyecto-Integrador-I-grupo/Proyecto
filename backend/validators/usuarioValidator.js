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
        .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres."),
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
    body("nombre")
        .optional({ nullable: true })
        .isString().withMessage("El nombre debe ser texto.")
        .trim()
        .isLength({ min: 1, max: 80 }).withMessage("El nombre debe contener entre 1 y 80 caracteres."),
    body("primer_apellido")
        .optional({ nullable: true })
        .isString().withMessage("El primer apellido debe ser texto.")
        .trim()
        .isLength({ min: 1, max: 80 }).withMessage("El primer apellido debe contener entre 1 y 80 caracteres."),
    body("apellido1")
        .optional({ nullable: true })
        .isString().withMessage("El primer apellido debe ser texto.")
        .trim()
        .isLength({ min: 1, max: 80 }).withMessage("El primer apellido debe contener entre 1 y 80 caracteres."),
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
        .isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres."),
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