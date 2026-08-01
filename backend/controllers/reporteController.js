import { generarReporteResumen, generarReporteDetalle } from "../services/reporteService.js";

export async function obtenerReporteResumen(req, res) {
    try {
        const resultado = await generarReporteResumen(req.query);
        res.status(200).json(resultado);
    } catch (error) {
        console.error(error);
        res.status(400).json({
            mensaje: error.message || "No se pudo generar el reporte de resumen."
        });
    }
}

export async function obtenerReporteDetalle(req, res) {
    try {
        const resultado = await generarReporteDetalle(req.query);
        res.status(200).json(resultado);
    } catch (error) {
        console.error(error);
        res.status(400).json({
            mensaje: error.message || "No se pudo generar el detalle del reporte."
        });
    }
}
