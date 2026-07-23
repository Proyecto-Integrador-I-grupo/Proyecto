import conexion, { queryConSesion } from "../config/database.js";

// Roles que tienen permitido iniciar sesión en el panel administrativo
export const ROLES_PERMITIDOS = ["administrador", "asistente"];

// Buscar un usuario (activo) por correo, junto con su rol y su nombre de persona
export const obtenerUsuarioPorCorreo = async (correo) => {

    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.contrasena,
            u.estado,
            r.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.correo = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(sql, [correo]);

    return rows[0];

};
export const obtenerUsuarios = async () => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.estado,
            u.id_rol,
            r.nom_rol,
            u.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.estado = 1
        ORDER BY u.id_usuario;
    `;

    const [rows] = await conexion.query(sql);
    return rows;
};

export const crearUsuario = async (usuario, idUsuario) => {
    const sql = `
        INSERT INTO usuario
        (
            correo,
            contrasena,
            id_persona,
            id_rol,
            estado
        )
        VALUES (?, ?, ?, ?, ?);
    `;

    const resultado = await queryConSesion(sql, [
        usuario.correo,
        usuario.contrasena,
        usuario.id_persona,
        usuario.id_rol,
        usuario.estado ?? 1
    ], idUsuario);

    return resultado;
};

export const actualizarUsuario = async (id, usuario, idUsuario) => {
    const sql = `
        UPDATE usuario
        SET
            correo = ?,
            contrasena = ?,
            id_persona = ?,
            id_rol = ?,
            estado = ?
        WHERE id_usuario = ?;
    `;

    const resultado = await queryConSesion(sql, [
        usuario.correo,
        usuario.contrasena,
        usuario.id_persona,
        usuario.id_rol,
        usuario.estado,
        id
    ], idUsuario);

    return resultado;
};

export const eliminarUsuario = async (id, idUsuario) => {
    const sql = `
        UPDATE usuario
        SET estado = 0
        WHERE id_usuario = ?;
    `;

    const resultado = await queryConSesion(sql, [id], idUsuario);
    return resultado;
};
// Buscar un usuario por ID (para validar la sesión en cada petición)
export const obtenerUsuarioPorId = async (id) => {

    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.estado,
            r.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.id_usuario = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(sql, [id]);

    return rows[0];

};