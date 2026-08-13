import pool from "../config/database.js";
import { generarFacturaDeCargo } from "./facturacionIntegrationService.js";

function positiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field} no es válido.`);
  return n;
}

function money(value, field, allowZero = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) {
    throw new Error(`${field} debe ser un monto válido.`);
  }
  return Math.round(n * 100) / 100;
}

export async function obtenerResumenFinanciero() {
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*) AS total_cargos,
       COALESCE(SUM(CASE WHEN estado IN ('pendiente','parcial') THEN saldo ELSE 0 END), 0) AS pendiente,
       COALESCE(SUM(CASE WHEN estado = 'pagado' THEN total ELSE 0 END), 0) AS cobrado,
       SUM(CASE WHEN estado IN ('pendiente','parcial') AND fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END) AS vencidos
     FROM cargo_estudiante
     WHERE estado <> 'anulado'`
  );

  return {
    total_cargos: Number(row.total_cargos || 0),
    pendiente: Number(row.pendiente || 0),
    cobrado: Number(row.cobrado || 0),
    vencidos: Number(row.vencidos || 0)
  };
}

export async function listarConceptos() {
  const [rows] = await pool.query(
    `SELECT * FROM concepto_cobro ORDER BY estado DESC, tipo, nombre`
  );
  return rows;
}

export async function crearConcepto(datos) {
  const codigo = String(datos.codigo || "").trim().toUpperCase().replace(/\s+/g, "_");
  const nombre = String(datos.nombre || "").trim();
  const tipo = String(datos.tipo || "otro").trim().toLowerCase();
  const monto = money(datos.monto_base, "El monto base", true);
  const tarifa = money(datos.impuesto_tarifa ?? 0, "La tarifa de impuesto", true);

  if (!codigo || !nombre) throw new Error("Código y nombre son obligatorios.");
  if (!['matricula','mensualidad','servicio','otro'].includes(tipo)) throw new Error("Tipo de concepto no válido.");
  if (tarifa > 100) throw new Error("La tarifa de impuesto no puede superar 100%.");

  const [result] = await pool.query(
    `INSERT INTO concepto_cobro
      (codigo, nombre, descripcion, tipo, monto_base, impuesto_tarifa, moneda, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'CRC', TRUE)`,
    [codigo, nombre, String(datos.descripcion || "").trim() || null, tipo, monto, tarifa]
  );

  return { id_concepto: result.insertId, codigo, nombre };
}

export async function actualizarConcepto(id, datos) {
  const idConcepto = positiveInt(id, "El concepto");
  const monto = money(datos.monto_base, "El monto base", true);
  const tarifa = money(datos.impuesto_tarifa ?? 0, "La tarifa de impuesto", true);
  if (tarifa > 100) throw new Error("La tarifa de impuesto no puede superar 100%.");

  await pool.query(
    `UPDATE concepto_cobro
     SET nombre = ?, descripcion = ?, monto_base = ?, impuesto_tarifa = ?, estado = ?
     WHERE id_concepto = ?`,
    [
      String(datos.nombre || "").trim(),
      String(datos.descripcion || "").trim() || null,
      monto,
      tarifa,
      datos.estado === false || datos.estado === 0 ? 0 : 1,
      idConcepto
    ]
  );
  return { id_concepto: idConcepto };
}

export async function listarCargos(filtros = {}) {
  const conditions = ["c.estado <> 'anulado'"];
  const values = [];

  if (filtros.estado && ['pendiente','parcial','pagado','anulado'].includes(String(filtros.estado))) {
    conditions.push("c.estado = ?");
    values.push(String(filtros.estado));
  }

  if (filtros.id_estudiante) {
    conditions.push("c.id_estudiante = ?");
    values.push(positiveInt(filtros.id_estudiante, "El estudiante"));
  }

  if (filtros.busqueda) {
    const text = `%${String(filtros.busqueda).trim()}%`;
    conditions.push(`(
      p.nombre LIKE ? OR p.apellido1 LIKE ? OR p.apellido2 LIKE ? OR
      cc.nombre LIKE ? OR c.descripcion LIKE ? OR CAST(e.id_estudiante AS CHAR) LIKE ?
    )`);
    values.push(text, text, text, text, text, text);
  }

  const [rows] = await pool.query(
    `SELECT
       c.id_cargo, c.id_estudiante, c.id_concepto, c.id_matricula,
       c.descripcion, c.periodo, c.fecha_emision, c.fecha_vencimiento,
       c.monto_base, c.descuento, c.impuesto, c.total, c.saldo, c.estado,
       cc.codigo AS concepto_codigo, cc.nombre AS concepto_nombre, cc.tipo AS concepto_tipo,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre,
       fc.id_factura_externa, fc.estado_factura, fc.error_mensaje
     FROM cargo_estudiante c
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
     INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     INNER JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       FIELD(c.estado, 'pendiente', 'parcial', 'pagado', 'anulado'),
       c.fecha_vencimiento ASC, c.id_cargo DESC
     LIMIT 1000`,
    values
  );
  return rows;
}

