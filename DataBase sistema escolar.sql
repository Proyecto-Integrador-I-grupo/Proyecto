DROP DATABASE IF EXISTS sistema_escolar_db;
CREATE DATABASE IF NOT EXISTS sistema_escolar_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE sistema_escolar_db;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ===========================================
-- TABLAS
-- ===========================================
CREATE TABLE rol(
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nom_rol VARCHAR(20) NOT NULL,
    descripcion VARCHAR(200) NOT NULL
);
CREATE TABLE persona(
    id_persona INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellido1 VARCHAR(50) NOT NULL,
    apellido2 VARCHAR(50) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero CHAR(1) NOT NULL,
    foto LONGTEXT NULL,
    estado BOOLEAN DEFAULT TRUE
);
CREATE TABLE usuario(
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_rol INT NOT NULL,
    id_persona INT NOT NULL,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol(id_rol),
    CONSTRAINT fk_usuario_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);
CREATE TABLE profesor(
    id_profesor INT AUTO_INCREMENT PRIMARY KEY,
    materia VARCHAR(100) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_persona INT NOT NULL,
    CONSTRAINT fk_profesor_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);
CREATE TABLE estudiante(
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    fecha_ingreso DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_persona INT NOT NULL,
    CONSTRAINT fk_estudiante_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);
CREATE TABLE direccion_persona(
    id_direccion_persona INT AUTO_INCREMENT PRIMARY KEY,
    tipo_direccion VARCHAR(30) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    canton VARCHAR(50) NOT NULL,
    distrito VARCHAR(50) NOT NULL,
    direccion_exacta VARCHAR(250) NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_persona INT NOT NULL,
    CONSTRAINT fk_direccion_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);
CREATE TABLE telefono_persona(
    id_telefono INT AUTO_INCREMENT PRIMARY KEY,
    tipo_telefono VARCHAR(50) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_persona INT NOT NULL,
    CONSTRAINT fk_telefono_persona FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);
CREATE TABLE seccion(
    id_seccion INT AUTO_INCREMENT PRIMARY KEY,
    nombre_seccion VARCHAR(10) NOT NULL,
    nivel VARCHAR(20) NOT NULL,
    periodo_lectivo YEAR NOT NULL,
    descripcion VARCHAR(250) NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_seccion_nombre_periodo UNIQUE (nombre_seccion, periodo_lectivo)
);
CREATE TABLE grupo(
    id_grupo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_grupo VARCHAR(100) NOT NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    capacidad INT NOT NULL,
    aula VARCHAR(40) NULL,
    dias_semana VARCHAR(80) NOT NULL DEFAULT '',
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    id_seccion INT NOT NULL,
    CONSTRAINT ck_grupo_capacidad CHECK (capacidad > 0),
    CONSTRAINT ck_grupo_horario CHECK (
      (hora_inicio IS NULL AND hora_fin IS NULL) OR
      (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
    ),
    CONSTRAINT fk_grupo_seccion FOREIGN KEY (id_seccion) REFERENCES seccion(id_seccion)
);
CREATE INDEX idx_grupo_aula_horario ON grupo(aula, estado, hora_inicio, hora_fin);
CREATE TABLE matricula(
    id_matricula INT AUTO_INCREMENT PRIMARY KEY,
    fecha_matricula DATE NOT NULL,
    periodo_lectivo SMALLINT NOT NULL,
    anio_lectivo SMALLINT NOT NULL,
    tipo_matricula VARCHAR(20) NOT NULL,
    estado_matricula VARCHAR(20) NOT NULL,
    observaciones VARCHAR(100),
    id_estudiante INT NOT NULL,
    id_usuario INT NOT NULL,
    CONSTRAINT fk_matricula_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante),
    CONSTRAINT fk_matricula_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);
CREATE TABLE detalle_matricula(
    id_detalle_matricula INT AUTO_INCREMENT PRIMARY KEY,
    fecha_asignacion DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    observaciones VARCHAR(150),
    id_matricula INT NOT NULL,
    id_grupo INT NOT NULL,
    CONSTRAINT fk_detalle_matricula_matricula FOREIGN KEY (id_matricula) REFERENCES matricula(id_matricula),
    CONSTRAINT fk_detalle_matricula_grupo FOREIGN KEY (id_grupo) REFERENCES grupo(id_grupo)
);
CREATE TABLE contacto_estudiante(
    id_contacto_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    nombre_contacto VARCHAR(100) NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    correo VARCHAR(100),
    estado BOOLEAN DEFAULT TRUE,
    id_estudiante INT NOT NULL,
    CONSTRAINT fk_contacto_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante)
);
CREATE TABLE asistencia(
    id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    estado_asistencia VARCHAR(15) NOT NULL,
    observaciones VARCHAR(250),
    estado BOOLEAN DEFAULT TRUE,
    id_estudiante INT NOT NULL,
    id_grupo INT NOT NULL,
    id_profesor INT NOT NULL,
    CONSTRAINT fk_asistencia_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante),
    CONSTRAINT fk_asistencia_grupo FOREIGN KEY (id_grupo) REFERENCES grupo(id_grupo),
    CONSTRAINT fk_asistencia_profesor FOREIGN KEY (id_profesor) REFERENCES profesor(id_profesor)
);
CREATE TABLE grupo_estudiante(
    id_grupo_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    fecha_asignacion DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    id_grupo INT NOT NULL,
    id_estudiante INT NOT NULL,
    CONSTRAINT fk_grupo_estudiante_grupo FOREIGN KEY (id_grupo) REFERENCES grupo(id_grupo),
    CONSTRAINT fk_grupo_estudiante_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante)
);
CREATE TABLE grupo_profesor(
    id_grupo_profesor INT AUTO_INCREMENT PRIMARY KEY,
    fecha_inicio DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    fecha_fin DATE,
    id_grupo INT NOT NULL,
    id_profesor INT NOT NULL,
    CONSTRAINT fk_grupo_profesor_grupo FOREIGN KEY (id_grupo) REFERENCES grupo(id_grupo),
    CONSTRAINT fk_grupo_profesor_profesor FOREIGN KEY (id_profesor) REFERENCES profesor(id_profesor)
);
-- ===========================================
-- Suplencias de profesor
-- ===========================================
-- Registra qué grupo(s) tenía un profesor titular en el momento de ser
-- destituido/incapacitado, y quién quedó cubriéndolo provisionalmente
-- (si alguien fue asignado). Al reintegrar al titular, esta tabla es la
-- que permite restaurarle automáticamente su grupo original y retirar
-- al suplente.
-- estado = TRUE  -> suplencia pendiente de restaurar (el titular sigue inactivo,
--                    con o sin suplente asignado todavía)
-- estado = FALSE -> ya se restauró (el titular fue reintegrado a ese grupo)
CREATE TABLE profesor_suplencia(
    id_suplencia INT AUTO_INCREMENT PRIMARY KEY,
    id_grupo INT NOT NULL,
    id_profesor_titular INT NOT NULL,
    id_profesor_suplente INT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    motivo VARCHAR(250) NULL,
    CONSTRAINT fk_suplencia_grupo FOREIGN KEY (id_grupo) REFERENCES grupo(id_grupo),
    CONSTRAINT fk_suplencia_titular FOREIGN KEY (id_profesor_titular) REFERENCES profesor(id_profesor),
    CONSTRAINT fk_suplencia_suplente FOREIGN KEY (id_profesor_suplente) REFERENCES profesor(id_profesor)
);
CREATE INDEX idx_suplencia_titular_activa ON profesor_suplencia (id_profesor_titular, estado);
CREATE INDEX idx_suplencia_grupo_activa ON profesor_suplencia (id_grupo, estado);
-- ===========================================
-- MÓDULO FINANCIERO PARA ESCUELA PRIVADA
-- ===========================================
CREATE TABLE concepto_cobro(
    id_concepto INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),
    tipo ENUM('matricula','mensualidad','servicio','otro') NOT NULL DEFAULT 'otro',
    monto_base DECIMAL(12,2) NOT NULL DEFAULT 0,
    impuesto_tarifa DECIMAL(5,2) NOT NULL DEFAULT 0,
    moneda CHAR(3) NOT NULL DEFAULT 'CRC',
    estado BOOLEAN DEFAULT TRUE
);

