import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import conexion from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const sqlPath = path.join(__dirname, "../sql/create_tb_auditoria.sql");
        const sql = await fs.readFile(sqlPath, "utf8");

        console.log("Ejecutando migración: create_tb_auditoria.sql...");
        const [result] = await conexion.query(sql);
        console.log("Migración ejecutada correctamente.");
        process.exit(0);
    } catch (error) {
        console.error("Error al ejecutar la migración:", error);
        process.exit(1);
    }
}

run();
