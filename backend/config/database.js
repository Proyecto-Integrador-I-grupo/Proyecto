import mysql from "mysql2";

const conexion = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "1234",
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

export default conexion.promise();