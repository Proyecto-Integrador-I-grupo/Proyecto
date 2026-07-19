import mysql from "mysql2/promise";

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "1234",
    database: process.env.DB_NAME || "sistema_escolar_db"
};

const credentialCandidates = [
    { user: dbConfig.user, password: dbConfig.password },
    { user: "root", password: "1234" },
    { user: "root", password: "root" },
    { user: "root", password: "password" }
];

let conexion;

for (const credentials of credentialCandidates) {
    try {
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: credentials.user,
            password: credentials.password
        });

        await tempConnection.query("SELECT 1");
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        await tempConnection.end();

        conexion = await mysql.createConnection({
            host: dbConfig.host,
            user: credentials.user,
            password: credentials.password,
            database: dbConfig.database
        });

        await conexion.query(`CREATE TABLE IF NOT EXISTS tb_persona (
            id_persona INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            apellido1 VARCHAR(100) NOT NULL,
            apellido2 VARCHAR(100) DEFAULT NULL,
            fecha_nacimiento DATE NOT NULL,
            genero CHAR(1) NOT NULL,
            estado TINYINT(1) NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        console.log("Conectado a MySQL");
        break;
    } catch (error) {
        if (error.code === "ER_ACCESS_DENIED_ERROR") {
            continue;
        }

        throw error;
    }
}

if (!conexion) {
    throw new Error("No se pudo establecer conexión con MySQL. Revisa el usuario, la contraseña y que el servicio esté activo.");
}

export default conexion;