CREATE TABLE configuracion_facturacion(
    id_configuracion TINYINT PRIMARY KEY,
    institucion_nombre VARCHAR(150) NOT NULL,
    tipo_identificacion VARCHAR(5) NOT NULL,
    numero_identificacion VARCHAR(30) NOT NULL,
    correo VARCHAR(120) NOT NULL,
    moneda CHAR(3) NOT NULL DEFAULT 'CRC',
    condicion_venta VARCHAR(5) NOT NULL DEFAULT '01',
    estado BOOLEAN DEFAULT TRUE
);

CREATE TABLE responsable_pago(
    id_responsable INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    parentesco VARCHAR(50),
    telefono VARCHAR(20),
    correo VARCHAR(120) NOT NULL,
    tipo_identificacion VARCHAR(5) DEFAULT '01',
    numero_identificacion VARCHAR(30),
    principal BOOLEAN DEFAULT TRUE,
    estado BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_responsable_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante)
);
CREATE INDEX idx_responsable_estudiante ON responsable_pago(id_estudiante, principal, estado);

CREATE TABLE cargo_estudiante(
    id_cargo INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_concepto INT NOT NULL,
    id_matricula INT NULL,
    descripcion VARCHAR(200) NOT NULL,
    periodo VARCHAR(30),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NULL,
    monto_base DECIMAL(12,2) NOT NULL,
    descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
    impuesto DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    saldo DECIMAL(12,2) NOT NULL,
    estado ENUM('pendiente','parcial','pagado','anulado') NOT NULL DEFAULT 'pendiente',
    id_usuario_crea INT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cargo_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante),
    CONSTRAINT fk_cargo_concepto FOREIGN KEY (id_concepto) REFERENCES concepto_cobro(id_concepto),
    CONSTRAINT fk_cargo_matricula FOREIGN KEY (id_matricula) REFERENCES matricula(id_matricula),
    CONSTRAINT fk_cargo_usuario FOREIGN KEY (id_usuario_crea) REFERENCES usuario(id_usuario),
    CONSTRAINT uk_cargo_matricula_concepto UNIQUE (id_matricula, id_concepto),
    CONSTRAINT ck_cargo_montos CHECK (monto_base >= 0 AND descuento >= 0 AND descuento <= monto_base AND impuesto >= 0 AND total >= 0 AND saldo >= 0 AND saldo <= total)
);
CREATE INDEX idx_cargo_estado ON cargo_estudiante(estado, fecha_vencimiento);
CREATE INDEX idx_cargo_estudiante ON cargo_estudiante(id_estudiante, estado);

CREATE TABLE pago(
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_cargo INT NOT NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago ENUM('efectivo','tarjeta','transferencia','sinpe','otro') NOT NULL,
    referencia VARCHAR(100),
    estado ENUM('aplicado','anulado') NOT NULL DEFAULT 'aplicado',
    id_usuario INT NULL,
    CONSTRAINT fk_pago_cargo FOREIGN KEY (id_cargo) REFERENCES cargo_estudiante(id_cargo),
    CONSTRAINT fk_pago_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT ck_pago_monto CHECK (monto > 0)
);
CREATE INDEX idx_pago_cargo ON pago(id_cargo, estado);
CREATE INDEX idx_pago_fecha ON pago(fecha_pago);

CREATE TABLE factura_cargo(
    id_factura_cargo INT AUTO_INCREMENT PRIMARY KEY,
    id_cargo INT NOT NULL UNIQUE,
    id_factura_externa VARCHAR(80) NULL,
    estado_factura VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    url_documento VARCHAR(500) NULL,
    datos_respuesta JSON NULL,
    error_mensaje VARCHAR(500) NULL,
    fecha_solicitud DATETIME NULL,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_factura_cargo FOREIGN KEY (id_cargo) REFERENCES cargo_estudiante(id_cargo)
);

CREATE TABLE clase_extra(
    id_clase_extra BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_profesor INT NOT NULL,
    id_cargo INT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NULL,
    hora_fin TIME NULL,
    observaciones VARCHAR(250) NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'programada',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_clase_extra_estudiante FOREIGN KEY (id_estudiante) REFERENCES estudiante(id_estudiante),
    CONSTRAINT fk_clase_extra_profesor FOREIGN KEY (id_profesor) REFERENCES profesor(id_profesor),
    CONSTRAINT fk_clase_extra_cargo FOREIGN KEY (id_cargo) REFERENCES cargo_estudiante(id_cargo)
);
CREATE INDEX idx_clase_extra_profesor_fecha ON clase_extra(id_profesor, fecha);
CREATE INDEX idx_clase_extra_estudiante ON clase_extra(id_estudiante);
CREATE INDEX idx_clase_extra_cargo ON clase_extra(id_cargo);

CREATE TABLE auditoria(
    id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_tabla VARCHAR(50) NOT NULL,
    accion_usuario VARCHAR(10) NOT NULL,
    datos_anteriores JSON,
    datos_nuevos JSON,
    fecha_creacion DATETIME NOT NULL,
    fecha_modificacion DATETIME NOT NULL,
    id_usuario INT NULL,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);
