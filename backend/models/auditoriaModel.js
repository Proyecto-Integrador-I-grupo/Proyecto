import conexion, { queryConSesion } from "../config/database.js";

// Obtener todas las auditorías
export const obtenerAuditorias = async () => {

    const sql = `
        SELECT
            id_auditoria,
            nombre_tabla,
            accion_usuario,
            datos_anteriores,
            datos_nuevos,
            fecha_creacion,
            fecha_modificacion,
            id_usuario
        FROM auditoria
        ORDER BY fecha_creacion DESC;
    `;

    const [rows] = await conexion.query(sql);

    return rows;

};


// Obtener auditoría por ID
export const obtenerAuditoriaPorId = async (id) => {

    const sql = `
        SELECT
            id_auditoria,
            nombre_tabla,
            accion_usuario,
            datos_anteriores,
            datos_nuevos,
            fecha_creacion,
            fecha_modificacion,
            id_usuario
        FROM auditoria
        WHERE id_auditoria = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(sql, [id]);

    return rows[0];

};


// Registrar una entrada de auditoría
export const crearAuditoria = async (auditoria, idUsuario) => {

    const sql = `
        INSERT INTO auditoria
        (
            nombre_tabla,
            accion_usuario,
            datos_anteriores,
            datos_nuevos,
            fecha_creacion,
            fecha_modificacion,
            id_usuario
        )
        VALUES (?, ?, ?, ?, NOW(), NOW(), ?);
    `;

    const resultado = await queryConSesion(sql, [

        auditoria.nombre_tabla,
        auditoria.accion_usuario,
        auditoria.datos_anteriores ?? "",
        auditoria.datos_nuevos ?? "",
        idUsuario

    ], idUsuario);

    return resultado;

};