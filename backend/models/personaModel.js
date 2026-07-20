import conexion, { queryConSesion } from "../config/database.js";

// Obtener todas las personas
export const obtenerPersonas = async () => {

    const sql = `
        SELECT
            id_persona,
            nombre,
            apellido1,
            apellido2,
            fecha_nacimiento,
            genero,
            estado
        FROM persona
        WHERE estado = 1
        ORDER BY id_persona;
    `;

    const [rows] = await conexion.query(sql);

    return rows;
};


// Obtener una persona por ID
export const obtenerPersonaPorId = async (id) => {

    const sql = `
        SELECT
            id_persona,
            nombre,
            apellido1,
            apellido2,
            fecha_nacimiento,
            genero,
            estado
        FROM persona
        WHERE id_persona = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(sql, [id]);

    return rows[0];

};


// Registrar una persona
export const crearPersona = async (persona, idUsuario) => {

    const sql = `
        INSERT INTO persona
        (
            nombre,
            apellido1,
            apellido2,
            fecha_nacimiento,
            genero,
            estado
        )
        VALUES (?, ?, ?, ?, ?, ?);
    `;

    const resultado = await queryConSesion(sql, [

        persona.nombre,
        persona.apellido1,
        persona.apellido2,
        persona.fecha_nacimiento,
        persona.genero,
        1

    ], idUsuario);

    return resultado;

};


// Actualizar una persona
export const actualizarPersona = async (id, persona, idUsuario) => {

    const sql = `
        UPDATE persona
        SET
            nombre = ?,
            apellido1 = ?,
            apellido2 = ?,
            fecha_nacimiento = ?,
            genero = ?
        WHERE id_persona = ?;
    `;

    const resultado = await queryConSesion(sql, [

        persona.nombre,
        persona.apellido1,
        persona.apellido2,
        persona.fecha_nacimiento,
        persona.genero,
        id

    ], idUsuario);

    return resultado;

};


// Eliminar una persona (Borrado lógico)
export const eliminarPersona = async (id, idUsuario) => {

    const sql = `
        UPDATE persona
        SET estado = 0
        WHERE id_persona = ?;
    `;

    const resultado = await queryConSesion(sql, [id], idUsuario);

    return resultado;

};