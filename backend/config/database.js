import "dotenv/config";
import mysql from "mysql2";

const conexion = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "sistema_escolar_db",
    port: process.env.DB_PORT || 18817,
    ssl: {
        rejectUnauthorized: false
    },
    charset: "utf8mb4_bin",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Mantener una misma collation de sesión. Algunas tablas históricas del proyecto
// fueron creadas con utf8mb4_bin y otras con utf8mb4_unicode_ci.
conexion.on("connection", (connection) => {
    connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_bin", (error) => {
        if (error) console.log("No se pudo establecer la collation de la sesión", error.message);
    });
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