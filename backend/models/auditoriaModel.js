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
            a.fecha_modificacion,
            a.id_usuario,
            u.correo AS usuario_correo,
            CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS usuario_nombre
        FROM auditoria a
        LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
        LEFT JOIN persona p ON p.id_persona = u.id_persona
        ORDER BY a.fecha_creacion DESC;
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
            a.fecha_modificacion,
            a.id_usuario,
            u.correo AS usuario_correo,
            CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS usuario_nombre
        FROM auditoria a
        LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
        LEFT JOIN persona p ON p.id_persona = u.id_persona
        WHERE a.id_auditoria = ?
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

    // Las columnas datos_anteriores/datos_nuevos son de tipo JSON en MySQL.
    // Un string vacío ("") NO es JSON válido y hace fallar el INSERT, así que
    // cualquier valor vacío/nulo debe guardarse como NULL real, nunca como "".
    const datosAnteriores = auditoria.datos_anteriores ? auditoria.datos_anteriores : null;
    const datosNuevos = auditoria.datos_nuevos ? auditoria.datos_nuevos : null;

    const resultado = await queryConSesion(sql, [

        auditoria.nombre_tabla,
        auditoria.accion_usuario,
        datosAnteriores,
        datosNuevos,
        idUsuario

    ], idUsuario);

    return resultado;

};