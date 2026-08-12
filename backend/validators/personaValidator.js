import { body, param } from "express-validator";

const EDAD_MINIMA = 3;
const EDAD_MAXIMA = 120;
const GENEROS_VALIDOS = ["M", "F", "O"];

const validarFechaNacimiento = (fechaValor) => {
    const fecha = new Date(fechaValor);

    if (Number.isNaN(fecha.getTime())) {
        throw new Error("La fecha de nacimiento debe ser una fecha válida.");
    }

    const hoy = new Date();
    const fechaSinHora = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

    if (fechaSinHora > hoy) {
        throw new Error("La fecha de nacimiento no puede ser posterior a hoy.");
    }

    let edad = hoy.getFullYear() - fecha.getFullYear();
    const ajusteMes = hoy.getMonth() - fecha.getMonth();
    const ajusteDia = hoy.getDate() - fecha.getDate();

    if (ajusteMes < 0 || (ajusteMes === 0 && ajusteDia < 0)) {
        edad -= 1;
    }

    if (edad < EDAD_MINIMA || edad > EDAD_MAXIMA) {
        throw new Error(`La edad debe ser entre ${EDAD_MINIMA} y ${EDAD_MAXIMA} años.`);
    }

    return true;
};

export const idPersonaParam = [
    param("id")
        .exists({ checkFalsy: true }).withMessage("El ID de persona es obligatorio.")
        .isInt({ gt: 0 }).withMessage("El ID de persona debe ser un número entero positivo.")
        .toInt()
];

export const personaRules = [
    body("nombre")
        .exists({ checkFalsy: true }).withMessage("El nombre es obligatorio.")
        .isString().withMessage("El nombre debe ser texto.")
        .trim()
        .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres."),
    body("apellido1")
        .exists({ checkFalsy: true }).withMessage("El apellido 1 es obligatorio.")
        .isString().withMessage("El apellido 1 debe ser texto.")
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage("El apellido 1 debe tener entre 2 y 100 caracteres."),
    body("apellido2")
        .optional({ nullable: true })
        .isString().withMessage("El apellido 2 debe ser texto.")
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage("El apellido 2 debe tener entre 2 y 100 caracteres."),
    body("fecha_nacimiento")
        .exists({ checkFalsy: true }).withMessage("La fecha de nacimiento es obligatoria.")
        .isISO8601().withMessage("La fecha de nacimiento debe tener un formato válido (YYYY-MM-DD)." )
        .bail()
        .custom(validarFechaNacimiento),
    body("genero")
        .exists({ checkFalsy: true }).withMessage("El género es obligatorio.")
        .isIn(GENEROS_VALIDOS).withMessage("El género debe ser M, F u O.")
];
