import { validationResult } from "express-validator";

export const validarCampos = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            mensaje: "Datos inválidos.",
            errores: errors.array().map(({ param, msg, value }) => ({
                campo: param,
                mensaje: msg,
                valor: value
            }))
        });
    }

    next();
};
