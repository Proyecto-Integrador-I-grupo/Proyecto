import mysql from "mysql2";

const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234",//recordar cambiar la contraseña
    database: "sistema_escolar_db"
});

conexion.connect((error)=>{

    if(error){
        console.log(error);
    }else{
        console.log("Conectado a MySQL");
    }

});

export default conexion;