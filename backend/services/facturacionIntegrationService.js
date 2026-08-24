import pool from "../config/database.js";

const METODOS_FACTURA = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  sinpe: "SINPE",
  otro: "Otro"
};

function numero(valor) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(valor) {
  return `CRC ${numero(valor).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function textoSeguro(valor, max = 180) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

let esquemaLogoConfiguracionPromise = null;

async function asegurarLogoConfiguracion() {
  if (esquemaLogoConfiguracionPromise) return esquemaLogoConfiguracionPromise;
  esquemaLogoConfiguracionPromise = (async () => {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS existe, MAX(DATA_TYPE) AS data_type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'configuracion_facturacion'
         AND COLUMN_NAME = 'logo_data'`
    );

    if (!Number(row?.existe || 0)) {
      await pool.query(`ALTER TABLE configuracion_facturacion ADD COLUMN logo_data LONGTEXT NULL AFTER correo`);
    } else if (String(row?.data_type || "").toLowerCase() !== "longtext") {
      await pool.query(`ALTER TABLE configuracion_facturacion MODIFY COLUMN logo_data LONGTEXT NULL`);
    }
  })().catch((error) => {
    esquemaLogoConfiguracionPromise = null;
    throw error;
  });
  return esquemaLogoConfiguracionPromise;
}

function normalizarLogoData(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const data = String(valor).trim();
  if (data.length > 800000) {
    throw new Error("El logo es demasiado grande. Usa una imagen PNG, JPG o WEBP menor a 500 KB.");
  }
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(data)) {
    throw new Error("El logo debe ser una imagen PNG, JPG o WEBP válida.");
  }
  return data;
}

export async function obtenerConfiguracionFacturacion() {
  await asegurarLogoConfiguracion();
  const [rows] = await pool.query(`SELECT * FROM configuracion_facturacion WHERE id_configuracion = 1 LIMIT 1`);
  return rows[0] || null;
}

