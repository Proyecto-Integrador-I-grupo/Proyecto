import pool from "../config/database.js";
import { generarFacturaDeCargo, reconciliarFacturasEduControl } from "./facturacionIntegrationService.js";

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

async function normalizarDescuentosVencidos(db = pool, idCargo = null) {
  const filtroCargo = idCargo ? " AND c.id_cargo = ?" : "";
  const params = idCargo ? [positiveInt(idCargo, "El cargo")] : [];
  await db.query(`
    UPDATE cargo_estudiante c
    INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
    LEFT JOIN (
      SELECT id_cargo, COALESCE(SUM(monto), 0) AS pagado
      FROM pago
      WHERE estado = 'aplicado'
      GROUP BY id_cargo
    ) pg ON pg.id_cargo = c.id_cargo
    SET
      c.descuento = 0,
      c.impuesto = ROUND(c.monto_base * COALESCE(cc.impuesto_tarifa, 0) / 100, 2),
      c.total = ROUND(c.monto_base + (c.monto_base * COALESCE(cc.impuesto_tarifa, 0) / 100), 2),
      c.saldo = GREATEST(0, ROUND((c.monto_base + (c.monto_base * COALESCE(cc.impuesto_tarifa, 0) / 100)) - COALESCE(pg.pagado, 0), 2)),
      c.estado = CASE
        WHEN ROUND((c.monto_base + (c.monto_base * COALESCE(cc.impuesto_tarifa, 0) / 100)) - COALESCE(pg.pagado, 0), 2) <= 0 THEN 'pagado'
        WHEN COALESCE(pg.pagado, 0) > 0 THEN 'parcial'
        ELSE 'pendiente'
      END
    WHERE c.estado IN ('pendiente', 'parcial')
      AND c.fecha_vencimiento IS NOT NULL
      AND c.fecha_vencimiento < CURDATE()
      AND c.descuento > 0${filtroCargo}
  `, params);
}

async function validarDescuentoVigente(fechaVencimiento, descuento, db = pool) {
  if (!(Number(descuento) > 0) || !fechaVencimiento) return;
  const fecha = String(fechaVencimiento).slice(0, 10);
  const [[row]] = await db.query(
    `SELECT CASE WHEN DATE(?) < CURDATE() THEN 1 ELSE 0 END AS vencida`,
    [fecha]
  );
  if (Number(row?.vencida || 0) === 1) {
    throw new Error('No se puede aplicar un descuento a un cargo vencido. Cambia la fecha de vencimiento a una fecha vigente o deja el descuento en CRC 0.');
  }
}