-- ===========================================
-- PROCEDIMIENTOS ALMACENADOS
-- ===========================================
DELIMITER ^^
-- ===========================================
-- Registrar Persona
-- ===========================================
CREATE PROCEDURE sp_registrar_persona(
    IN p_nombre VARCHAR(50),
    IN p_apellido1 VARCHAR(50),
    IN p_apellido2 VARCHAR(50),
    IN p_fecha_nacimiento DATE,
    IN p_genero CHAR(1)
) BEGIN
INSERT INTO persona(
        nombre,
        apellido1,
        apellido2,
        fecha_nacimiento,
        genero,
        estado
    )
VALUES(
        p_nombre,
        p_apellido1,
        p_apellido2,
        p_fecha_nacimiento,
        p_genero,
        TRUE
    );
END ^^
-- ===========================================
-- Registrar Estudiante
-- ===========================================
CREATE PROCEDURE sp_registrar_estudiante(
    IN p_id_persona INT,
    IN p_fecha_ingreso DATE
) BEGIN
INSERT INTO estudiante(fecha_ingreso, estado, id_persona)
VALUES(p_fecha_ingreso, TRUE, p_id_persona);
END ^^
-- ===========================================
-- Registrar Profesor
-- ===========================================
CREATE PROCEDURE sp_registrar_profesor(
    IN p_id_persona INT,
    IN p_materia VARCHAR(100),
    IN p_fecha_ingreso DATE
) BEGIN
INSERT INTO profesor(materia, fecha_ingreso, estado, id_persona)
VALUES(p_materia, p_fecha_ingreso, TRUE, p_id_persona);
END ^^
-- ===========================================
-- Registrar Usuario
-- ===========================================
CREATE PROCEDURE sp_registrar_usuario(
    IN p_correo VARCHAR(100),
    IN p_contrasena VARCHAR(255),
    IN p_id_rol INT,
    IN p_id_persona INT
) BEGIN
INSERT INTO usuario(correo, contrasena, estado, id_rol, id_persona)
VALUES(
        p_correo,
        p_contrasena,
        TRUE,
        p_id_rol,
        p_id_persona
    );
END ^^
-- ===========================================
-- Registrar Matrícula
-- ===========================================
CREATE PROCEDURE sp_registrar_matricula(
    IN p_fecha DATE,
    IN p_periodo SMALLINT,
    IN p_anio SMALLINT,
    IN p_tipo VARCHAR(20),
    IN p_estado VARCHAR(20),
    IN p_observaciones VARCHAR(150),
    IN p_id_estudiante INT,
    IN p_id_usuario INT
) BEGIN
INSERT INTO matricula(
        fecha_matricula,
        periodo_lectivo,
        anio_lectivo,
        tipo_matricula,
        estado_matricula,
        observaciones,
        id_estudiante,
        id_usuario
    )
VALUES(
        p_fecha,
        p_periodo,
        p_anio,
        p_tipo,
        p_estado,
        p_observaciones,
        p_id_estudiante,
        p_id_usuario
    );
END ^^
-- ===========================================
-- Registrar Asistencia
-- ===========================================
CREATE PROCEDURE sp_registrar_asistencia(
    IN p_fecha DATE,
    IN p_estado VARCHAR(15),
    IN p_observaciones VARCHAR(250),
    IN p_id_estudiante INT,
    IN p_id_grupo INT,
    IN p_id_profesor INT
) BEGIN
INSERT INTO asistencia(
        fecha,
        estado_asistencia,
        observaciones,
        estado,
        id_estudiante,
        id_grupo,
        id_profesor
    )
VALUES(
        p_fecha,
        p_estado,
        p_observaciones,
        TRUE,
        p_id_estudiante,
        p_id_grupo,
        p_id_profesor
    );
END ^^
-- ===========================================
-- Asignar Estudiante a Grupo
-- ===========================================
CREATE PROCEDURE sp_asignar_estudiante_grupo(
    IN p_fecha DATE,
    IN p_id_grupo INT,
    IN p_id_estudiante INT
) BEGIN
INSERT INTO grupo_estudiante(
        fecha_asignacion,
        estado,
        id_grupo,
        id_estudiante
    )
VALUES(p_fecha, TRUE, p_id_grupo, p_id_estudiante);
END ^^
-- ===========================================
-- Asignar Profesor a Grupo
-- ===========================================
CREATE PROCEDURE sp_asignar_profesor_grupo(
    IN p_fecha_inicio DATE,
    IN p_fecha_fin DATE,
    IN p_id_grupo INT,
    IN p_id_profesor INT
) BEGIN
INSERT INTO grupo_profesor(
        fecha_inicio,
        estado,
        fecha_fin,
        id_grupo,
        id_profesor
    )
VALUES(
        p_fecha_inicio,
        TRUE,
        p_fecha_fin,
        p_id_grupo,
        p_id_profesor
    );
END ^^
-- ===========================================
-- Registrar Detalle de Matrícula
-- ===========================================
CREATE PROCEDURE sp_registrar_detalle_matricula(
    IN p_fecha DATE,
    IN p_observaciones VARCHAR(150),
    IN p_id_matricula INT,
    IN p_id_grupo INT
) BEGIN
INSERT INTO detalle_matricula(
        fecha_asignacion,
        estado,
        observaciones,
        id_matricula,
        id_grupo
    )
VALUES(
        p_fecha,
        TRUE,
        p_observaciones,
        p_id_matricula,
        p_id_grupo
    );
END ^^
DELIMITER ;
-- ===========================================
-- FUNCIONES
-- ===========================================
DELIMITER ^^
-- Calcular Edad
CREATE FUNCTION fn_calcular_edad(p_fecha DATE) RETURNS INT DETERMINISTIC BEGIN RETURN TIMESTAMPDIFF(YEAR, p_fecha, CURDATE());
END ^^
-- Total de estudiantes
CREATE FUNCTION fn_total_estudiantes() RETURNS INT DETERMINISTIC BEGIN
DECLARE total INT;
SELECT COUNT(*) INTO total
FROM estudiante;
RETURN total;
END ^^
-- Total de profesores
CREATE FUNCTION fn_total_profesores() RETURNS INT DETERMINISTIC BEGIN
DECLARE total INT;
SELECT COUNT(*) INTO total
FROM profesor;
RETURN total;
END ^^
-- Cantidad de estudiantes por grupo
CREATE FUNCTION fn_estudiantes_grupo(p_id_grupo INT) RETURNS INT DETERMINISTIC BEGIN
DECLARE total INT;
SELECT COUNT(*) INTO total
FROM grupo_estudiante
WHERE id_grupo = p_id_grupo
    AND estado = TRUE;