export async function actualizarConfiguracionFacturacion(datos) {
  await asegurarLogoConfiguracion();
  const nombre = textoSeguro(datos.institucion_nombre, 100);
  const tipo = textoSeguro(datos.tipo_identificacion, 4);
  const numeroId = textoSeguro(datos.numero_identificacion, 30);
  const correo = textoSeguro(datos.correo, 150).toLowerCase();

  if (!nombre || !tipo || !numeroId || !correo) {
    throw new Error("Completa nombre, identificación y correo de facturación.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("El correo de facturación no tiene un formato válido.");
  }

  const actual = await obtenerConfiguracionFacturacion();
  const logoData = Object.prototype.hasOwnProperty.call(datos || {}, "logo_data")
    ? normalizarLogoData(datos.logo_data)
    : (actual?.logo_data || null);

  await pool.query(
    `INSERT INTO configuracion_facturacion
      (id_configuracion, institucion_nombre, tipo_identificacion, numero_identificacion, correo, logo_data, moneda, condicion_venta, estado)
     VALUES (1, ?, ?, ?, ?, ?, 'CRC', '01', TRUE)
     ON DUPLICATE KEY UPDATE
       institucion_nombre = VALUES(institucion_nombre),
       tipo_identificacion = VALUES(tipo_identificacion),
       numero_identificacion = VALUES(numero_identificacion),
       correo = VALUES(correo),
       logo_data = VALUES(logo_data),
       estado = TRUE`,
    [nombre, tipo, numeroId, correo, logoData]
  );

  return obtenerConfiguracionFacturacion();
}

async function obtenerDatosFacturaLocal(idCargo) {
  const [rows] = await pool.query(
    `SELECT
       c.id_cargo, c.descripcion, c.monto_base, c.descuento, c.impuesto, c.total, c.saldo, c.estado,
       c.fecha_emision, c.fecha_vencimiento, c.periodo,
       cc.nombre AS concepto_nombre, cc.codigo AS concepto_codigo, cc.impuesto_tarifa,
       e.id_estudiante,
       CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre,
       rp.nombre AS responsable_nombre,
       rp.tipo_identificacion AS responsable_tipo_id,
       rp.numero_identificacion AS responsable_numero_id,
       rp.correo AS responsable_correo,
       rp.telefono AS responsable_telefono,
       pg.fecha_pago, pg.metodo_pago, pg.referencia, pg.monto AS monto_pagado,
       fc.id_factura_externa, fc.estado_factura
     FROM cargo_estudiante c
     INNER JOIN concepto_cobro cc ON cc.id_concepto = c.id_concepto
     INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     INNER JOIN persona p ON p.id_persona = e.id_persona
     LEFT JOIN responsable_pago rp ON rp.id_estudiante = e.id_estudiante AND rp.principal = TRUE AND rp.estado = TRUE
     LEFT JOIN (
       SELECT p1.* FROM pago p1
       INNER JOIN (
         SELECT id_cargo, MAX(id_pago) AS id_pago FROM pago WHERE estado = 'aplicado' GROUP BY id_cargo
       ) ult ON ult.id_pago = p1.id_pago
     ) pg ON pg.id_cargo = c.id_cargo
     LEFT JOIN factura_cargo fc ON fc.id_cargo = c.id_cargo
     WHERE c.id_cargo = ?
     LIMIT 1`,
    [idCargo]
  );
  if (!rows.length) throw new Error("No se encontró el cargo a facturar.");

  const configGuardada = await obtenerConfiguracionFacturacion().catch(() => null);
  const config = {
    institucion_nombre: configGuardada?.institucion_nombre || process.env.FACTURACION_EMISOR_NOMBRE || "EduControl",
    tipo_identificacion: configGuardada?.tipo_identificacion || process.env.FACTURACION_EMISOR_TIPO_ID || "02",
    numero_identificacion: configGuardada?.numero_identificacion || process.env.FACTURACION_EMISOR_NUMERO_ID || "3101000000",
    correo: configGuardada?.correo || process.env.FACTURACION_EMISOR_CORREO || "facturacion@educontrol.com"
  };

  return { ...rows[0], config };
}

async function registrarEstadoFactura(idCargo, idFactura, estado, respuesta, errorMensaje) {
  await pool.query(
    `INSERT INTO factura_cargo
      (id_cargo, id_factura_externa, estado_factura, datos_respuesta, error_mensaje, fecha_solicitud, fecha_actualizacion)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       id_factura_externa = COALESCE(VALUES(id_factura_externa), id_factura_externa),
       estado_factura = VALUES(estado_factura),
       datos_respuesta = VALUES(datos_respuesta),
       error_mensaje = VALUES(error_mensaje),
       fecha_actualizacion = NOW()`,
    [idCargo, idFactura, estado, respuesta ? JSON.stringify(respuesta) : null, errorMensaje || null]
  );
}

export async function generarFacturaDeCargo(idCargo, metodoPago = "otro") {
  const cargoId = Number(idCargo);
  if (!Number.isInteger(cargoId) || cargoId <= 0) throw new Error("Cargo no válido.");
  const datos = await obtenerDatosFacturaLocal(cargoId);

  const pagado = String(datos.estado || "").toLowerCase() === "pagado" || numero(datos.saldo) <= 0;
  if (!pagado) {
    return { ok: false, estado: "pendiente_pago", mensaje: "La factura se genera cuando el cargo queda completamente pagado." };
  }

  if (datos.id_factura_externa) {
    return { ok: true, estado: datos.estado_factura || "generada", id_factura: datos.id_factura_externa, mensaje: "El cargo ya fue facturado." };
  }

  const idFactura = `EC-${String(cargoId).padStart(6, "0")}`;
  const respuesta = {
    id: idFactura,
    origen: "educontrol",
    referenciaExterna: `cargo:${cargoId}`,
    fecha: datos.fecha_pago || new Date().toISOString(),
    moneda: "CRC",
    medioPago: METODOS_FACTURA[String(metodoPago || datos.metodo_pago || "otro").toLowerCase()] || "Otro",
    emisor: {
      nombre: datos.config.institucion_nombre,
      identificacion: datos.config.numero_identificacion,
      correo: datos.config.correo
    },
    receptor: {
      nombre: datos.responsable_nombre || datos.estudiante_nombre,
      identificacion: datos.responsable_numero_id || null,
      correo: datos.responsable_correo || null
    },
    concepto: datos.concepto_nombre || datos.descripcion,
    descripcion: datos.descripcion,
    subtotal: Math.max(0, numero(datos.monto_base) - numero(datos.descuento)),
    descuento: numero(datos.descuento),
    impuesto: numero(datos.impuesto),
    total: numero(datos.total)
  };

  await registrarEstadoFactura(cargoId, idFactura, "generada", respuesta, null);
  return { ok: true, estado: "generada", id_factura: idFactura, factura: respuesta, servicio: "EduControl" };
}

export async function confirmarFacturaGeneradaDesdeCliente(idCargo, respuesta) {
  const id = textoSeguro(respuesta?.id || respuesta?.id_factura, 80);
  if (!id) throw new Error("La factura no devolvió un identificador válido.");
  await registrarEstadoFactura(Number(idCargo), id, "generada", respuesta || { id }, null);
  return { ok: true, estado: "generada", id_factura: id, factura: respuesta || { id } };
}

export async function obtenerEstadoServiciosFacturacion() {
  return {
    facturacion: {
      configurado: true,
      disponible: true,
      estado: "local",
      detalle: "La facturación se procesa directamente en EduControl.",
      url: "/api/finanzas"
    },
    documentos: {
      configurado: true,
      disponible: true,
      estado: "local",
      detalle: "Los comprobantes PDF se generan directamente en EduControl.",
      url: "/api/finanzas"
    }
  };
}

export async function reconciliarFacturasEduControl() {
  return { conciliadas: 0, modo: "local" };
}

function latin1(valor) {
  return Buffer.from(String(valor ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u20AC]/g, "EUR"), "latin1");
}