export async function obtenerResumenFinanciero() {
  await prepararDatosFinancieros();
  await normalizarDescuentosVencidos();
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


export async function asegurarCargoMatriculaPreRegistro(idEstudiante, idUsuario = null, anio = null) {
  const estudianteId = positiveInt(idEstudiante, "El estudiante");
  const periodo = String(anio || new Date().getFullYear());

  const [[estudiante]] = await pool.query(
    `SELECT e.id_estudiante
     FROM estudiante e
     WHERE e.id_estudiante = ?
       AND e.estado = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM grupo_estudiante ge
         WHERE ge.id_estudiante = e.id_estudiante AND ge.estado = TRUE
       )
     LIMIT 1`,
    [estudianteId]
  );
  if (!estudiante) return null;

  const [[concepto]] = await pool.query(
    `SELECT id_concepto
     FROM concepto_cobro
     WHERE codigo = 'MATRICULA' AND estado = TRUE
     LIMIT 1`
  );
  if (!concepto) return null;

  const [[existente]] = await pool.query(
    `SELECT c.id_cargo, c.total, c.saldo, c.estado
     FROM cargo_estudiante c
     LEFT JOIN matricula m ON m.id_matricula = c.id_matricula
     WHERE c.id_estudiante = ?
       AND c.id_concepto = ?
       AND c.estado <> 'anulado'
       AND (
         c.periodo = ?
         OR c.periodo IS NULL
         OR c.periodo = ''
         OR CAST(m.anio_lectivo AS CHAR) = ?
         OR (c.estado = 'pagado' AND YEAR(c.fecha_emision) = ?)
       )
     ORDER BY (c.estado = 'pagado') DESC, c.id_cargo DESC
     LIMIT 1`,
    [estudianteId, concepto.id_concepto, periodo, periodo, Number(periodo)]
  );
  if (existente) return existente;

  return crearCargo({
    id_estudiante: estudianteId,
    id_concepto: concepto.id_concepto,
    periodo,
    descripcion: `Matrícula ciclo lectivo ${periodo}`,
    fecha_emision: new Date().toISOString().slice(0, 10)
  }, idUsuario);
}

export async function asegurarCargosMatriculaPreRegistro() {
  const [rows] = await pool.query(
    `SELECT e.id_estudiante
     FROM estudiante e
     WHERE e.estado = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM grupo_estudiante ge
         WHERE ge.id_estudiante = e.id_estudiante AND ge.estado = TRUE
       )
     ORDER BY e.id_estudiante`
  );

  let creados = 0;
  for (const row of rows) {
    const antes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM cargo_estudiante c
       INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
       WHERE c.id_estudiante = ? AND cc.codigo = 'MATRICULA'
         AND c.estado <> 'anulado'
         AND (c.periodo = ? OR c.periodo IS NULL OR c.periodo = '')`,
      [row.id_estudiante, String(new Date().getFullYear())]
    );
    const tenia = Number(antes[0]?.[0]?.total || 0) > 0;
    await asegurarCargoMatriculaPreRegistro(row.id_estudiante, null);
    if (!tenia) creados += 1;
  }
  return { creados };
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


async function normalizarEstadosCargosPorPagos() {
  // La fuente de verdad del estado financiero es la suma de pagos aplicados.
  // Primero recuperamos cargos históricos cuyo total quedó en 0 pero sí tienen
  // pagos reales. En ese caso el monto pagado es la mejor evidencia disponible
  // del importe que debe quedar conciliado para facturación y reportes.
  await pool.query(
    `UPDATE cargo_estudiante c
     INNER JOIN (
       SELECT id_cargo, ROUND(COALESCE(SUM(monto), 0), 2) AS total_pagado
       FROM pago
       WHERE estado = 'aplicado'
       GROUP BY id_cargo
     ) pg ON pg.id_cargo = c.id_cargo
     SET
       c.monto_base = CASE WHEN c.monto_base <= 0 THEN pg.total_pagado ELSE c.monto_base END,
       c.total = CASE WHEN c.total <= 0 THEN pg.total_pagado ELSE c.total END,
       c.saldo = CASE WHEN c.total <= 0 THEN 0 ELSE GREATEST(0, ROUND(c.total - pg.total_pagado, 2)) END,
       c.estado = CASE
         WHEN c.estado = 'anulado' THEN 'anulado'
         WHEN pg.total_pagado > 0 AND (c.total <= 0 OR pg.total_pagado >= c.total) THEN 'pagado'
         WHEN pg.total_pagado > 0 THEN 'parcial'
         ELSE 'pendiente'
       END
     WHERE c.estado <> 'anulado'
       AND pg.total_pagado > 0`
  );

  // Después normalizamos todos los cargos con total válido. Es importante no
  // convertir automáticamente un cargo de total 0 y sin pagos en "pagado":
  // esos registros requieren corrección del monto y no deben aparecer como
  // facturas pendientes.
  await pool.query(
    `UPDATE cargo_estudiante c
     LEFT JOIN (
       SELECT id_cargo, ROUND(COALESCE(SUM(monto), 0), 2) AS total_pagado
       FROM pago
       WHERE estado = 'aplicado'
       GROUP BY id_cargo
     ) pg ON pg.id_cargo = c.id_cargo
     SET
       c.saldo = CASE
         WHEN c.total > 0 THEN GREATEST(0, ROUND(c.total - COALESCE(pg.total_pagado, 0), 2))
         ELSE 0
       END,
       c.estado = CASE
         WHEN c.estado = 'anulado' THEN 'anulado'
         WHEN c.total <= 0 AND COALESCE(pg.total_pagado, 0) <= 0 THEN 'pendiente'
         WHEN c.total > 0 AND COALESCE(pg.total_pagado, 0) >= c.total THEN 'pagado'
         WHEN COALESCE(pg.total_pagado, 0) > 0 THEN 'parcial'
         ELSE 'pendiente'
       END
     WHERE c.estado <> 'anulado'`
  );
}

async function normalizarCargosMatriculaDuplicados() {
  const [pagados] = await pool.query(
    `SELECT c.id_estudiante,
            COALESCE(NULLIF(c.periodo,''), CAST(COALESCE(m.anio_lectivo, YEAR(c.fecha_emision)) AS CHAR)) AS periodo_ref,
            MAX(c.id_cargo) AS id_cargo_pagado
     FROM cargo_estudiante c
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto AND cc.codigo = 'MATRICULA'
     LEFT JOIN matricula m ON m.id_matricula = c.id_matricula
     WHERE c.estado = 'pagado'
     GROUP BY c.id_estudiante,
              COALESCE(NULLIF(c.periodo,''), CAST(COALESCE(m.anio_lectivo, YEAR(c.fecha_emision)) AS CHAR))`
  );

  for (const row of pagados) {
    const periodo = String(row.periodo_ref || '').trim();
    if (!periodo) continue;
    await pool.query(
      `UPDATE cargo_estudiante c
       INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto AND cc.codigo = 'MATRICULA'
       LEFT JOIN matricula m ON m.id_matricula = c.id_matricula
       SET c.estado = 'anulado', c.saldo = 0
       WHERE c.id_estudiante = ?
         AND c.id_cargo <> ?
         AND c.estado = 'pendiente'
         AND COALESCE((
           SELECT SUM(pg.monto)
           FROM pago pg
           WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'
         ), 0) = 0
         AND COALESCE(NULLIF(c.periodo,''), CAST(COALESCE(m.anio_lectivo, YEAR(c.fecha_emision)) AS CHAR)) = ?`,
      [row.id_estudiante, row.id_cargo_pagado, periodo]
    );
  }
}


async function asegurarCargosMatriculaActivos(idUsuario = null) {
  const periodo = String(new Date().getFullYear());

  const [[concepto]] = await pool.query(
    `SELECT id_concepto, monto_base
     FROM concepto_cobro
     WHERE codigo = 'MATRICULA' AND estado = TRUE
     LIMIT 1`
  );
  if (!concepto) return { creados: 0 };

  const [estudiantesActivos] = await pool.query(
    `SELECT
       e.id_estudiante,
       m.id_matricula,
       m.anio_lectivo
     FROM estudiante e
     LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante
       AND m.anio_lectivo = ?
       AND m.estado_matricula IN ('activa','pendiente')
     WHERE e.estado = TRUE
     ORDER BY e.id_estudiante`,
    [Number(periodo)]
  );

  let creados = 0;
  for (const estudiante of estudiantesActivos) {
    const [[existente]] = await pool.query(
      `SELECT c.id_cargo, c.estado, c.saldo, c.total
       FROM cargo_estudiante c
       LEFT JOIN matricula cm ON cm.id_matricula = c.id_matricula
       WHERE c.id_estudiante = ?
         AND c.id_concepto = ?
         AND c.estado <> 'anulado'
         AND (
           c.periodo = ?
           OR (c.periodo IS NULL AND YEAR(c.fecha_emision) = ?)
           OR (c.periodo = '' AND YEAR(c.fecha_emision) = ?)
           OR CAST(cm.anio_lectivo AS CHAR) = ?
         )
       ORDER BY (c.estado = 'pagado') DESC, c.id_cargo DESC
       LIMIT 1`,
      [estudiante.id_estudiante, concepto.id_concepto, periodo, Number(periodo), Number(periodo), periodo]
    );

    if (existente) continue;

    await crearCargo({
      id_estudiante: estudiante.id_estudiante,
      id_concepto: concepto.id_concepto,
      id_matricula: estudiante.id_matricula || null,
      periodo,
      descripcion: `Matrícula ciclo lectivo ${periodo}`,
      fecha_emision: new Date().toISOString().slice(0, 10)
    }, idUsuario);
    creados += 1;
  }

  return { creados };
}


async function anularCargosPendientesDeEstudiantesInactivos() {
  await pool.query(
    `UPDATE cargo_estudiante c
     INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     SET c.estado = 'anulado', c.saldo = 0
     WHERE e.estado = FALSE
       AND c.estado IN ('pendiente', 'parcial')`
  );
}

let preparacionFinancieraEnCurso = null;
let ultimaPreparacionFinanciera = 0;
const PREPARACION_FINANCIERA_TTL_MS = 5000;

export async function prepararDatosFinancieros({ force = false } = {}) {
  const ahora = Date.now();
  if (!force && ahora - ultimaPreparacionFinanciera < PREPARACION_FINANCIERA_TTL_MS) return;
  if (preparacionFinancieraEnCurso) return preparacionFinancieraEnCurso;

  preparacionFinancieraEnCurso = (async () => {
    const tareas = [
      normalizarEstadosCargosPorPagos,
      anularCargosPendientesDeEstudiantesInactivos,
      normalizarCargosMatriculaDuplicados,
      asegurarCargosMatriculaActivos,
      normalizarCargosMatriculaDuplicados,
      normalizarEstadosCargosPorPagos
    ];
    for (const tarea of tareas) {
      try {
        await tarea();
      } catch (error) {
        console.error(`Finanzas: mantenimiento no bloqueante (${tarea.name}):`, error.message);
      }
    }
    ultimaPreparacionFinanciera = Date.now();
  })();

  try {
    await preparacionFinancieraEnCurso;
  } finally {
    preparacionFinancieraEnCurso = null;
  }
}

export async function listarEstudiantesFinanzas() {
  await prepararDatosFinancieros();
  // Este catálogo es propio del módulo financiero: no depende de que el
  // estudiante siga en pre-registro o de que tenga un grupo activo.
  // Incluye alumnos activos y también alumnos con movimientos históricos.
  try {
    await asegurarCargosMatriculaPreRegistro();
  } catch (error) {
    console.error('No se pudieron regularizar cargos de pre-registro:', error.message);
  }

  try {
    await normalizarCargosMatriculaDuplicados();
  } catch (error) {
    console.error('No se pudieron normalizar cargos de matrícula:', error.message);
  }

  const [rows] = await pool.query(
    `SELECT
       e.id_estudiante,
       e.id_persona,
       e.estado,
       p.nombre,
       p.apellido1,
       p.apellido2,
       p.fecha_nacimiento,
       e.fecha_ingreso,
       ge.id_grupo,
       g.nombre_grupo,
       s.id_seccion,
       s.nombre_seccion,
       s.nivel,
       COALESCE(fin.total_cargos, 0) AS total_cargos,
       COALESCE(fin.total_pagado, 0) AS total_pagado,
       COALESCE(fin.saldo_pendiente, 0) AS saldo_pendiente,
       fin.ultimo_pago
     FROM estudiante e
     INNER JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN (
       SELECT ge1.id_estudiante, ge1.id_grupo
       FROM grupo_estudiante ge1
       INNER JOIN (
         SELECT id_estudiante, MAX(id_grupo_estudiante) AS max_id
         FROM grupo_estudiante
         WHERE estado = TRUE
         GROUP BY id_estudiante
       ) ult ON ult.max_id = ge1.id_grupo_estudiante
     ) ge ON ge.id_estudiante = e.id_estudiante
     LEFT JOIN grupo g ON g.id_grupo = ge.id_grupo
     LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
     LEFT JOIN (
       SELECT
         c.id_estudiante,
         COUNT(DISTINCT CASE WHEN c.estado <> 'anulado' THEN c.id_cargo END) AS total_cargos,
         COALESCE(SUM(CASE WHEN c.estado <> 'anulado' THEN c.saldo ELSE 0 END), 0) AS saldo_pendiente,
         COALESCE((
           SELECT SUM(pg.monto)
           FROM pago pg
           INNER JOIN cargo_estudiante cp ON cp.id_cargo = pg.id_cargo
           WHERE cp.id_estudiante = c.id_estudiante AND pg.estado = 'aplicado'
         ), 0) AS total_pagado,
         (
           SELECT MAX(pg.fecha_pago)
           FROM pago pg
           INNER JOIN cargo_estudiante cp ON cp.id_cargo = pg.id_cargo
           WHERE cp.id_estudiante = c.id_estudiante AND pg.estado = 'aplicado'
         ) AS ultimo_pago
       FROM cargo_estudiante c
       GROUP BY c.id_estudiante
     ) fin ON fin.id_estudiante = e.id_estudiante
     WHERE e.estado = TRUE
     ORDER BY p.apellido1, p.apellido2, p.nombre, e.id_estudiante`
  );

  return rows.map((row) => ({
    ...row,
    total_cargos: Number(row.total_cargos || 0),
    total_pagado: Number(row.total_pagado || 0),
    saldo_pendiente: Number(row.saldo_pendiente || 0)
  }));
}

export async function listarEstadoCuentas() {
  await prepararDatosFinancieros();

  const [rows] = await pool.query(
    `SELECT
       e.id_estudiante,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre,
       COALESCE(ca.total_cargos, 0) AS total_cargos,
       COALESCE(ca.total_facturado, 0) AS total_facturado,
       COALESCE(ca.saldo_pendiente, 0) AS saldo_pendiente,
       COALESCE(ca.cargos_pagados, 0) AS cargos_pagados,
       COALESCE(ca.cargos_parciales, 0) AS cargos_parciales,
       COALESCE(ca.cargos_pendientes, 0) AS cargos_pendientes,
       COALESCE(ca.cargos_vencidos, 0) AS cargos_vencidos,
       COALESCE(ca.saldo_vencido, 0) AS saldo_vencido,
       COALESCE(pa.total_pagado, 0) AS total_pagado,
       pa.ultimo_pago
     FROM estudiante e
     INNER JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN (
       SELECT
         c.id_estudiante,
         COUNT(*) AS total_cargos,
         COALESCE(SUM(c.total), 0) AS total_facturado,
         COALESCE(SUM(c.saldo), 0) AS saldo_pendiente,
         COALESCE(SUM(CASE WHEN c.estado = 'pagado' THEN 1 ELSE 0 END), 0) AS cargos_pagados,
         COALESCE(SUM(CASE WHEN c.estado = 'parcial' THEN 1 ELSE 0 END), 0) AS cargos_parciales,
         COALESCE(SUM(CASE WHEN c.estado = 'pendiente' THEN 1 ELSE 0 END), 0) AS cargos_pendientes,
         COALESCE(SUM(
           CASE
             WHEN c.estado IN ('pendiente','parcial')
              AND c.saldo > 0
              AND c.fecha_vencimiento IS NOT NULL
              AND c.fecha_vencimiento < CURDATE()
             THEN 1 ELSE 0
           END
         ), 0) AS cargos_vencidos,
         COALESCE(SUM(
           CASE
             WHEN c.estado IN ('pendiente','parcial')
              AND c.saldo > 0
              AND c.fecha_vencimiento IS NOT NULL
              AND c.fecha_vencimiento < CURDATE()
             THEN c.saldo ELSE 0
           END
         ), 0) AS saldo_vencido
       FROM cargo_estudiante c
       WHERE c.estado <> 'anulado'
       GROUP BY c.id_estudiante
     ) ca ON ca.id_estudiante = e.id_estudiante
     LEFT JOIN (
       SELECT
         c.id_estudiante,
         COALESCE(SUM(pg.monto), 0) AS total_pagado,
         MAX(pg.fecha_pago) AS ultimo_pago
       FROM pago pg
       INNER JOIN cargo_estudiante c ON c.id_cargo = pg.id_cargo
       WHERE pg.estado = 'aplicado'
       GROUP BY c.id_estudiante
     ) pa ON pa.id_estudiante = e.id_estudiante
     WHERE e.estado = TRUE
     ORDER BY
       COALESCE(ca.cargos_vencidos, 0) DESC,
       COALESCE(ca.saldo_vencido, 0) DESC,
       COALESCE(ca.saldo_pendiente, 0) DESC,
       estudiante_nombre ASC`
  );

  return rows.map((row) => ({
    ...row,
    total_cargos: Number(row.total_cargos || 0),
    total_facturado: Number(row.total_facturado || 0),
    saldo_pendiente: Number(row.saldo_pendiente || 0),
    total_pagado: Number(row.total_pagado || 0),
    cargos_pagados: Number(row.cargos_pagados || 0),
    cargos_parciales: Number(row.cargos_parciales || 0),
    cargos_pendientes: Number(row.cargos_pendientes || 0),
    cargos_vencidos: Number(row.cargos_vencidos || 0),
    saldo_vencido: Number(row.saldo_vencido || 0)
  }));
}

export async function listarCargos(filtros = {}) {
  await prepararDatosFinancieros();
  await normalizarDescuentosVencidos();
  const conditions = ["c.estado <> 'anulado'", "e.estado = TRUE"];

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


let facturacionPendientesEnCurso = null;

async function facturarCargosPagadosPendientesAutomaticamente() {
  if (facturacionPendientesEnCurso) return facturacionPendientesEnCurso;

  facturacionPendientesEnCurso = (async () => {
    const [pendientes] = await pool.query(
      `SELECT
         c.id_cargo,
         COALESCE((
           SELECT pg.metodo_pago
           FROM pago pg
           WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'
           ORDER BY pg.fecha_pago DESC, pg.id_pago DESC
           LIMIT 1
         ), 'otro') AS metodo_pago
       FROM cargo_estudiante c
       LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo
       WHERE c.estado <> 'anulado'
         AND (c.estado = 'pagado' OR c.saldo <= 0)
         AND (
           c.total > 0 OR
           COALESCE((SELECT SUM(pg2.monto) FROM pago pg2 WHERE pg2.id_cargo = c.id_cargo AND pg2.estado = 'aplicado'), 0) > 0
         )
         AND fc.id_factura_externa IS NULL
       ORDER BY c.fecha_emision ASC, c.id_cargo ASC
       LIMIT 30`
    );

    if (!pendientes.length) return;

    let cursor = 0;
    const workers = Array.from({ length: Math.min(2, pendientes.length) }, async () => {
      while (cursor < pendientes.length) {
        const actual = pendientes[cursor++];
        try {
          await generarFacturaDeCargo(actual.id_cargo, actual.metodo_pago || 'otro');
        } catch (error) {
          console.warn(`Finanzas: no se pudo facturar automáticamente el cargo ${actual.id_cargo}:`, error?.message || error);
        }
      }
    });

    await Promise.all(workers);
  })().finally(() => {
    facturacionPendientesEnCurso = null;
  });

  return facturacionPendientesEnCurso;
}

export async function listarFacturas() {
  await prepararDatosFinancieros();

  // Si el API compartido conserva una factura creada anteriormente pero el
  // vínculo local factura_cargo se perdió, se intenta recuperar por la
  // referencia estable `educontrol / cargo:<id>`. La conciliación es
  // no bloqueante: si el servicio externo está iniciando, la interfaz local
  // sigue mostrando los cargos pagados como pendientes de facturar.
  try {
    await reconciliarFacturasEduControl();
  } catch (error) {
    console.warn('Finanzas: no se pudo conciliar la facturación local:', error?.message || error);
  }

  // Los cargos históricos que ya estaban pagados antes de esta versión también
  // se facturan sin intervención manual. Esto mantiene el módulo y reportes
  // consistentes aunque el pago se haya registrado en una versión anterior.
  try {
    await facturarCargosPagadosPendientesAutomaticamente();
  } catch (error) {
    console.warn('Finanzas: no se pudo completar la facturación automática pendiente:', error?.message || error);
  }

  // Se consideran facturables tanto los cargos marcados como pagados como los
  // registros históricos cuyo saldo ya llegó a cero. Esto evita ocultar cargos
  // antiguos que quedaron con el estado desactualizado.
  const [rows] = await pool.query(
    `SELECT
       c.id_cargo,
       c.id_estudiante,
       c.id_concepto,
       c.descripcion,
       c.periodo,
       c.fecha_emision,
       c.total,
       c.saldo,
       COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) AS total_pagado,
       c.estado AS estado_cargo,
       cc.codigo AS concepto_codigo,
       cc.nombre AS concepto_nombre,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2)), ''), CONCAT('Estudiante #', c.id_estudiante)) AS estudiante_nombre,
       e.estado AS estudiante_activo,
       fc.id_factura_externa,
       fc.estado_factura,
       fc.error_mensaje,
       fc.fecha_solicitud,
       fc.fecha_actualizacion
     FROM cargo_estudiante c
     LEFT JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
     LEFT JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     LEFT JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo
     WHERE c.estado <> 'anulado'
       AND (
         c.total > 0
         OR COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) > 0
       )
       AND (
         c.estado = 'pagado'
         OR c.saldo <= 0
         OR fc.id_factura_externa IS NOT NULL
         OR fc.estado_factura IS NOT NULL
       )
     ORDER BY
       CASE WHEN fc.id_factura_externa IS NULL THEN 0 ELSE 1 END,
       COALESCE(fc.fecha_actualizacion, fc.fecha_solicitud, c.fecha_emision) DESC,
       c.id_cargo DESC`
  );

  return rows.map((row) => ({
    ...row,
    total: Number(row.total || row.total_pagado || 0),
    total_pagado: Number(row.total_pagado || 0),
    saldo: Number(row.saldo || 0),
    estudiante_activo: Boolean(row.estudiante_activo),
    listo_para_facturar:
      !row.id_factura_externa &&
      String(row.estado_cargo || '').toLowerCase() !== 'anulado' &&
      Number(row.total || row.total_pagado || 0) > 0 &&
      (
        String(row.estado_cargo || '').toLowerCase() === 'pagado' ||
        Number(row.saldo || 0) <= 0
      )
  }));
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
  await validarDescuentoVigente(fechaVencimiento, descuento);

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

  // Si el cargo se creó antes de la matrícula para permitir el abono mínimo,
  // reutilizarlo y vincularlo a la matrícula definitiva en lugar de duplicarlo.
  const [[preCargo]] = await pool.query(
    `SELECT id_cargo FROM cargo_estudiante
     WHERE id_estudiante = ? AND id_concepto = ? AND id_matricula IS NULL
       AND estado <> 'anulado' AND (periodo = ? OR periodo IS NULL OR periodo = '')
     ORDER BY id_cargo DESC LIMIT 1`,
    [id_estudiante, concepto.id_concepto, String(anio || new Date().getFullYear())]
  );
  if (preCargo) {
    await pool.query(`UPDATE cargo_estudiante SET id_matricula = ? WHERE id_cargo = ?`, [id_matricula, preCargo.id_cargo]);
    return { id_cargo: preCargo.id_cargo, reutilizado: true };
  }

  return crearCargo({
    id_estudiante,
    id_concepto: concepto.id_concepto,
    id_matricula,
    periodo: String(anio || new Date().getFullYear()),
    descripcion: `Matrícula ciclo lectivo ${anio || new Date().getFullYear()}`,
    fecha_emision: new Date().toISOString().slice(0, 10)
  }, id_usuario);
}

export async function obtenerEstadoFinancieroMatricula(idEstudiante, anio = null) {
  const id = positiveInt(idEstudiante, "El estudiante");
  const periodo = String(anio || new Date().getFullYear());
  const [deudas] = await pool.query(
    `SELECT c.id_cargo, c.descripcion, c.periodo, c.total, c.saldo, c.estado, cc.codigo, cc.nombre AS concepto_nombre,
            COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) AS pagado
     FROM cargo_estudiante c
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
     WHERE c.id_estudiante = ? AND c.estado IN ('pendiente','parcial')
     ORDER BY (cc.codigo = 'MATRICULA') DESC, c.fecha_emision ASC`, [id]
  );
  const [matRows] = await pool.query(
    `SELECT c.id_cargo, c.total, c.saldo, c.estado,
            COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) AS pagado
     FROM cargo_estudiante c
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
     WHERE c.id_estudiante = ? AND cc.codigo = 'MATRICULA'
       AND (c.periodo = ? OR c.periodo IS NULL OR c.periodo = '')
       AND c.estado <> 'anulado'
     ORDER BY c.id_cargo DESC LIMIT 1`, [id, periodo]
  );
  const cargoMatricula = matRows[0] || null;
  const abonado = Number(cargoMatricula?.pagado || 0);
  const minimo = 10000;
  const faltante = Math.max(0, minimo - abonado);
  const habilitado = !!cargoMatricula && (cargoMatricula.estado === 'pagado' || abonado >= minimo);
  return {
    id_estudiante: id,
    anio: Number(anio || new Date().getFullYear()),
    minimo_abono: minimo,
    faltante_minimo: faltante,
    habilitado,
    abono_matricula: abonado,
    cargo_matricula: cargoMatricula,
    deudas,
    titulo: habilitado ? 'Matrícula habilitada' : 'Pago inicial pendiente',
    mensaje: habilitado
      ? (deudas.length
          ? 'El abono mínimo ya está registrado. Puedes continuar; los saldos pendientes seguirán visibles en Pagos.'
          : 'El requisito de pago está al día y puedes continuar con la matrícula.')
      : (!cargoMatricula
          ? 'Aún no hay un cargo de matrícula disponible para este estudiante.'
          : `Para continuar faltan CRC ${faltante.toLocaleString('es-CR')} del abono mínimo.`)
  };
}

export async function actualizarCargo(idCargo, datos) {
  const id = positiveInt(idCargo, 'El cargo');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT c.*, cc.impuesto_tarifa FROM cargo_estudiante c INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto WHERE c.id_cargo = ? FOR UPDATE`, [id]
    );
    if (!rows.length) throw new Error('Cargo no encontrado.');
    const cargo = rows[0];
    if (cargo.estado === 'anulado') throw new Error('No se puede modificar un cargo anulado.');
    const [[pagosRow]] = await connection.query(`SELECT COALESCE(SUM(monto),0) AS pagado FROM pago WHERE id_cargo = ? AND estado = 'aplicado'`, [id]);
    const pagado = Number(pagosRow?.pagado || 0);
    const base = datos.monto_base === undefined ? Number(cargo.monto_base) : money(datos.monto_base, 'El monto base', true);
    const descuento = datos.descuento === undefined ? Number(cargo.descuento) : money(datos.descuento, 'El descuento', true);
    if (descuento > base) throw new Error('El descuento no puede ser mayor al monto base.');
    const fechaVencimientoResultante = datos.fecha_vencimiento === undefined
      ? (cargo.fecha_vencimiento ? String(cargo.fecha_vencimiento).slice(0, 10) : null)
      : (datos.fecha_vencimiento || null);
    await validarDescuentoVigente(fechaVencimientoResultante, descuento, connection);
    const subtotal = base - descuento;
    const impuesto = Math.round((subtotal * Number(cargo.impuesto_tarifa || 0) / 100) * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;
    if (total < pagado) throw new Error(`El total no puede ser menor a lo ya pagado (CRC ${pagado.toLocaleString('es-CR')}).`);
    const saldo = Math.max(0, Math.round((total - pagado) * 100) / 100);
    const estado = saldo <= 0 ? 'pagado' : (pagado > 0 ? 'parcial' : 'pendiente');
    await connection.query(
      `UPDATE cargo_estudiante SET descripcion = ?, periodo = ?, fecha_vencimiento = ?, monto_base = ?, descuento = ?, impuesto = ?, total = ?, saldo = ?, estado = ? WHERE id_cargo = ?`,
      [String(datos.descripcion ?? cargo.descripcion ?? '').trim().slice(0,200), String(datos.periodo ?? cargo.periodo ?? '').trim().slice(0,30) || null, fechaVencimientoResultante, base, descuento, impuesto, total, saldo, estado, id]
    );
    await connection.commit();
    return { id_cargo:id, total, saldo, estado, pagado };
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}

