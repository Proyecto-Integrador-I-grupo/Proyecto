import pool from "../config/database.js";
import { consumirServicio } from "./integracionService.js";

const DEFAULT_FACTURACION_API_URL = "https://proyecto-kn7p.onrender.com";

const METODOS_FACTURA = {
  efectivo: "01",
  tarjeta: "02",
  transferencia: "04",
  sinpe: "04",
  otro: "99"
};

function numero(valor) {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizarRaizServicio(valor, sufijos = []) {
  let base = String(valor || "").trim().replace(/\/+$/, "");
  for (const sufijo of sufijos) {
    if (base.toLowerCase().endsWith(sufijo.toLowerCase())) {
      base = base.slice(0, -sufijo.length).replace(/\/+$/, "");
      break;
    }
  }
  return base;
}

function esUrlHttpValida(valor) {
  try {
    const url = new URL(String(valor || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolverRaizServicio(valorEntorno, fallback, sufijos = []) {
  const candidato = normalizarRaizServicio(valorEntorno, sufijos);
  if (candidato && esUrlHttpValida(candidato)) {
    return { url: candidato, usaFallback: false, configuracionInvalida: false };
  }

  const raizFallback = normalizarRaizServicio(fallback, sufijos);
  return {
    url: raizFallback,
    usaFallback: true,
    configuracionInvalida: Boolean(String(valorEntorno || "").trim())
  };
}

function obtenerConfiguracionRaizFacturacion() {
  return resolverRaizServicio(
    process.env.FACTURACION_API_URL,
    DEFAULT_FACTURACION_API_URL,
    ["/api/facturas"]
  );
}

function obtenerConfiguracionRaizDocumentos() {
  const valor = process.env.DOCUMENTOS_API_URL || process.env.FACTURACION_API_URL;
  return resolverRaizServicio(
    valor,
    DEFAULT_FACTURACION_API_URL,
    ["/api/documentos", "/api/facturas"]
  );
}

function obtenerRaizFacturacion() {
  return obtenerConfiguracionRaizFacturacion().url;
}

function obtenerRaizDocumentos() {
  return obtenerConfiguracionRaizDocumentos().url;
}

let esquemaLogoConfiguracionPromise = null;

async function asegurarLogoConfiguracion() {
  if (esquemaLogoConfiguracionPromise) return esquemaLogoConfiguracionPromise;

  esquemaLogoConfiguracionPromise = (async () => {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS existe
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'configuracion_facturacion'
         AND COLUMN_NAME = 'logo_data'`
    );

    if (!Number(row?.existe || 0)) {
      await pool.query(
        `ALTER TABLE configuracion_facturacion
         ADD COLUMN logo_data LONGTEXT NULL AFTER correo`
      );
    }
  })().catch((error) => {
    esquemaLogoConfiguracionPromise = null;
    throw error;
  });

  return esquemaLogoConfiguracionPromise;
}

function normalizarLogoData(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const data = String(valor).trim();

  if (data.length > 800000) {
    throw new Error("El logo es demasiado grande. Usa una imagen PNG o JPG menor a 500 KB.");
  }

  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/i.test(data)) {
    throw new Error("El logo debe ser una imagen PNG o JPG válida.");
  }

  return data;
}

export async function obtenerConfiguracionFacturacion() {
  await asegurarLogoConfiguracion();
  const [rows] = await pool.query(
    `SELECT * FROM configuracion_facturacion WHERE id_configuracion = 1 LIMIT 1`
  );
  return rows[0] || null;
}

export async function actualizarConfiguracionFacturacion(datos) {
  await asegurarLogoConfiguracion();

  const nombre = String(datos.institucion_nombre || "").trim();
  const tipo = String(datos.tipo_identificacion || "").trim();
  const numeroId = String(datos.numero_identificacion || "").trim();
  const correo = String(datos.correo || "").trim().toLowerCase();

  if (!nombre || !tipo || !numeroId || !correo) {
    throw new Error("Completa nombre, identificación y correo de facturación.");
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

export async function generarFacturaDeCargo(idCargo, metodoPago = "otro") {
  const apiRoot = obtenerRaizFacturacion();
  const apiUrl = `${apiRoot}/api/facturas`;

  const [cargoRows] = await pool.query(
    `SELECT
       c.id_cargo, c.descripcion, c.monto_base, c.descuento, c.impuesto, c.total, c.saldo, c.estado,
       ce.impuesto_tarifa,
       e.id_estudiante,
       p.nombre, p.apellido1, p.apellido2,
       rp.nombre AS responsable_nombre,
       rp.tipo_identificacion AS responsable_tipo_id,
       rp.numero_identificacion AS responsable_numero_id,
       rp.correo AS responsable_correo
     FROM cargo_estudiante c
     INNER JOIN estudiante e ON e.id_estudiante = c.id_estudiante
     INNER JOIN persona p ON p.id_persona = e.id_persona
     INNER JOIN concepto_cobro ce ON ce.id_concepto = c.id_concepto
     LEFT JOIN responsable_pago rp
       ON rp.id_estudiante = e.id_estudiante
      AND rp.principal = TRUE
      AND rp.estado = TRUE
     WHERE c.id_cargo = ?
     LIMIT 1`,
    [idCargo]
  );

  if (!cargoRows.length) throw new Error("No se encontró el cargo a facturar.");
  const cargo = cargoRows[0];

  const cargoPagado = cargo.estado === "pagado" || Number(cargo.saldo || 0) <= 0;

  if (!cargoPagado) {
    return {
      ok: false,
      estado: "pendiente_pago",
      mensaje: "La factura se genera cuando el cargo queda completamente pagado."
    };
  }

  if (cargo.estado !== "pagado") {
    await pool.query(
      `UPDATE cargo_estudiante SET estado = 'pagado', saldo = 0 WHERE id_cargo = ?`,
      [idCargo]
    );
    cargo.estado = "pagado";
    cargo.saldo = 0;
  }

  const [existente] = await pool.query(
    `SELECT * FROM factura_cargo WHERE id_cargo = ? LIMIT 1`,
    [idCargo]
  );

  if (existente.length && existente[0].id_factura_externa) {
    return {
      ok: true,
      estado: existente[0].estado_factura,
      id_factura: existente[0].id_factura_externa,
      mensaje: "El cargo ya fue facturado."
    };
  }

  let configGuardada = null;
  try {
    configGuardada = await obtenerConfiguracionFacturacion();
  } catch (error) {
    console.warn("Facturación: no se pudo leer configuracion_facturacion; se usarán valores de respaldo.", error?.message);
  }

  const config = {
    institucion_nombre:
      configGuardada?.institucion_nombre ||
      process.env.FACTURACION_EMISOR_NOMBRE ||
      "EduControl",
    tipo_identificacion:
      configGuardada?.tipo_identificacion ||
      process.env.FACTURACION_EMISOR_TIPO_ID ||
      "02",
    numero_identificacion:
      configGuardada?.numero_identificacion ||
      process.env.FACTURACION_EMISOR_NUMERO_ID ||
      "3101000000",
    correo:
      configGuardada?.correo ||
      process.env.FACTURACION_EMISOR_CORREO ||
      "facturacion@educontrol.com",
    logo_data: configGuardada?.logo_data || null,
    moneda: configGuardada?.moneda || "CRC",
    condicion_venta: configGuardada?.condicion_venta || "01"
  };

  // Los pagos históricos creados antes del módulo de responsables pueden no tener
  // responsable_pago. Para no bloquear la factura, el estudiante se utiliza como
  // receptor y el correo institucional queda como canal de entrega temporal.
  const receptorNombre = String(
    cargo.responsable_nombre ||
    [cargo.nombre, cargo.apellido1, cargo.apellido2].filter(Boolean).join(" ")
  ).trim();
  const receptorCorreo = String(
    cargo.responsable_correo ||
    process.env.FACTURACION_RECEPTOR_CORREO_FALLBACK ||
    config.correo
  ).trim().toLowerCase();

  if (!receptorNombre || !receptorCorreo) {
    await registrarEstadoFactura(
      idCargo,
      null,
      "pendiente_datos",
      null,
      "No fue posible determinar el receptor de la factura."
    );
    return {
      ok: false,
      estado: "pendiente_datos",
      mensaje: "No fue posible determinar el receptor de la factura."
    };
  }

  const base = numero(cargo.monto_base);
  const descuento = numero(cargo.descuento);
  const impuesto = numero(cargo.impuesto);
  const total = numero(cargo.total);
  const tarifa = numero(cargo.impuesto_tarifa);

  const payload = {
    fecha: new Date().toISOString(),
    moneda: config.moneda || "CRC",
    condicionVenta: config.condicion_venta || "01",
    medioPago: METODOS_FACTURA[String(metodoPago || "otro").toLowerCase()] || "99",
    emisor: {
      nombre: config.institucion_nombre,
      identificacion: {
        tipo: config.tipo_identificacion,
        numero: config.numero_identificacion
      },
      correo: config.correo,
      logoUrl: config.logo_data || undefined
    },
    receptor: {
      nombre: receptorNombre,
      identificacion: cargo.responsable_numero_id
        ? {
            tipo: cargo.responsable_tipo_id || "01",
            numero: cargo.responsable_numero_id
          }
        : null,
      correo: receptorCorreo
    },
    items: [
      {
        numeroLinea: 1,
        detalle: cargo.descripcion,
        cantidad: 1,
        precioUnitario: base,
        descuento,
        impuesto: { tarifa },
        subtotal: Math.max(0, base - descuento),
        montoTotalLinea: total
      }
    ],
    totales: {
      totalGravado: tarifa > 0 ? Math.max(0, base - descuento) : 0,
      totalExento: tarifa > 0 ? 0 : Math.max(0, base - descuento),
      totalDescuentos: descuento,
      totalImpuesto: impuesto,
      totalComprobante: total
    }
  };

  try {
    const respuesta = await consumirServicio(apiUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: Number(process.env.FACTURACION_TIMEOUT_MS || 90000),
      retry429: 0
    });

    if (!respuesta?.id) {
      throw new Error("Factura Bonita respondió, pero no devolvió el identificador de la factura.");
    }

    await registrarEstadoFactura(
      idCargo,
      respuesta.id,
      "generada",
      respuesta,
      null
    );

    return {
      ok: true,
      estado: "generada",
      id_factura: respuesta.id,
      factura: respuesta,
      servicio: apiRoot
    };
  } catch (error) {
    const mensaje = error?.message || "No se pudo generar la factura.";
    console.error(`[Factura Bonita] cargo ${idCargo}:`, mensaje);

    const esLimiteTemporal =
      /429|too many requests|límite temporal|limite temporal/i.test(mensaje);

    if (esLimiteTemporal) {
      return {
        ok: false,
        estado: "cliente_requerido",
        mensaje: "La comunicación servidor a servidor está limitada temporalmente. EduControl intentará completar la factura desde el navegador.",
        servicio: apiRoot,
        payload
      };
    }

    await registrarEstadoFactura(idCargo, null, "error", null, mensaje);
    return {
      ok: false,
      estado: "error",
      mensaje,
      servicio: apiRoot
    };
  }
}

export async function confirmarFacturaGeneradaDesdeCliente(idCargo, respuesta) {
  const id = String(respuesta?.id || respuesta?.id_factura || "").trim();
  if (!id) {
    throw new Error("Factura Bonita no devolvió un identificador válido.");
  }

  const cargoId = Number(idCargo);
  if (!Number.isInteger(cargoId) || cargoId <= 0) {
    throw new Error("Cargo no válido.");
  }

  const [rows] = await pool.query(
    `SELECT id_cargo, estado FROM cargo_estudiante WHERE id_cargo = ? LIMIT 1`,
    [cargoId]
  );

  if (!rows.length) {
    throw new Error("No se encontró el cargo.");
  }

  if (String(rows[0].estado || "").toLowerCase() !== "pagado") {
    throw new Error("Solo se puede confirmar una factura de un cargo pagado.");
  }

  await registrarEstadoFactura(
    cargoId,
    id,
    "generada",
    respuesta || { id },
    null
  );

  return {
    ok: true,
    estado: "generada",
    id_factura: id,
    factura: respuesta || { id }
  };
}

async function solicitarEstado(baseUrl, ruta, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${ruta}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "EduControl-Integration/1.0"
      },
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function probarServicioHttp(baseUrl) {
  if (!baseUrl) {
    return {
      configurado: false,
      disponible: false,
      estado: "no_configurado",
      detalle: "No hay URL configurada."
    };
  }

  const timeoutConfigurado = Number(process.env.FACTURACION_HEALTH_TIMEOUT_MS || 65000);
  const timeoutMs = Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5000
    ? timeoutConfigurado
    : 65000;

  const ruta = "/health";

  try {
    const { response, data } = await solicitarEstado(baseUrl, ruta, timeoutMs);

    if (response.ok || response.status === 429) {
      const detalle = response.status === 429
        ? "Factura Bonita está disponible, pero aplicó límite temporal de solicitudes."
        : (typeof data === "object" && data !== null
          ? (data.status || data.mensaje || data.id || "Respuesta correcta")
          : "Respuesta correcta");

      return {
        configurado: true,
        disponible: true,
        estado: response.status === 429 ? "limitado" : "disponible",
        http_status: response.status,
        detalle,
        ruta_probada: ruta
      };
    }

    return {
      configurado: true,
      disponible: false,
      estado: "error",
      http_status: response.status,
      detalle: `El servicio respondió HTTP ${response.status} en ${ruta}.`,
      ruta_probada: ruta
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        configurado: true,
        disponible: false,
        estado: "timeout",
        detalle: "Factura Bonita tardó demasiado en responder. Puede estar iniciando en Render."
      };
    }

    return {
      configurado: true,
      disponible: false,
      estado: "error",
      detalle: error?.message || "No fue posible conectar con el servicio."
    };
  }
}

export async function obtenerEstadoServiciosFacturacion() {
  const facturacionConfig = obtenerConfiguracionRaizFacturacion();
  const documentosConfig = obtenerConfiguracionRaizDocumentos();
  const facturacionRoot = facturacionConfig.url;
  const documentosRoot = documentosConfig.url;

  const [facturacion, documentos] = await Promise.all([
    probarServicioHttp(facturacionRoot),
    documentosRoot === facturacionRoot
      ? Promise.resolve(null)
      : probarServicioHttp(documentosRoot)
  ]);

  const estadoDocumentos = documentos || {
    ...facturacion,
    detalle: facturacion.disponible
      ? "HTML y PDF disponibles en el mismo servicio de Factura Bonita."
      : facturacion.detalle
  };

  const servicioSimple = (nombre) => {
    const valor = String(process.env[nombre] || "").trim();
    return {
      configurado: Boolean(valor),
      disponible: null,
      estado: valor ? "configurado" : "pendiente"
    };
  };

  return {
    facturacion: {
      ...facturacion,
      url: facturacionRoot,
      usa_url_predeterminada: facturacionConfig.usaFallback,
      configuracion_invalida: facturacionConfig.configuracionInvalida
    },
    documentos: {
      ...estadoDocumentos,
      url: documentosRoot,
      usa_facturacion_principal: !String(process.env.DOCUMENTOS_API_URL || "").trim(),
      configuracion_invalida: documentosConfig.configuracionInvalida
    },
    xml: servicioSimple("XML_API_URL"),
    firma: servicioSimple("FIRMA_API_URL"),
    tributacion: servicioSimple("TRIBUTACION_API_URL")
  };
}

export async function obtenerDocumentoDeCargo(idCargo, formato = "pdf") {
  const formatoNormalizado = "pdf";
  if (String(formato || "pdf").trim().toLowerCase() !== "pdf") {
    throw new Error("Por el momento Factura Bonita entrega únicamente el comprobante PDF.");
  }

  const [rows] = await pool.query(
    `SELECT fc.id_factura_externa, fc.estado_factura, c.estado AS estado_cargo
     FROM factura_cargo fc
     INNER JOIN cargo_estudiante c ON c.id_cargo = fc.id_cargo
     WHERE fc.id_cargo = ?
     LIMIT 1`,
    [idCargo]
  );

  if (!rows.length || !rows[0].id_factura_externa) {
    throw new Error("Primero genera la factura de este cargo.");
  }

  const idFactura = String(rows[0].id_factura_externa);
  const root = obtenerRaizDocumentos();

  if (!root) {
    throw new Error("El servicio de documentos no está configurado.");
  }

  const url = `${root}/api/documentos/facturas/${encodeURIComponent(idFactura)}?formato=${formatoNormalizado}`;
  const controller = new AbortController();
  const timeoutConfigurado = Number(process.env.DOCUMENTOS_TIMEOUT_MS || 90000);
  const timeoutMs = Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5000
    ? timeoutConfigurado
    : 90000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: formatoNormalizado === "pdf" ? "application/pdf" : "text/html"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const texto = await response.text().catch(() => "");
      let mensaje = "No se pudo generar el documento de la factura.";
      if (texto) {
        try {
          const json = JSON.parse(texto);
          mensaje = json?.detalle || json?.error || json?.mensaje || mensaje;
        } catch {
          mensaje = texto.slice(0, 220) || mensaje;
        }
      }
      throw new Error(mensaje);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      buffer,
      contentType: response.headers.get("content-type") || (
        formatoNormalizado === "pdf"
          ? "application/pdf"
          : "text/html; charset=utf-8"
      ),
      filename: `factura-${idFactura}.${formatoNormalizado}`,
      idFactura
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La generación del documento tardó demasiado. Inténtalo nuevamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
    [
      idCargo,
      idFactura,
      estado,
      respuesta ? JSON.stringify(respuesta) : null,
      errorMensaje || null
    ]
  );
}
