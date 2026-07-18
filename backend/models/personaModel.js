import conexion from "../config/database.js";

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
        FROM tb_persona
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
        FROM tb_persona
        WHERE id_persona = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(sql, [id]);

    return rows[0];

};


// Registrar una persona
export const crearPersona = async (persona) => {

    const sql = `
        INSERT INTO tb_persona
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

    const [resultado] = await conexion.query(sql, [

        persona.nombre,
        persona.apellido1,
        persona.apellido2,
        persona.fecha_nacimiento,
        persona.genero,
        1

    ]);

    return resultado;

};


// Actualizar una persona
export const actualizarPersona = async (id, persona) => {

    const sql = `
        UPDATE tb_persona
        SET
            nombre = ?,
            apellido1 = ?,
            apellido2 = ?,
            fecha_nacimiento = ?,
            genero = ?
        WHERE id_persona = ?;
    `;

    const [resultado] = await conexion.query(sql, [

        persona.nombre,
        persona.apellido1,
        persona.apellido2,
        persona.fecha_nacimiento,
        persona.genero,
        id

    ]);

    return resultado;

};


// Eliminar una persona (Borrado lógico)
export const eliminarPersona = async (id) => {

    const sql = `
        UPDATE tb_persona
        SET estado = 0
        WHERE id_persona = ?;
    `;

    const [resultado] = await conexion.query(sql, [id]);

    return resultado;

};