export async function actualizarPago(idPago, datos) {
  const id = positiveInt(idPago, 'El pago');
  const metodo = String(datos.metodo_pago || '').trim().toLowerCase();
  if (!['efectivo','tarjeta','transferencia','sinpe','otro'].includes(metodo)) throw new Error('Método de pago no válido.');
  const [rows] = await pool.query(
    `SELECT pg.id_pago, pg.id_cargo, fc.id_factura_externa FROM pago pg LEFT JOIN factura_cargo fc ON fc.id_cargo = pg.id_cargo WHERE pg.id_pago = ? AND pg.estado = 'aplicado' LIMIT 1`, [id]
  );
  if (!rows.length) throw new Error('Pago no encontrado.');
  if (rows[0].id_factura_externa) throw new Error('No se puede modificar un pago que ya generó una factura externa.');
  await pool.query(`UPDATE pago SET metodo_pago = ?, referencia = ? WHERE id_pago = ?`, [metodo, String(datos.referencia || '').trim().slice(0,100) || null, id]);
  return { id_pago:id, metodo_pago:metodo, referencia:String(datos.referencia || '').trim().slice(0,100) || null };
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
       cc.nombre AS concepto_nombre, cc.codigo AS concepto_codigo,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre,
       fc.id_factura_externa, fc.estado_factura
     FROM pago pg
     INNER JOIN cargo_estudiante c ON c.id_cargo = pg.id_cargo
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
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
  await normalizarDescuentosVencidos(pool, cargoId);
  const montoPago = money(datos.monto, "El monto del pago");
  const metodo = String(datos.metodo_pago || "").trim().toLowerCase();
  if (!["efectivo", "tarjeta", "transferencia", "sinpe", "otro"].includes(metodo)) {
    throw new Error("Método de pago no válido.");
  }

  const connection = await pool.getConnection();
  let pagoResultId = null;
  let saldoNuevo = null;
  let cargoPagado = false;

  try {
    await connection.beginTransaction();

    const [cargoRows] = await connection.query(
      `SELECT * FROM cargo_estudiante WHERE id_cargo = ? FOR UPDATE`,
      [cargoId]
    );
    if (!cargoRows.length) throw new Error("Cargo no encontrado.");
    const cargo = cargoRows[0];
    if (cargo.estado === "anulado") throw new Error("El cargo está anulado.");
    if (cargo.estado === "pagado" || Number(cargo.saldo) <= 0) {
      const error = new Error("El cargo ya está pagado.");
      error.statusCode = 409;
      error.code = "CARGO_YA_PAGADO";
      error.esperado = true;
      throw error;
    }
    if (montoPago > Number(cargo.saldo) + 0.001) {
      throw new Error(`El pago no puede superar el saldo pendiente de CRC ${Number(cargo.saldo).toLocaleString("es-CR")}.`);
    }

    if (datos.responsable) {
      await upsertResponsable(connection, cargo.id_estudiante, datos.responsable);
    }

    const [pagoResult] = await connection.query(
      `INSERT INTO pago
       (id_cargo, fecha_pago, monto, metodo_pago, referencia, estado, id_usuario)
       VALUES (?, NOW(), ?, ?, ?, 'aplicado', ?)`,
      [cargoId, montoPago, metodo, String(datos.referencia || "").trim().slice(0, 100) || null, idUsuario || null]
    );

    pagoResultId = pagoResult.insertId;
    saldoNuevo = Math.max(0, Math.round((Number(cargo.saldo) - montoPago) * 100) / 100);
    cargoPagado = saldoNuevo <= 0;

    await connection.query(
      `UPDATE cargo_estudiante SET saldo = ?, estado = ? WHERE id_cargo = ?`,
      [saldoNuevo, cargoPagado ? "pagado" : "parcial", cargoId]
    );

    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    connection.release();
  }

  let facturacion = {
    ok: false,
    estado: "pendiente_pago",
    mensaje: "Pago parcial aplicado. La factura se generará automáticamente al completar el cargo."
  };

  if (cargoPagado) {
    try {
      facturacion = await generarFacturaDeCargo(cargoId, metodo);
      if (!facturacion?.ok) {
        facturacion = {
          ...facturacion,
          mensaje: facturacion?.mensaje || "El pago quedó aplicado y el sistema seguirá intentando generar la factura automáticamente."
        };
      }
    } catch (error) {
      console.error(`Finanzas: pago ${pagoResultId} aplicado, pero la facturación automática falló:`, error);
      facturacion = {
        ok: false,
        estado: "error",
        mensaje: "El pago quedó aplicado. La factura se reintentará automáticamente desde el módulo de facturación."
      };
    }
  }

  return {
    id_pago: pagoResultId,
    id_cargo: cargoId,
    saldo: saldoNuevo,
    estado_cargo: cargoPagado ? "pagado" : "parcial",
    facturacion
  };
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


async function asegurarEsquemaClasesExtra() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS clase_extra (
      id_clase_extra BIGINT AUTO_INCREMENT PRIMARY KEY,
      id_estudiante INT NOT NULL,
      id_profesor INT NOT NULL,
      id_cargo BIGINT NULL,
      fecha DATE NOT NULL,
      hora_inicio TIME NULL,
      hora_fin TIME NULL,
      observaciones VARCHAR(250) NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'programada',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_clase_extra_profesor_fecha (id_profesor, fecha),
      INDEX idx_clase_extra_estudiante (id_estudiante),
      INDEX idx_clase_extra_cargo (id_cargo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function asegurarConceptoHorasExtra() {
  const [[existente]] = await pool.query(
    `SELECT id_concepto, monto_base, estado
     FROM concepto_cobro
     WHERE codigo = 'HORAS_EXTRA'
     LIMIT 1`
  );
  if (existente) {
    if (Number(existente.estado) === 0) {
      await pool.query(`UPDATE concepto_cobro SET estado = TRUE WHERE id_concepto = ?`, [existente.id_concepto]);
    }
    return existente;
  }

  const [result] = await pool.query(
    `INSERT INTO concepto_cobro
      (codigo, nombre, descripcion, tipo, monto_base, impuesto_tarifa, moneda, estado)
     VALUES ('HORAS_EXTRA', 'Horas extra de clase',
             'Clase adicional programada fuera del horario regular del profesor.',
             'servicio', 10000, 0, 'CRC', TRUE)`
  );
  return { id_concepto: result.insertId, monto_base: 10000 };
}

const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function normalizarTextoDia(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function profesorOcupaDiaPorNombreGrupo(nombreGrupo, fecha) {
  const texto = normalizarTextoDia(nombreGrupo);
  const dia = normalizarTextoDia(DIAS[new Date(`${fecha}T12:00:00`).getDay()]);

  if ((texto.includes('lunes-viernes') || texto.includes('lunes a viernes') || texto.includes('lunes - viernes')) &&
      ['lunes','martes','miercoles','jueves','viernes'].includes(dia)) {
    return true;
  }

  const variantes = {
    domingo: ['domingo'],
    lunes: ['lunes'],
    martes: ['martes'],
    miercoles: ['miercoles'],
    jueves: ['jueves'],
    viernes: ['viernes'],
    sabado: ['sabado']
  };
  return variantes[dia]?.some((d) => texto.includes(d)) || false;
}

export async function listarProfesoresParaClaseExtra() {
  const [rows] = await pool.query(
    `SELECT
       pr.id_profesor,
       pr.materia,
       pr.estado,
       p.nombre,
       p.apellido1,
       p.apellido2,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS profesor_nombre,
       COUNT(DISTINCT CASE
         WHEN gp.estado = TRUE AND gp.fecha_fin IS NULL THEN gp.id_grupo
         ELSE NULL
       END) AS grupos_activos
     FROM profesor pr
     INNER JOIN persona p ON p.id_persona = pr.id_persona
     LEFT JOIN grupo_profesor gp ON gp.id_profesor = pr.id_profesor
     WHERE pr.estado = TRUE
       AND p.estado = TRUE
     GROUP BY pr.id_profesor, pr.materia, pr.estado, p.nombre, p.apellido1, p.apellido2
     ORDER BY p.apellido1, p.apellido2, p.nombre`
  );
  return rows;
}

export async function listarEstudiantesProfesorExtra(idProfesor) {
  const profesorId = positiveInt(idProfesor, "El profesor");

  const [[profesor]] = await pool.query(
    `SELECT id_profesor, estado FROM profesor WHERE id_profesor = ? LIMIT 1`,
    [profesorId]
  );
  if (!profesor || !(profesor.estado == 1 || profesor.estado === true)) {
    throw new Error("El profesor no existe o está inactivo.");
  }

  const [rows] = await pool.query(
    `SELECT DISTINCT
       e.id_estudiante,
       e.id_persona,
       p.nombre,
       p.apellido1,
       p.apellido2,
       g.id_grupo,
       g.nombre_grupo,
       s.id_seccion,
       s.nombre_seccion,
       s.nivel
     FROM estudiante e
     INNER JOIN persona p ON p.id_persona = e.id_persona
     INNER JOIN grupo_estudiante ge
       ON ge.id_estudiante = e.id_estudiante
      AND ge.estado = TRUE
     INNER JOIN grupo g
       ON g.id_grupo = ge.id_grupo
      AND g.estado = TRUE
     LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
     LEFT JOIN grupo_profesor gp
       ON gp.id_grupo = g.id_grupo
      AND gp.id_profesor = ?
      AND gp.estado = TRUE
     LEFT JOIN profesor_suplencia ps
       ON ps.id_grupo = g.id_grupo
      AND ps.id_profesor_suplente = ?
      AND ps.estado = TRUE
     WHERE e.estado = TRUE
       AND (gp.id_grupo_profesor IS NOT NULL OR ps.id_suplencia IS NOT NULL)
     ORDER BY p.apellido1, p.apellido2, p.nombre, g.nombre_grupo`,
    [profesorId, profesorId]
  );

  return rows;
}

export async function obtenerDisponibilidadProfesorExtra(idProfesor, fecha) {
  await asegurarEsquemaClasesExtra();

  const profesorId = positiveInt(idProfesor, "El profesor");
  const fechaTexto = String(fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
    throw new Error("Selecciona una fecha válida para la clase extra.");
  }

  const [[profesor]] = await pool.query(
    `SELECT pr.id_profesor, pr.materia, pr.estado,
            CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS profesor_nombre
     FROM profesor pr
     INNER JOIN persona p ON p.id_persona = pr.id_persona
     WHERE pr.id_profesor = ? LIMIT 1`,
    [profesorId]
  );
  if (!profesor || !(profesor.estado == 1 || profesor.estado === true)) {
    throw new Error("El profesor no existe o está inactivo.");
  }

  const [grupos] = await pool.query(
    `SELECT g.id_grupo, g.nombre_grupo, s.nombre_seccion
     FROM grupo_profesor gp
     INNER JOIN grupo g ON g.id_grupo = gp.id_grupo AND g.estado = TRUE
     LEFT JOIN seccion s ON s.id_seccion = g.id_seccion
     WHERE gp.id_profesor = ?
       AND gp.estado = TRUE
       AND (gp.fecha_fin IS NULL OR gp.fecha_fin >= ?)`,
    [profesorId, fechaTexto]
  );

  const gruposQueOcupan = grupos.filter((g) => profesorOcupaDiaPorNombreGrupo(g.nombre_grupo, fechaTexto));

  const [extras] = await pool.query(
    `SELECT id_clase_extra, fecha, hora_inicio, hora_fin
     FROM clase_extra
     WHERE id_profesor = ? AND fecha = ? AND estado IN ('programada','realizada')`,
    [profesorId, fechaTexto]
  );

  const disponible = gruposQueOcupan.length === 0 && extras.length === 0;
  return {
    disponible,
    fecha: fechaTexto,
    profesor,
    motivo: disponible
      ? "El profesor está disponible ese día."
      : (gruposQueOcupan.length
          ? `El profesor tiene asignación regular ese día (${gruposQueOcupan.map(g => g.nombre_grupo).join(', ')}).`
          : "El profesor ya tiene una clase extra programada ese día."),
    grupos_ocupados: gruposQueOcupan,
    clases_extra: extras
  };
}

export async function registrarClaseExtra(datos, idUsuario) {
  await asegurarEsquemaClasesExtra();
  const concepto = await asegurarConceptoHorasExtra();

  const idEstudiante = positiveInt(datos.id_estudiante, "El estudiante");
  const idProfesor = positiveInt(datos.id_profesor, "El profesor");
  const fecha = String(datos.fecha || '').trim();

  const estudiantesProfesor = await listarEstudiantesProfesorExtra(idProfesor);
  if (!estudiantesProfesor.some((row) => Number(row.id_estudiante) === idEstudiante)) {
    throw new Error("El estudiante seleccionado no pertenece a un grupo asignado a este profesor.");
  }

  const disponibilidad = await obtenerDisponibilidadProfesorExtra(idProfesor, fecha);
  if (!disponibilidad.disponible) {
    throw new Error(disponibilidad.motivo);
  }

  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const fechaClase = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(fechaClase.getTime()) || fechaClase < hoy) {
    throw new Error("La clase extra debe programarse para hoy o una fecha futura.");
  }

  const horaInicio = String(datos.hora_inicio || '').trim() || null;
  const horaFin = String(datos.hora_fin || '').trim() || null;
  if ((horaInicio && !horaFin) || (!horaInicio && horaFin)) {
    throw new Error("Indica tanto la hora de inicio como la hora de finalización.");
  }
  if (horaInicio && horaFin && horaFin <= horaInicio) {
    throw new Error("La hora de finalización debe ser posterior a la hora de inicio.");
  }

  const [[estudiante]] = await pool.query(
    `SELECT e.id_estudiante, CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre
     FROM estudiante e
     INNER JOIN persona p ON p.id_persona = e.id_persona
     WHERE e.id_estudiante = ? AND e.estado = TRUE LIMIT 1`,
    [idEstudiante]
  );
  if (!estudiante) throw new Error("El estudiante no existe o está inactivo.");

  const montoBase = datos.monto_base === undefined || datos.monto_base === ''
    ? Number(concepto.monto_base || 10000)
    : money(datos.monto_base, "El monto de la clase extra");

  const cargo = await crearCargo({
    id_estudiante: idEstudiante,
    id_concepto: concepto.id_concepto,
    monto_base: montoBase,
    descuento: 0,
    periodo: fecha,
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: fecha,
    descripcion: `Clase extra de ${disponibilidad.profesor.materia} · ${fecha}`
  }, idUsuario);

  try {
    const [result] = await pool.query(
      `INSERT INTO clase_extra
        (id_estudiante, id_profesor, id_cargo, fecha, hora_inicio, hora_fin, observaciones, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'programada')`,
      [
        idEstudiante,
        idProfesor,
        cargo.id_cargo,
        fecha,
        horaInicio,
        horaFin,
        String(datos.observaciones || '').trim().slice(0,250) || null
      ]
    );

    return {
      id_clase_extra: result.insertId,
      id_cargo: cargo.id_cargo,
      total: cargo.total,
      profesor: disponibilidad.profesor.profesor_nombre,
      materia: disponibilidad.profesor.materia,
      estudiante: estudiante.estudiante_nombre,
      fecha
    };
  } catch (error) {
    await pool.query(`UPDATE cargo_estudiante SET estado = 'anulado', saldo = 0 WHERE id_cargo = ?`, [cargo.id_cargo]);
    throw error;
  }
}

export async function listarClasesExtra() {
  await asegurarEsquemaClasesExtra();
  const [rows] = await pool.query(
    `SELECT ce.id_clase_extra, ce.fecha, ce.hora_inicio, ce.hora_fin, ce.observaciones, ce.estado,
            ce.id_cargo, ce.id_estudiante, ce.id_profesor,
            CONCAT_WS(' ', pe.nombre, pe.apellido1, pe.apellido2) AS estudiante_nombre,
            CONCAT_WS(' ', pp.nombre, pp.apellido1, pp.apellido2) AS profesor_nombre,
            pr.materia,
            c.total, c.saldo, c.estado AS estado_cargo
     FROM clase_extra ce
     INNER JOIN estudiante e ON e.id_estudiante = ce.id_estudiante
     INNER JOIN persona pe ON pe.id_persona = e.id_persona
     INNER JOIN profesor pr ON pr.id_profesor = ce.id_profesor
     INNER JOIN persona pp ON pp.id_persona = pr.id_persona
     LEFT JOIN cargo_estudiante c ON c.id_cargo = ce.id_cargo
     ORDER BY ce.fecha DESC, ce.id_clase_extra DESC
     LIMIT 300`
  );
  return rows;
}

export async function reintentarFactura(idCargo, metodoPago = 'otro') {
  return generarFacturaDeCargo(positiveInt(idCargo, "El cargo"), metodoPago);
}