RETURN total;
END ^^
-- Verificar si existe un correo
CREATE FUNCTION fn_existe_correo(p_correo VARCHAR(100)) RETURNS BOOLEAN DETERMINISTIC BEGIN
DECLARE existe BOOLEAN;
SELECT COUNT(*) > 0 INTO existe
FROM usuario
WHERE correo = p_correo;
RETURN existe;
END ^^
DELIMITER ;
-- ===========================================
-- DISPARADORES (TRIGGERS)
-- ===========================================
DELIMITER ^^
-- ===========================================
-- Auditoría: Persona
-- ===========================================
CREATE TRIGGER trg_persona_after_insert
AFTER
INSERT ON persona FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'persona',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_persona',
            NEW.id_persona,
            'nombre',
            NEW.nombre,
            'apellido1',
            NEW.apellido1,
            'apellido2',
            NEW.apellido2,
            'fecha_nacimiento',
            NEW.fecha_nacimiento,
            'genero',
            NEW.genero,
            'estado',
            NEW.estado
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_persona_after_update
AFTER
UPDATE ON persona FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'persona',
        'UPDATE',
        JSON_OBJECT(
            'id_persona',
            OLD.id_persona,
            'nombre',
            OLD.nombre,
            'apellido1',
            OLD.apellido1,
            'apellido2',
            OLD.apellido2,
            'fecha_nacimiento',
            OLD.fecha_nacimiento,
            'genero',
            OLD.genero,
            'estado',
            OLD.estado
        ),
        JSON_OBJECT(
            'id_persona',
            NEW.id_persona,
            'nombre',
            NEW.nombre,
            'apellido1',
            NEW.apellido1,
            'apellido2',
            NEW.apellido2,
            'fecha_nacimiento',
            NEW.fecha_nacimiento,
            'genero',
            NEW.genero,
            'estado',
            NEW.estado
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_persona_after_delete
AFTER DELETE ON persona FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'persona',
        'DELETE',
        JSON_OBJECT(
            'id_persona',
            OLD.id_persona,
            'nombre',
            OLD.nombre,
            'apellido1',
            OLD.apellido1,
            'apellido2',
            OLD.apellido2,
            'fecha_nacimiento',
            OLD.fecha_nacimiento,
            'genero',
            OLD.genero,
            'estado',
            OLD.estado
        ),
        NULL,
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
-- ===========================================
-- Auditoría: Estudiante
-- ===========================================
CREATE TRIGGER trg_estudiante_after_insert
AFTER
INSERT ON estudiante FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'estudiante',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_estudiante',
            NEW.id_estudiante,
            'fecha_ingreso',
            NEW.fecha_ingreso,
            'estado',
            NEW.estado,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_estudiante_after_update
AFTER
UPDATE ON estudiante FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'estudiante',
        'UPDATE',
        JSON_OBJECT(
            'id_estudiante',
            OLD.id_estudiante,
            'fecha_ingreso',
            OLD.fecha_ingreso,
            'estado',
            OLD.estado,
            'id_persona',
            OLD.id_persona
        ),
        JSON_OBJECT(
            'id_estudiante',
            NEW.id_estudiante,
            'fecha_ingreso',
            NEW.fecha_ingreso,
            'estado',
            NEW.estado,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_estudiante_after_delete
AFTER DELETE ON estudiante FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'estudiante',
        'DELETE',
        JSON_OBJECT(
            'id_estudiante',
            OLD.id_estudiante,
            'fecha_ingreso',
            OLD.fecha_ingreso,
            'estado',
            OLD.estado,
            'id_persona',
            OLD.id_persona
        ),
        NULL,
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
-- ===========================================
-- Auditoría: Profesor
-- ===========================================
CREATE TRIGGER trg_profesor_after_insert
AFTER
INSERT ON profesor FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'profesor',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_profesor',
            NEW.id_profesor,
            'materia',
            NEW.materia,
            'fecha_ingreso',
            NEW.fecha_ingreso,
            'estado',
            NEW.estado,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_profesor_after_update
AFTER
UPDATE ON profesor FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'profesor',
        'UPDATE',
        JSON_OBJECT(
            'id_profesor',
            OLD.id_profesor,
            'materia',
            OLD.materia,
            'fecha_ingreso',
            OLD.fecha_ingreso,
            'estado',
            OLD.estado,
            'id_persona',
            OLD.id_persona
        ),
        JSON_OBJECT(
            'id_profesor',
            NEW.id_profesor,
            'materia',
            NEW.materia,
            'fecha_ingreso',
            NEW.fecha_ingreso,
            'estado',
            NEW.estado,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_profesor_after_delete
AFTER DELETE ON profesor FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'profesor',
        'DELETE',
        JSON_OBJECT(
            'id_profesor',
            OLD.id_profesor,
            'materia',
            OLD.materia,
            'fecha_ingreso',
            OLD.fecha_ingreso,
            'estado',
            OLD.estado,
            'id_persona',
            OLD.id_persona
        ),
        NULL,
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
-- ===========================================
-- Auditoría: Usuario
-- ===========================================
CREATE TRIGGER trg_usuario_after_insert
AFTER
INSERT ON usuario FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'usuario',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_usuario',
            NEW.id_usuario,
            'correo',
            NEW.correo,
            'estado',
            NEW.estado,
            'id_rol',
            NEW.id_rol,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NEW.id_usuario
    );
END ^^
CREATE TRIGGER trg_usuario_after_update
AFTER
UPDATE ON usuario FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'usuario',
        'UPDATE',
        JSON_OBJECT(
            'id_usuario',
            OLD.id_usuario,
            'correo',
            OLD.correo,
            'estado',
            OLD.estado,
            'id_rol',
            OLD.id_rol,
            'id_persona',
            OLD.id_persona
        ),
        JSON_OBJECT(
            'id_usuario',
            NEW.id_usuario,
            'correo',
            NEW.correo,
            'estado',
            NEW.estado,
            'id_rol',
            NEW.id_rol,
            'id_persona',
            NEW.id_persona
        ),
        NOW(),
        NOW(),
        NEW.id_usuario
    );
END ^^
CREATE TRIGGER trg_usuario_after_delete
AFTER DELETE ON usuario FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'usuario',
        'DELETE',
        JSON_OBJECT(
            'id_usuario',
            OLD.id_usuario,
            'correo',
            OLD.correo,
            'estado',
            OLD.estado,
            'id_rol',
            OLD.id_rol,
            'id_persona',
            OLD.id_persona
        ),
        NULL,
        NOW(),
        NOW(),
        COALESCE(@id_usuario_sesion, OLD.id_usuario)
    );
