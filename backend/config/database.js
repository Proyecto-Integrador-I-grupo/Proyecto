import mysql from "mysql2";

const conexion = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Yugrant@13",
    database: process.env.DB_NAME || "sistema_escolar_db",
    port: process.env.DB_PORT || 3306,
    ssl: {
        rejectUnauthorized: false
    },
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