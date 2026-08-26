import conexion, { queryConSesion } from "../config/database.js";

export const ROLES_PERMITIDOS = ["administrador", "asistente", "profesor"];

export const obtenerUsuarioPorCorreo = async (correo) => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.contrasena,
            u.estado,
            r.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2,
            p.foto,
            pr.id_profesor
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN profesor pr ON pr.id_persona = p.id_persona
        WHERE u.correo = ?
        LIMIT 1;
    `;
    const [rows] = await conexion.query(sql, [correo]);
    return rows[0];
};

export const obtenerUsuarios = async () => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.estado,
            u.id_rol,
            r.nom_rol,
            u.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2,
            p.foto
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        WHERE u.estado = 1
        ORDER BY u.id_usuario;
    `;
    const [rows] = await conexion.query(sql);
    return rows;
};

export const crearUsuario = async (usuario, idUsuario) => {
    const sql = `
        INSERT INTO usuario (correo, contrasena, id_persona, id_rol, estado)
        VALUES (?, ?, ?, ?, ?);
    `;
    const resultado = await queryConSesion(sql, [
        usuario.correo,
        usuario.contrasena,
        usuario.id_persona,
        usuario.id_rol,
        usuario.estado ?? 1
    ], idUsuario);
    return resultado;
};

export const actualizarUsuario = async (id, usuario, idUsuario) => {
    const sql = `
        UPDATE usuario
        SET correo = ?, contrasena = ?, id_persona = ?, id_rol = ?, estado = ?
        WHERE id_usuario = ?;
    `;
    const resultado = await queryConSesion(sql, [
        usuario.correo,
        usuario.contrasena,
        usuario.id_persona,
        usuario.id_rol,
        usuario.estado,
        id
    ], idUsuario);
    return resultado;
};

export const actualizarPersonaUsuario = async (idPersona, datos, idUsuario) => {
    const sql = `
        UPDATE persona
        SET nombre = ?, apellido1 = ?
        WHERE id_persona = ?;
    `;
    return queryConSesion(sql, [datos.nombre, datos.apellido1, idPersona], idUsuario);
};

export const eliminarUsuario = async (id, idUsuario) => {
    const sql = `UPDATE usuario SET estado = 0 WHERE id_usuario = ?;`;
    const resultado = await queryConSesion(sql, [id], idUsuario);
    return resultado;
};

export const obtenerUsuarioConClavePorId = async (id) => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.contrasena,
            u.estado,
            r.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2,
            p.foto,
            pr.id_profesor
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN profesor pr ON pr.id_persona = p.id_persona
        WHERE u.id_usuario = ?
        LIMIT 1;
    `;
    const [rows] = await conexion.query(sql, [id]);
    return rows[0];
};

export const obtenerUsuarioPorId = async (id) => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.estado,
            r.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2,
            p.foto,
            pr.id_profesor
        FROM usuario u
        JOIN rol r ON r.id_rol = u.id_rol
        JOIN persona p ON p.id_persona = u.id_persona
        LEFT JOIN profesor pr ON pr.id_persona = p.id_persona
        WHERE u.id_usuario = ?
        LIMIT 1;
    `;
    const [rows] = await conexion.query(sql, [id]);
    return rows[0];
};

