import { query } from "express-validator";

const validarRangoFechas = (fechaInicio, { req }) => {
    const inicio = req.query?.fecha_inicio;
    const fin = req.query?.fecha_fin;

    if (!inicio || !fin) {
        return true;
    }

    if (new Date(inicio) > new Date(fin)) {
        throw new Error("La fecha de inicio no puede ser mayor que la fecha fin.");
    }

    return true;
};

export const reporteRules = [
    query("fecha_inicio")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("La fecha de inicio debe tener un formato válido (YYYY-MM-DD)."),
    query("fecha_fin")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("La fecha fin debe tener un formato válido (YYYY-MM-DD)."),
    query("id_grupo")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage("El grupo debe ser un identificador válido."),
    query("estado_asistencia")
        .optional({ nullable: true })
        .isIn(["presente", "ausente", "tardia", "justificada"])
        .withMessage("El estado de asistencia debe ser presente, ausente, tardia o justificada."),
    query("tipo_reporte")
        .optional({ nullable: true })
        .isIn(["resumen", "detalle"])
        .withMessage("El tipo de reporte debe ser resumen o detalle."),
    query().custom(validarRangoFechas)
];
