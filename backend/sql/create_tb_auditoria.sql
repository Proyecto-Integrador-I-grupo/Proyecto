-- Script para crear la tabla tb_auditoria en MySQL
CREATE TABLE IF NOT EXISTS tb_auditoria (
    id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tabla VARCHAR(50) NOT NULL,
    accion_usuario VARCHAR(10) NOT NULL,
    datos_anteriores LONGTEXT NOT NULL,
    datos_nuevos LONGTEXT NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    id_usuario INT NOT NULL,
    INDEX (id_usuario)
);

-- Nota: MySQL no tiene NVARCHAR(MAX); usamos LONGTEXT para campos grandes.
