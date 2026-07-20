import conexion from "../config/database.js";

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