export const actualizarDatosPerfil = async (idUsuario, datosPerfil) => {
    const connection = await conexion.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query("SET @id_usuario_sesion = ?", [idUsuario ?? 0]);

        const [usuarios] = await connection.query(
            `SELECT id_persona FROM usuario WHERE id_usuario = ? AND estado = TRUE LIMIT 1`,
            [idUsuario]
        );

        const idPersona = usuarios[0]?.id_persona;
        if (!idPersona) {
            const error = new Error("Usuario no encontrado o inactivo.");
            error.code = "USUARIO_NO_ENCONTRADO";
            throw error;
        }

        await connection.query(
            `UPDATE persona
             SET nombre = ?, apellido1 = ?, apellido2 = ?, foto = COALESCE(?, foto)
             WHERE id_persona = ?`,
            [
                datosPerfil.nombre,
                datosPerfil.apellido1,
                datosPerfil.apellido2 ?? "",
                datosPerfil.foto || null,
                idPersona
            ]
        );

        await connection.query(
            `UPDATE usuario SET correo = ? WHERE id_usuario = ?`,
            [datosPerfil.correo, idUsuario]
        );

        await connection.commit();
        return { affectedRows: 1, id_persona: idPersona };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const actualizarContrasenaPerfil = async (
    idUsuario,
    contrasenaNueva
) => {
    const sql = `
        UPDATE usuario
        SET contrasena = ?
        WHERE id_usuario = ?;
    `;

    const resultado = await queryConSesion(
        sql,
        [
            contrasenaNueva,
            idUsuario
        ],
        idUsuario
    );

    return resultado;
};

export const obtenerUsuarioPerfilPorId = async (
    idUsuario
) => {
    const sql = `
        SELECT
            u.id_usuario,
            u.correo,
            u.contrasena,
            u.estado,
            u.id_rol,
            r.nom_rol,
            p.id_persona,
            p.nombre,
            p.apellido1,
            p.apellido2,
            p.foto,
            pr.id_profesor
        FROM usuario u
        INNER JOIN rol r
          ON r.id_rol = u.id_rol
        INNER JOIN persona p
          ON p.id_persona = u.id_persona
        LEFT JOIN profesor pr
          ON pr.id_persona = p.id_persona
        WHERE u.id_usuario = ?
        LIMIT 1;
    `;

    const [rows] = await conexion.query(
        sql,
        [idUsuario]
    );

    return rows[0];
};

export const usuarioTienePermiso = async (idUsuario, codigo) => {
  const [rows] = await conexion.query(`
    SELECT COALESCE(upa.permitido, rpa.permitido, FALSE) AS permitido
    FROM usuario u
    INNER JOIN permiso_accion pa ON pa.codigo = ?
    LEFT JOIN usuario_permiso_accion upa ON upa.id_usuario = u.id_usuario AND upa.id_permiso = pa.id_permiso
    LEFT JOIN rol_permiso_accion rpa ON rpa.id_rol = u.id_rol AND rpa.id_permiso = pa.id_permiso
    WHERE u.id_usuario = ? AND u.estado = TRUE
    LIMIT 1
  `, [codigo, idUsuario]);
  return !!rows[0]?.permitido;
};

export const obtenerPermisosUsuario = async (idUsuario) => {
  const [rows] = await conexion.query(`
    SELECT pa.codigo, pa.nombre, pa.descripcion, COALESCE(upa.permitido, rpa.permitido, FALSE) AS permitido
    FROM usuario u
    CROSS JOIN permiso_accion pa
    LEFT JOIN usuario_permiso_accion upa ON upa.id_usuario = u.id_usuario AND upa.id_permiso = pa.id_permiso
    LEFT JOIN rol_permiso_accion rpa ON rpa.id_rol = u.id_rol AND rpa.id_permiso = pa.id_permiso
    WHERE u.id_usuario = ? ORDER BY pa.codigo
  `, [idUsuario]);
  return rows;
};

export const actualizarPermisosUsuario = async (idUsuario, permisos = []) => {
  const connection = await conexion.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM usuario_permiso_accion WHERE id_usuario = ?`, [idUsuario]);
    for (const item of permisos) {
      const codigo = String(item?.codigo || '').trim();
      if (!codigo) continue;
      const [[permiso]] = await connection.query(`SELECT id_permiso FROM permiso_accion WHERE codigo = ? LIMIT 1`, [codigo]);
      if (!permiso) continue;
      await connection.query(
        `INSERT INTO usuario_permiso_accion (id_usuario, id_permiso, permitido) VALUES (?, ?, ?)`,
        [idUsuario, permiso.id_permiso, Boolean(item.permitido)]
      );
    }
    await connection.commit();
    return obtenerPermisosUsuario(idUsuario);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally { connection.release(); }
};