export async function crearCargo(datos, idUsuario) {
  const idEstudiante = positiveInt(datos.id_estudiante, "El estudiante");
  const idConcepto = positiveInt(datos.id_concepto, "El concepto");

  const [[estudiante]] = await pool.query(
    `SELECT id_estudiante FROM estudiante WHERE id_estudiante = ? AND estado = TRUE`,
    [idEstudiante]
  );
  if (!estudiante) throw new Error("El estudiante no existe o está inactivo.");

  const [[concepto]] = await pool.query(
    `SELECT * FROM concepto_cobro WHERE id_concepto = ? AND estado = TRUE`,
    [idConcepto]
  );
  if (!concepto) throw new Error("El concepto de cobro no existe o está inactivo.");

  const base = datos.monto_base === undefined || datos.monto_base === ""
    ? Number(concepto.monto_base)
    : money(datos.monto_base, "El monto base", true);
  const descuento = money(datos.descuento ?? 0, "El descuento", true);
  if (descuento > base) throw new Error("El descuento no puede ser mayor al monto base.");
  const subtotal = base - descuento;
  const tarifa = Number(concepto.impuesto_tarifa || 0);
  const impuesto = Math.round((subtotal * tarifa / 100) * 100) / 100;
  const total = Math.round((subtotal + impuesto) * 100) / 100;
  if (total <= 0) throw new Error("El total del cargo debe ser mayor que cero.");

  const descripcion = String(datos.descripcion || concepto.nombre).trim().slice(0, 200);
  const periodo = String(datos.periodo || "").trim().slice(0, 30) || null;
  const fechaEmision = datos.fecha_emision || new Date().toISOString().slice(0, 10);
  const fechaVencimiento = datos.fecha_vencimiento || null;

  const [result] = await pool.query(
    `INSERT INTO cargo_estudiante
      (id_estudiante, id_concepto, id_matricula, descripcion, periodo,
       fecha_emision, fecha_vencimiento, monto_base, descuento, impuesto, total, saldo,
       estado, id_usuario_crea)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
    [
      idEstudiante, idConcepto, datos.id_matricula || null, descripcion, periodo,
      fechaEmision, fechaVencimiento, base, descuento, impuesto, total, total,
      idUsuario || null
    ]
  );

  return { id_cargo: result.insertId, total, saldo: total, estado: 'pendiente' };
}

export async function crearCargoMatriculaSiCorresponde({ id_matricula, id_estudiante, id_usuario, anio }) {
  if (!id_matricula || !id_estudiante) return null;

  const [[concepto]] = await pool.query(
    `SELECT id_concepto FROM concepto_cobro WHERE codigo = 'MATRICULA' AND estado = TRUE LIMIT 1`
  );
  if (!concepto) return null;

  const [[existe]] = await pool.query(
    `SELECT id_cargo FROM cargo_estudiante WHERE id_matricula = ? AND id_concepto = ? LIMIT 1`,
    [id_matricula, concepto.id_concepto]
  );
  if (existe) return existe;

  return crearCargo({
    id_estudiante,
    id_concepto: concepto.id_concepto,
    id_matricula,
    periodo: String(anio || new Date().getFullYear()),
    descripcion: `Matrícula ciclo lectivo ${anio || new Date().getFullYear()}`,
    fecha_emision: new Date().toISOString().slice(0, 10)
  }, id_usuario);
}

export async function listarPagos(filtros = {}) {
  const values = [];
  let where = "WHERE pg.estado = 'aplicado'";
  if (filtros.id_estudiante) {
    where += " AND c.id_estudiante = ?";
    values.push(positiveInt(filtros.id_estudiante, "El estudiante"));
  }

  const [rows] = await pool.query(
    `SELECT
       pg.id_pago, pg.id_cargo, pg.fecha_pago, pg.monto, pg.metodo_pago, pg.referencia,
       c.descripcion, c.total AS total_cargo, c.saldo, c.estado AS estado_cargo,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre,
       fc.id_factura_externa, fc.estado_factura
     FROM pago pg
     INNER JOIN cargo_estudiante c ON c.id_cargo = pg.id_cargo
     INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     INNER JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo
     ${where}
     ORDER BY pg.fecha_pago DESC, pg.id_pago DESC
     LIMIT 1000`,
    values
  );
  return rows;
}

export async function registrarPago(idCargo, datos, idUsuario) {
  const cargoId = positiveInt(idCargo, "El cargo");
  const montoPago = money(datos.monto, "El monto del pago");
  const metodo = String(datos.metodo_pago || "").trim().toLowerCase();
  if (!['efectivo','tarjeta','transferencia','sinpe','otro'].includes(metodo)) {
    throw new Error("Método de pago no válido.");
  }

  const connection = await pool.getConnection();
  let cargoPagado = false;

  try {
    await connection.beginTransaction();

    const [cargoRows] = await connection.query(
      `SELECT * FROM cargo_estudiante WHERE id_cargo = ? FOR UPDATE`,
      [cargoId]
    );
    if (!cargoRows.length) throw new Error("Cargo no encontrado.");
    const cargo = cargoRows[0];
    if (cargo.estado === 'anulado') throw new Error("El cargo está anulado.");
    if (cargo.estado === 'pagado' || Number(cargo.saldo) <= 0) throw new Error("El cargo ya está pagado.");
    if (montoPago > Number(cargo.saldo) + 0.001) {
      throw new Error(`El pago no puede superar el saldo pendiente de ₡${Number(cargo.saldo).toFixed(2)}.`);
    }

    if (datos.responsable) {
      await upsertResponsable(connection, cargo.id_estudiante, datos.responsable);
    }

    const [pagoResult] = await connection.query(
      `INSERT INTO pago
       (id_cargo, fecha_pago, monto, metodo_pago, referencia, estado, id_usuario)
       VALUES (?, NOW(), ?, ?, ?, 'aplicado', ?)`,
      [cargoId, montoPago, metodo, String(datos.referencia || '').trim().slice(0, 100) || null, idUsuario || null]
    );

    const saldoNuevo = Math.max(0, Math.round((Number(cargo.saldo) - montoPago) * 100) / 100);
    cargoPagado = saldoNuevo <= 0;
    await connection.query(
      `UPDATE cargo_estudiante SET saldo = ?, estado = ? WHERE id_cargo = ?`,
      [saldoNuevo, cargoPagado ? 'pagado' : 'parcial', cargoId]
    );

    await connection.commit();

    let facturacion = {
      ok: false,
      estado: cargoPagado ? 'pendiente' : 'pendiente_pago',
      mensaje: cargoPagado
        ? 'Pago aplicado. La factura puede generarse con el servicio externo.'
        : 'Pago parcial aplicado. La factura se generará al completar el cargo.'
    };

    if (cargoPagado) {
      facturacion = await generarFacturaDeCargo(cargoId, metodo);
    }

    return {
      id_pago: pagoResult.insertId,
      id_cargo: cargoId,
      saldo: saldoNuevo,
      estado_cargo: cargoPagado ? 'pagado' : 'parcial',
      facturacion
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function upsertResponsable(connection, idEstudiante, datos) {
  const nombre = String(datos.nombre || '').trim();
  const correo = String(datos.correo || '').trim().toLowerCase();
  const numeroId = String(datos.numero_identificacion || '').trim();
  if (!nombre || !correo) {
    throw new Error("Nombre y correo del responsable de pago son obligatorios para facturación.");
  }

  await connection.query(
    `UPDATE responsable_pago SET principal = FALSE WHERE id_estudiante = ?`,
    [idEstudiante]
  );

  const [rows] = await connection.query(
    `SELECT id_responsable FROM responsable_pago
     WHERE id_estudiante = ? AND correo = ? LIMIT 1`,
    [idEstudiante, correo]
  );

  if (rows.length) {
    await connection.query(
      `UPDATE responsable_pago
       SET nombre = ?, parentesco = ?, telefono = ?, tipo_identificacion = ?, numero_identificacion = ?, principal = TRUE, estado = TRUE
       WHERE id_responsable = ?`,
      [
        nombre,
        String(datos.parentesco || '').trim() || null,
        String(datos.telefono || '').trim() || null,
        String(datos.tipo_identificacion || '01').trim(),
        numeroId || null,
        rows[0].id_responsable
      ]
    );
  } else {
    await connection.query(
      `INSERT INTO responsable_pago
       (id_estudiante, nombre, parentesco, telefono, correo, tipo_identificacion, numero_identificacion, principal, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
      [
        idEstudiante,
        nombre,
        String(datos.parentesco || '').trim() || null,
        String(datos.telefono || '').trim() || null,
        correo,
        String(datos.tipo_identificacion || '01').trim(),
        numeroId || null
      ]
    );
  }
}

export async function obtenerResponsablePrincipal(idEstudiante) {
  const id = positiveInt(idEstudiante, "El estudiante");
  const [rows] = await pool.query(
    `SELECT id_responsable, id_estudiante, nombre, parentesco, telefono, correo,
            tipo_identificacion, numero_identificacion, principal
     FROM responsable_pago
     WHERE id_estudiante = ? AND principal = TRUE AND estado = TRUE
     ORDER BY id_responsable DESC LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function reintentarFactura(idCargo, metodoPago = 'otro') {
  return generarFacturaDeCargo(positiveInt(idCargo, "El cargo"), metodoPago);
}