END ^^
-- ===========================================
-- Auditoría: Matrícula
-- ===========================================
CREATE TRIGGER trg_matricula_after_insert
AFTER
INSERT ON matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'matricula',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_matricula',
            NEW.id_matricula,
            'fecha_matricula',
            NEW.fecha_matricula,
            'periodo_lectivo',
            NEW.periodo_lectivo,
            'anio_lectivo',
            NEW.anio_lectivo,
            'tipo_matricula',
            NEW.tipo_matricula,
            'estado_matricula',
            NEW.estado_matricula,
            'id_estudiante',
            NEW.id_estudiante
        ),
        NOW(),
        NOW(),
        NEW.id_usuario
    );
END ^^
CREATE TRIGGER trg_matricula_after_update
AFTER
UPDATE ON matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'matricula',
        'UPDATE',
        JSON_OBJECT(
            'id_matricula',
            OLD.id_matricula,
            'fecha_matricula',
            OLD.fecha_matricula,
            'periodo_lectivo',
            OLD.periodo_lectivo,
            'anio_lectivo',
            OLD.anio_lectivo,
            'tipo_matricula',
            OLD.tipo_matricula,
            'estado_matricula',
            OLD.estado_matricula,
            'id_estudiante',
            OLD.id_estudiante
        ),
        JSON_OBJECT(
            'id_matricula',
            NEW.id_matricula,
            'fecha_matricula',
            NEW.fecha_matricula,
            'periodo_lectivo',
            NEW.periodo_lectivo,
            'anio_lectivo',
            NEW.anio_lectivo,
            'tipo_matricula',
            NEW.tipo_matricula,
            'estado_matricula',
            NEW.estado_matricula,
            'id_estudiante',
            NEW.id_estudiante
        ),
        NOW(),
        NOW(),
        NEW.id_usuario
    );
END ^^
CREATE TRIGGER trg_matricula_after_delete
AFTER DELETE ON matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'matricula',
        'DELETE',
        JSON_OBJECT(
            'id_matricula',
            OLD.id_matricula,
            'fecha_matricula',
            OLD.fecha_matricula,
            'periodo_lectivo',
            OLD.periodo_lectivo,
            'anio_lectivo',
            OLD.anio_lectivo,
            'tipo_matricula',
            OLD.tipo_matricula,
            'estado_matricula',
            OLD.estado_matricula,
            'id_estudiante',
            OLD.id_estudiante
        ),
        NULL,
        NOW(),
        NOW(),
        COALESCE(@id_usuario_sesion, OLD.id_usuario)
    );
