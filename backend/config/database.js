import mysql from "mysql2";

const conexion = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "1234",//cambiar la contraseña
    database: "sistema_escolar_db",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Probar la conexión
conexion.getConnection((error, connection) => {

    if (error) {
        console.log("Error al conectar con MySQL");
        console.log(error);
        return;
    }

    console.log("Conexión exitosa con MySQL");

    connection.release();

});

const conexionPromise = conexion.promise();

// Ejecuta una consulta dejando registrado quién la hizo (para los triggers de auditoría).
// Usa una única conexión física para el SET y la consulta real, porque en un pool
// dos llamadas separadas a .query() pueden caer en conexiones distintas y perder
// la variable de sesión @id_usuario_sesion.
export const queryConSesion = async (sql, params = [], idUsuario = null) => {

    const connection = await conexionPromise.getConnection();

    try {

        await connection.query("SET @id_usuario_sesion = ?", [idUsuario ?? 0]);

        const [resultado] = await connection.query(sql, params);

        return resultado;

    } finally {

        connection.release();

    }

};

export default conexionPromise;