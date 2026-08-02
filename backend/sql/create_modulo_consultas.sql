-- =====================================================
-- COMPLEMENTO DE BASE DE DATOS: MÓDULO DE CONSULTAS
-- Sistema Escolar - EduControl
-- =====================================================

USE sistema_escolar_db;

-- -----------------------------------------------------
-- 1. Tabla detalle_matricula
-- Relaciona cada matrícula con el grupo asignado.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_matricula (
    id_detalle_matricula INT AUTO_INCREMENT PRIMARY KEY,
    fecha_asignacion DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    observaciones VARCHAR(150),
    id_matricula INT NOT NULL,
    id_grupo INT NOT NULL,
    CONSTRAINT fk_detalle_matricula_matricula
        FOREIGN KEY (id_matricula)
        REFERENCES matricula(id_matricula),
    CONSTRAINT fk_detalle_matricula_grupo
        FOREIGN KEY (id_grupo)
        REFERENCES grupo(id_grupo)
);

-- -----------------------------------------------------
-- 2. Procedimiento para registrar el detalle
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_detalle_matricula;

DELIMITER ^^
CREATE PROCEDURE sp_registrar_detalle_matricula (
    IN p_fecha DATE,
    IN p_observaciones VARCHAR(150),
    IN p_id_matricula INT,
    IN p_id_grupo INT
)
BEGIN
    INSERT INTO detalle_matricula (
        fecha_asignacion,
        estado,
        observaciones,
        id_matricula,
        id_grupo
    )
    VALUES (
        p_fecha,
        TRUE,
        p_observaciones,
        p_id_matricula,
        p_id_grupo
    );
END ^^
DELIMITER ;

-- -----------------------------------------------------
-- 3. Vista general de matrículas
-- -----------------------------------------------------
CREATE OR REPLACE VIEW vw_matriculas AS
SELECT
    m.id_matricula,
    p.nombre,
    p.apellido1,
    m.fecha_matricula,
    m.periodo_lectivo,
    m.anio_lectivo,
    m.tipo_matricula,
    m.estado_matricula
FROM matricula m
INNER JOIN estudiante e
    ON m.id_estudiante = e.id_estudiante
INNER JOIN persona p
    ON e.id_persona = p.id_persona;

-- -----------------------------------------------------
-- 4. Vista detallada de matrículas y grupos
-- -----------------------------------------------------
CREATE OR REPLACE VIEW vw_detalle_matricula AS
SELECT
    dm.id_detalle_matricula,
    p.nombre,
    p.apellido1,
    m.id_matricula,
    m.periodo_lectivo,
    m.anio_lectivo,
    g.nombre_grupo,
    dm.fecha_asignacion,
    dm.estado
FROM detalle_matricula dm
INNER JOIN matricula m
    ON dm.id_matricula = m.id_matricula
INNER JOIN estudiante e
    ON m.id_estudiante = e.id_estudiante
INNER JOIN persona p
    ON e.id_persona = p.id_persona
INNER JOIN grupo g
    ON dm.id_grupo = g.id_grupo;

-- -----------------------------------------------------
-- 5. Vista de asistencia para el módulo de consultas
-- -----------------------------------------------------
CREATE OR REPLACE VIEW vw_asistencia AS
SELECT
    a.id_asistencia,
    pe.nombre AS estudiante,
    pe.apellido1,
    pr.nombre AS profesor,
    g.nombre_grupo,
    a.fecha,
    a.estado_asistencia
FROM asistencia a
INNER JOIN estudiante e
    ON a.id_estudiante = e.id_estudiante
INNER JOIN persona pe
    ON e.id_persona = pe.id_persona
INNER JOIN profesor prof
    ON a.id_profesor = prof.id_profesor
INNER JOIN persona pr
    ON prof.id_persona = pr.id_persona
INNER JOIN grupo g
    ON a.id_grupo = g.id_grupo;

-- -----------------------------------------------------
-- 6. Comprobaciones
-- -----------------------------------------------------
SHOW TABLES LIKE 'detalle_matricula';
SHOW TABLES LIKE 'vw%matricula%';
SHOW TABLES LIKE 'vw_asistencia';

SELECT COUNT(*) AS total_matriculas
FROM matricula;

SELECT COUNT(*) AS total_detalles_matricula
FROM detalle_matricula;

SELECT COUNT(*) AS total_asistencias
FROM asistencia;