function pdfEscapeBuffer(valor) {
  const buf = latin1(valor);
  const out = [];
  for (const byte of buf) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out.push(0x5c);
    out.push(byte);
  }
  return Buffer.from(out);
}

function crearPdfSimple(lineas) {
  const contentParts = [Buffer.from("BT\n/F1 10 Tf\n")];
  let y = 790;
  for (const linea of lineas) {
    const bold = Boolean(linea.bold);
    const size = Number(linea.size || 10);
    const x = Number(linea.x || 48);
    contentParts.push(Buffer.from(`/${bold ? "F2" : "F1"} ${size} Tf\n1 0 0 1 ${x} ${y} Tm\n(`));
    contentParts.push(pdfEscapeBuffer(linea.text));
    contentParts.push(Buffer.from(") Tj\n"));
    y -= Number(linea.gap || (size + 7));
  }
  contentParts.push(Buffer.from("ET\n"));
  const content = Buffer.concat(contentParts);

  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>", "latin1"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("endstream", "latin1")])
  ];

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((obj, index) => {
    offsets[index + 1] = offset;
    const head = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    chunks.push(head, obj, tail);
    offset += head.length + obj.length + tail.length;
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

export async function obtenerDocumentoDeCargo(idCargo, formato = "pdf") {
  if (String(formato || "pdf").toLowerCase() !== "pdf") {
    throw new Error("EduControl genera el comprobante en formato PDF.");
  }

  const cargoId = Number(idCargo);
  if (!Number.isInteger(cargoId) || cargoId <= 0) throw new Error("Cargo no válido.");
  let datos = await obtenerDatosFacturaLocal(cargoId);

  if (!datos.id_factura_externa) {
    const generado = await generarFacturaDeCargo(cargoId, datos.metodo_pago || "otro");
    if (!generado.ok) throw new Error(generado.mensaje || "La factura todavía no está disponible.");
    datos = await obtenerDatosFacturaLocal(cargoId);
  }

  const facturaId = datos.id_factura_externa || `EC-${String(cargoId).padStart(6, "0")}`;
  const receptor = datos.responsable_nombre || datos.estudiante_nombre || "Cliente";
  const fecha = datos.fecha_pago ? new Date(datos.fecha_pago).toLocaleString("es-CR") : new Date().toLocaleString("es-CR");
  const subtotal = Math.max(0, numero(datos.monto_base) - numero(datos.descuento));

  const lineas = [
    { text: datos.config.institucion_nombre || "EduControl", bold: true, size: 18, gap: 24 },
    { text: "Comprobante de pago", bold: true, size: 13, gap: 20 },
    { text: `Factura: ${facturaId}`, bold: true },
    { text: `Fecha: ${fecha}` },
    { text: `Emisor: ${datos.config.institucion_nombre}` },
    { text: `Identificación: ${datos.config.numero_identificacion}` },
    { text: `Correo: ${datos.config.correo}`, gap: 22 },
    { text: "Cliente", bold: true, size: 12 },
    { text: `Nombre: ${receptor}` },
    { text: `Identificación: ${datos.responsable_numero_id || "No registrada"}` },
    { text: `Correo: ${datos.responsable_correo || "No registrado"}`, gap: 22 },
    { text: "Detalle", bold: true, size: 12 },
    { text: `Concepto: ${datos.concepto_nombre || "Cargo escolar"}` },
    { text: `Descripción: ${textoSeguro(datos.descripcion, 95)}` },
    { text: `Subtotal: ${money(subtotal)}` },
    { text: `Descuento: ${money(datos.descuento)}` },
    { text: `Impuesto: ${money(datos.impuesto)}` },
    { text: `Total: ${money(datos.total)}`, bold: true, size: 14, gap: 23 },
    { text: `Método de pago: ${METODOS_FACTURA[String(datos.metodo_pago || "otro").toLowerCase()] || "Otro"}` },
    { text: `Referencia: ${datos.referencia || "Sin referencia"}` },
    { text: "Documento generado por EduControl.", size: 9, gap: 12 }
  ];

  const buffer = crearPdfSimple(lineas);
  return {
    buffer,
    contentType: "application/pdf",
    filename: `factura-${facturaId}.pdf`,
    idFactura: facturaId
  };
}