END ^^
-- ===========================================
-- Auditoría: Detalle Matrícula
-- ===========================================
CREATE TRIGGER trg_detalle_matricula_after_insert
AFTER
INSERT ON detalle_matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'detalle_matricula',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_detalle_matricula',
            NEW.id_detalle_matricula,
            'fecha_asignacion',
            NEW.fecha_asignacion,
            'estado',
            NEW.estado,
            'observaciones',
            NEW.observaciones,
            'id_matricula',
            NEW.id_matricula,
            'id_grupo',
            NEW.id_grupo
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_detalle_matricula_after_update
AFTER
UPDATE ON detalle_matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'detalle_matricula',
        'UPDATE',
        JSON_OBJECT(
            'id_detalle_matricula',
            OLD.id_detalle_matricula,
            'fecha_asignacion',
            OLD.fecha_asignacion,
            'estado',
            OLD.estado,
            'observaciones',
            OLD.observaciones,
            'id_matricula',
            OLD.id_matricula,
            'id_grupo',
            OLD.id_grupo
        ),
        JSON_OBJECT(
            'id_detalle_matricula',
            NEW.id_detalle_matricula,
            'fecha_asignacion',
            NEW.fecha_asignacion,
            'estado',
            NEW.estado,
            'observaciones',
            NEW.observaciones,
            'id_matricula',
            NEW.id_matricula,
            'id_grupo',
            NEW.id_grupo
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_detalle_matricula_after_delete
AFTER DELETE ON detalle_matricula FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'detalle_matricula',
        'DELETE',
        JSON_OBJECT(
            'id_detalle_matricula',
            OLD.id_detalle_matricula,
            'fecha_asignacion',
            OLD.fecha_asignacion,
            'estado',
            OLD.estado,
            'observaciones',
            OLD.observaciones,
            'id_matricula',
            OLD.id_matricula,
            'id_grupo',
            OLD.id_grupo
        ),
        NULL,
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
-- ===========================================
-- Auditoría: Asistencia
-- ===========================================
CREATE TRIGGER trg_asistencia_after_insert
AFTER
INSERT ON asistencia FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'asistencia',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_asistencia',
            NEW.id_asistencia,
            'fecha',
            NEW.fecha,
            'estado_asistencia',
            NEW.estado_asistencia,
            'id_estudiante',
            NEW.id_estudiante,
            'id_grupo',
            NEW.id_grupo,
            'id_profesor',
            NEW.id_profesor
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_asistencia_after_update
AFTER
UPDATE ON asistencia FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'asistencia',
        'UPDATE',
        JSON_OBJECT(
            'id_asistencia',
            OLD.id_asistencia,
            'fecha',
            OLD.fecha,
            'estado_asistencia',
            OLD.estado_asistencia,
            'id_estudiante',
            OLD.id_estudiante,
            'id_grupo',
            OLD.id_grupo,
            'id_profesor',
            OLD.id_profesor
        ),
        JSON_OBJECT(
            'id_asistencia',
            NEW.id_asistencia,
            'fecha',
            NEW.fecha,
            'estado_asistencia',
            NEW.estado_asistencia,
            'id_estudiante',
            NEW.id_estudiante,
            'id_grupo',
            NEW.id_grupo,
            'id_profesor',
            NEW.id_profesor
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
CREATE TRIGGER trg_asistencia_after_delete
AFTER DELETE ON asistencia FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'asistencia',
        'DELETE',
        JSON_OBJECT(
            'id_asistencia',
            OLD.id_asistencia,
            'fecha',
            OLD.fecha,
            'estado_asistencia',
            OLD.estado_asistencia,
            'id_estudiante',
            OLD.id_estudiante,
            'id_grupo',
            OLD.id_grupo,
            'id_profesor',
            OLD.id_profesor
        ),
        NULL,
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
-- ===========================================
-- Validación: Correo único al insertar usuario
-- ===========================================
CREATE TRIGGER trg_usuario_valida_correo_insert BEFORE
INSERT ON usuario FOR EACH ROW BEGIN IF fn_existe_correo(NEW.correo) THEN SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = 'El correo ingresado ya está registrado.';
END IF;
END ^^
-- ===========================================
-- Validación: Correo único al actualizar usuario
-- ===========================================
CREATE TRIGGER trg_usuario_valida_correo_update BEFORE
UPDATE ON usuario FOR EACH ROW BEGIN IF NEW.correo <> OLD.correo
    AND fn_existe_correo(NEW.correo) THEN SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = 'El correo ingresado ya está registrado por otro usuario.';
END IF;
END ^^
-- ===========================================
-- Validación: Estudiante activo antes de matricular
-- ===========================================
CREATE TRIGGER trg_matricula_valida_estudiante_activo BEFORE
INSERT ON matricula FOR EACH ROW BEGIN
DECLARE v_estado_estudiante BOOLEAN;
SELECT estado INTO v_estado_estudiante
FROM estudiante
WHERE id_estudiante = NEW.id_estudiante;
IF v_estado_estudiante IS NULL
OR v_estado_estudiante = FALSE THEN SIGNAL SQLSTATE '45000'
SET MESSAGE_TEXT = 'No se puede matricular a un estudiante inactivo o inexistente.';
END IF;
END ^^
-- ===========================================
-- Validación: Evitar asignación duplicada de estudiante a grupo
-- ===========================================
CREATE TRIGGER trg_grupo_estudiante_valida_duplicado BEFORE
INSERT ON grupo_estudiante FOR EACH ROW
BEGIN
    DECLARE v_existe INT DEFAULT 0;
    DECLARE v_ocupados INT DEFAULT 0;
    DECLARE v_capacidad INT DEFAULT 0;
    DECLARE v_periodo YEAR;
    DECLARE v_grupo_estado BOOLEAN;
    DECLARE v_estudiante_estado BOOLEAN;

    IF NEW.estado = TRUE THEN
        SELECT g.capacidad, g.estado, s.periodo_lectivo
          INTO v_capacidad, v_grupo_estado, v_periodo
        FROM grupo g
        INNER JOIN seccion s ON s.id_seccion = g.id_seccion
        WHERE g.id_grupo = NEW.id_grupo;

        SELECT estado INTO v_estudiante_estado
        FROM estudiante WHERE id_estudiante = NEW.id_estudiante;

        IF v_grupo_estado IS NULL OR v_grupo_estado = FALSE THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede asignar un estudiante a un grupo inactivo o inexistente.';
        END IF;

        IF v_estudiante_estado IS NULL OR v_estudiante_estado = FALSE THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede asignar un estudiante inactivo o inexistente.';
        END IF;

        SELECT COUNT(*) INTO v_existe
        FROM grupo_estudiante ge
        INNER JOIN grupo g2 ON g2.id_grupo = ge.id_grupo AND g2.estado = TRUE
        INNER JOIN seccion s2 ON s2.id_seccion = g2.id_seccion
        WHERE ge.id_estudiante = NEW.id_estudiante
          AND ge.estado = TRUE
          AND s2.periodo_lectivo = v_periodo;

        IF v_existe > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El estudiante ya tiene una asignacion activa en este anio lectivo. Usa transferencia de matricula.';
        END IF;

        SELECT COUNT(*) INTO v_ocupados
        FROM grupo_estudiante
        WHERE id_grupo = NEW.id_grupo AND estado = TRUE;

        IF v_ocupados >= v_capacidad THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El grupo ya alcanzo su capacidad maxima.';
        END IF;
    END IF;
END ^^
-- ===========================================
-- Validación: Fechas de asignación de profesor a grupo
-- ===========================================
CREATE TRIGGER trg_grupo_profesor_valida_fechas BEFORE
INSERT ON grupo_profesor FOR EACH ROW
BEGIN
    DECLARE v_profesor_estado BOOLEAN;
    DECLARE v_grupo_estado BOOLEAN;
    DECLARE v_dias VARCHAR(80);
    DECLARE v_inicio TIME;
    DECLARE v_fin TIME;
    DECLARE v_choques INT DEFAULT 0;
    DECLARE v_duplicado INT DEFAULT 0;

    IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < NEW.fecha_inicio THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La fecha de finalizacion no puede ser anterior a la fecha de inicio.';
    END IF;

    IF NEW.estado = TRUE THEN
        SELECT estado INTO v_profesor_estado
        FROM profesor WHERE id_profesor = NEW.id_profesor;
        IF v_profesor_estado IS NULL OR v_profesor_estado = FALSE THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede asignar un profesor inactivo o inexistente.';
        END IF;

        SELECT estado, dias_semana, hora_inicio, hora_fin
          INTO v_grupo_estado, v_dias, v_inicio, v_fin
        FROM grupo WHERE id_grupo = NEW.id_grupo;

        IF v_grupo_estado IS NULL OR v_grupo_estado = FALSE THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede asignar un profesor a un grupo inactivo o inexistente.';
        END IF;

        IF COALESCE(TRIM(v_dias), '') = '' OR v_inicio IS NULL OR v_fin IS NULL THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El grupo debe tener dias y horario definidos antes de asignar profesores.';
        END IF;

        SELECT COUNT(*) INTO v_duplicado
        FROM grupo_profesor
        WHERE id_grupo = NEW.id_grupo
          AND id_profesor = NEW.id_profesor
          AND estado = TRUE
          AND (fecha_fin IS NULL OR fecha_fin >= CURDATE());
        IF v_duplicado > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El profesor ya esta asignado activamente a este grupo.';
        END IF;

        SELECT COUNT(*) INTO v_choques
        FROM grupo_profesor gp
        INNER JOIN grupo g ON g.id_grupo = gp.id_grupo AND g.estado = TRUE
        WHERE gp.id_profesor = NEW.id_profesor
          AND gp.estado = TRUE
          AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= CURDATE())
          AND g.id_grupo <> NEW.id_grupo
          AND g.hora_inicio IS NOT NULL AND g.hora_fin IS NOT NULL
          AND v_inicio < g.hora_fin AND v_fin > g.hora_inicio
          AND (
            (FIND_IN_SET('lunes', v_dias) > 0 AND FIND_IN_SET('lunes', g.dias_semana) > 0) OR
            (FIND_IN_SET('martes', v_dias) > 0 AND FIND_IN_SET('martes', g.dias_semana) > 0) OR
            (FIND_IN_SET('miercoles', v_dias) > 0 AND FIND_IN_SET('miercoles', g.dias_semana) > 0) OR
            (FIND_IN_SET('jueves', v_dias) > 0 AND FIND_IN_SET('jueves', g.dias_semana) > 0) OR
            (FIND_IN_SET('viernes', v_dias) > 0 AND FIND_IN_SET('viernes', g.dias_semana) > 0) OR
            (FIND_IN_SET('sabado', v_dias) > 0 AND FIND_IN_SET('sabado', g.dias_semana) > 0)
          );

        IF v_choques > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El profesor ya tiene otro grupo en un horario que se superpone.';
        END IF;
    END IF;
END ^^
-- ===========================================
-- Validación: Fecha de asistencia no futura
-- ===========================================
CREATE TRIGGER trg_asistencia_valida_fecha
BEFORE INSERT ON asistencia
FOR EACH ROW
BEGIN
    IF NEW.fecha > CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede registrar asistencia con una fecha futura.';
    END IF;
END^^

-- ===========================================
-- Validación: Profesor mayor de edad
-- ===========================================
CREATE TRIGGER trg_profesor_valida_edad
BEFORE INSERT ON profesor
FOR EACH ROW
BEGIN
    DECLARE v_fecha_nacimiento DATE;
    DECLARE v_edad INT;

    SELECT fecha_nacimiento INTO v_fecha_nacimiento FROM persona WHERE id_persona = NEW.id_persona;
    SET v_edad = fn_calcular_edad(v_fecha_nacimiento);

    IF v_edad < 18 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El profesor debe ser mayor de edad (18 años o más).';
    END IF;
END^^

-- ===========================================
-- Validacion: relaciones de asistencia
-- ===========================================
CREATE TRIGGER trg_asistencia_valida_relaciones
BEFORE INSERT ON asistencia
FOR EACH ROW
BEGIN
    DECLARE v_estudiante_grupo INT DEFAULT 0;
    DECLARE v_profesor_grupo INT DEFAULT 0;
    DECLARE v_duplicado INT DEFAULT 0;

    IF LOWER(NEW.estado_asistencia) NOT IN ('presente','ausente','tardia','justificada') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El estado de asistencia no es valido.';
    END IF;

    SELECT COUNT(*) INTO v_estudiante_grupo
    FROM grupo_estudiante
    WHERE id_grupo = NEW.id_grupo AND id_estudiante = NEW.id_estudiante AND estado = TRUE;
    IF v_estudiante_grupo = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El estudiante no pertenece activamente al grupo.';
    END IF;

    SELECT COUNT(*) INTO v_profesor_grupo
    FROM grupo_profesor
    WHERE id_grupo = NEW.id_grupo AND id_profesor = NEW.id_profesor AND estado = TRUE
      AND fecha_inicio <= NEW.fecha
      AND (fecha_fin IS NULL OR fecha_fin >= NEW.fecha);
    IF v_profesor_grupo = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El profesor no esta asignado activamente al grupo en esa fecha.';
    END IF;

    SELECT COUNT(*) INTO v_duplicado
    FROM asistencia
    WHERE id_estudiante = NEW.id_estudiante
      AND id_grupo = NEW.id_grupo
      AND id_profesor = NEW.id_profesor
      AND fecha = NEW.fecha
      AND estado = TRUE;
    IF v_duplicado > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La asistencia ya fue registrada para este estudiante, profesor y fecha.';
    END IF;
END^^

-- ===========================================
-- Validacion: consistencia financiera del cargo
-- ===========================================
CREATE TRIGGER trg_cargo_valida_montos_insert
BEFORE INSERT ON cargo_estudiante
FOR EACH ROW
BEGIN
    IF NEW.descuento < 0 OR NEW.descuento > NEW.monto_base THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El descuento no puede ser negativo ni superar el monto base.';
    END IF;
    IF NEW.total < 0 OR NEW.saldo < 0 OR NEW.saldo > NEW.total THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los montos del cargo no son consistentes.';
    END IF;
END^^

CREATE TRIGGER trg_pago_valida_saldo_insert
BEFORE INSERT ON pago
FOR EACH ROW
BEGIN
    DECLARE v_saldo DECIMAL(12,2);
    DECLARE v_estado VARCHAR(20);
    IF NEW.estado = 'aplicado' THEN
        SELECT saldo, estado INTO v_saldo, v_estado
        FROM cargo_estudiante WHERE id_cargo = NEW.id_cargo;
        IF v_estado IS NULL OR v_estado IN ('pagado','anulado') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cargo no admite nuevos pagos.';
        END IF;
        IF NEW.monto <= 0 OR NEW.monto > v_saldo THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago debe ser mayor a cero y no puede superar el saldo.';
        END IF;
    END IF;
END^^
DELIMITER ;

-- ======================================================
-- VISTAS
-- ======================================================
CREATE VIEW vw_estudiantes AS
SELECT e.id_estudiante,
    p.nombre,
    p.apellido1,
    p.apellido2,
    p.fecha_nacimiento,
    p.genero,
    e.fecha_ingreso,
    e.estado
FROM estudiante e
    INNER JOIN persona p ON e.id_persona = p.id_persona;
SELECT *
FROM vw_estudiantes;
CREATE VIEW vw_profesores AS
SELECT pr.id_profesor,
    p.nombre,
    p.apellido1,
    p.apellido2,
    pr.materia,
    pr.fecha_ingreso,
    pr.estado
FROM profesor pr
    INNER JOIN persona p ON pr.id_persona = p.id_persona;
SELECT *
FROM vw_profesores;
CREATE VIEW vw_usuarios AS
SELECT u.id_usuario,
    p.nombre,
    p.apellido1,
    r.nom_rol,
    u.correo,
    u.estado
FROM usuario u
    INNER JOIN persona p ON u.id_persona = p.id_persona
    INNER JOIN rol r ON u.id_rol = r.id_rol;
SELECT *
FROM vw_usuarios;
CREATE VIEW vw_matriculas AS
SELECT m.id_matricula,
    p.nombre,
    p.apellido1,
    m.fecha_matricula,
    m.periodo_lectivo,
    m.anio_lectivo,
    m.tipo_matricula,
    m.estado_matricula
FROM matricula m
    INNER JOIN estudiante e ON m.id_estudiante = e.id_estudiante
    INNER JOIN persona p ON e.id_persona = p.id_persona;
SELECT *
FROM vw_matriculas;
CREATE VIEW vw_detalle_matricula AS
SELECT dm.id_detalle_matricula,
    p.nombre,
    p.apellido1,
    m.id_matricula,
    m.periodo_lectivo,
    m.anio_lectivo,
    g.nombre_grupo,
    dm.fecha_asignacion,
    dm.estado
FROM detalle_matricula dm
    INNER JOIN matricula m ON dm.id_matricula = m.id_matricula
    INNER JOIN estudiante e ON m.id_estudiante = e.id_estudiante
    INNER JOIN persona p ON e.id_persona = p.id_persona
    INNER JOIN grupo g ON dm.id_grupo = g.id_grupo;
SELECT *
FROM vw_detalle_matricula;
CREATE VIEW vw_asistencia AS
SELECT a.id_asistencia,
    pe.nombre AS estudiante,
    pe.apellido1,
    pr.nombre AS profesor,
    g.nombre_grupo,
    a.fecha,
    a.estado_asistencia
FROM asistencia a
    INNER JOIN estudiante e ON a.id_estudiante = e.id_estudiante
    INNER JOIN persona pe ON e.id_persona = pe.id_persona
    INNER JOIN profesor prof ON a.id_profesor = prof.id_profesor
    INNER JOIN persona pr ON prof.id_persona = pr.id_persona
    INNER JOIN grupo g ON a.id_grupo = g.id_grupo;
SELECT *
FROM vw_asistencia;
-- ======================================================
-- MÓDULOS DE CONSULTA
-- ======================================================
-- Buscar estudiantes por apellido
SELECT nombre,
    apellido1,
    estado
FROM vw_estudiantes
ORDER BY apellido1;
-- Mostrar profesores ordenados por nombre
SELECT nombre,
    apellido1,
    materia
FROM vw_profesores
ORDER BY nombre;
-- Mostrar usuarios y su rol
SELECT nombre,
    apellido1,
    nom_rol
FROM vw_usuarios
ORDER BY nom_rol;
-- Mostrar matrículas más recientes
SELECT *
FROM vw_matriculas
ORDER BY fecha_matricula DESC;
-- Mostrar asistencias ordenadas por fecha
SELECT estudiante,
    profesor,
    nombre_grupo,
    fecha,
    estado_asistencia
FROM vw_asistencia
ORDER BY fecha DESC;
-- ======================================================
-- Datos base para el login de la aplicación
-- (roles + usuario Administrador + usuario Asistente)
-- ======================================================
DROP TRIGGER IF EXISTS trg_persona_after_insert;

INSERT INTO rol (nom_rol, descripcion) VALUES
    ('Administrador', 'Acceso total al sistema'),
    ('Asistente', 'Gestión operativa: estudiantes, matrícula y asistencia'),
    ('Profesor', 'Gestión de notas y asistencia de sus grupos');

INSERT INTO persona (nombre, apellido1, apellido2, fecha_nacimiento, genero, estado) VALUES
    ('Sistema', 'Admin', 'EduControl', '2000-01-01', 'O', 1),
    ('Asistente', 'De', 'Prueba', '2000-01-01', 'O', 1);

SET @persona_admin = (SELECT id_persona FROM persona WHERE nombre = 'Sistema' AND apellido1 = 'Admin' LIMIT 1);
SET @persona_asistente = (SELECT id_persona FROM persona WHERE nombre = 'Asistente' AND apellido1 = 'De' LIMIT 1);
SET @rol_admin = (SELECT id_rol FROM rol WHERE nom_rol = 'Administrador' LIMIT 1);
SET @rol_asistente = (SELECT id_rol FROM rol WHERE nom_rol = 'Asistente' LIMIT 1);

INSERT INTO usuario (correo, contrasena, estado, id_rol, id_persona) VALUES
    ('admin@educontrol.com', '$2b$10$a02HCSGrmwToygGu7MO1GuVFiUOIkNNbz/GDTDk0QxvNuG6w8XNiK', 1, @rol_admin, @persona_admin),
    ('asistente@educontrol.com', '$2b$10$TjZtKoFPpchOH4FfQjxtv.v8lRU3MqxkeHyPi7F8V5dWTUlqJTOZ2', 1, @rol_asistente, @persona_asistente);

-- Recreamos el trigger de auditoría
DELIMITER ^^
CREATE TRIGGER trg_persona_after_insert
AFTER
INSERT ON persona FOR EACH ROW BEGIN
INSERT INTO auditoria(
        nombre_tabla,
        accion_usuario,
        datos_anteriores,
        datos_nuevos,
        fecha_creacion,
        fecha_modificacion,
        id_usuario
    )
VALUES(
        'persona',
        'INSERT',
        NULL,
        JSON_OBJECT(
            'id_persona',
            NEW.id_persona,
            'nombre',
            NEW.nombre,
            'apellido1',
            NEW.apellido1,
            'apellido2',
            NEW.apellido2,
            'fecha_nacimiento',
            NEW.fecha_nacimiento,
            'genero',
            NEW.genero,
            'estado',
            NEW.estado
        ),
        NOW(),
        NOW(),
        NULLIF(@id_usuario_sesion, 0)
    );
END ^^
DELIMITER ;
-- ======================================================
-- CONFIGURACIÓN INICIAL DEL MÓDULO FINANCIERO
-- ======================================================
INSERT INTO concepto_cobro
    (codigo, nombre, descripcion, tipo, monto_base, impuesto_tarifa, moneda, estado)
VALUES
    ('MATRICULA', 'Matrícula', 'Derecho de matrícula del ciclo lectivo', 'matricula', 35000.00, 0.00, 'CRC', TRUE),
    ('MENSUALIDAD', 'Mensualidad', 'Servicio educativo mensual', 'mensualidad', 45000.00, 0.00, 'CRC', TRUE),
    ('TRANSPORTE', 'Transporte', 'Servicio de transporte estudiantil', 'servicio', 20000.00, 0.00, 'CRC', TRUE),
    ('COMEDOR', 'Comedor', 'Servicio de comedor estudiantil', 'servicio', 25000.00, 0.00, 'CRC', TRUE),
    ('MATERIALES', 'Materiales', 'Materiales y recursos educativos', 'servicio', 15000.00, 0.00, 'CRC', TRUE),
    ('EXTRACURRICULAR', 'Actividad extracurricular', 'Actividad extracurricular', 'servicio', 10000.00, 0.00, 'CRC', TRUE),
    ('HORAS_EXTRA', 'Horas extra de clase', 'Clase adicional programada fuera del horario regular del profesor', 'servicio', 10000.00, 0.00, 'CRC', TRUE);

INSERT INTO configuracion_facturacion
    (id_configuracion, institucion_nombre, tipo_identificacion, numero_identificacion, correo, moneda, condicion_venta, estado)
VALUES
    (1, 'EduControl Escuela Privada', '02', '3-101-000000', 'facturacion@educontrol.com', 'CRC', '01', TRUE);

CREATE OR REPLACE VIEW vw_estado_cuenta_estudiante AS
SELECT
    c.id_cargo,
    c.id_estudiante,
    CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante,
    cc.nombre AS concepto,
    c.descripcion,
    c.periodo,
    c.fecha_emision,
    c.fecha_vencimiento,
    c.total,
    c.saldo,
    c.estado,
    fc.id_factura_externa,
    fc.estado_factura
FROM cargo_estudiante c
INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
INNER JOIN persona p ON p.id_persona = e.id_persona
INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo;

SELECT 'sistema_escolar_db listo' AS estado;
-- nuevo