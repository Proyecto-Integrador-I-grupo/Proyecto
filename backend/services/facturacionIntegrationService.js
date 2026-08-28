import pool from "../config/database.js";
import { createHash } from "node:crypto";
import { consumirServicio } from "./integracionService.js";
import { cifrarSecreto, descifrarSecreto } from "../utils/secretBox.js";

const DEFAULT_FACTURACION_API_URL = "https://proyecto-kn7p.onrender.com";
const DEFAULT_BANK_CHECKOUT_URL = "https://bankyfinanzas.netlify.app/checkout";
const DEFAULT_BANK_LOGIN_URL = "https://bankyfinanzas.netlify.app/login";
const DEFAULT_BANK_REGISTER_URL = "https://bankyfinanzas.netlify.app/registro/negocio";
const DEFAULT_FACTURASMART_URL = "https://proyecto-facturaci-n-electr-nica.onrender.com";
const DEFAULT_TRIBUTACION_API_URL = "https://mini-tributacion-backend.onrender.com";
const DEFAULT_FIRMA_DIGITAL_URL = "https://hsm-sign-cr.onrender.com";
const DEFAULT_TRIBUTACION_PORTAL_URL = "https://proyecto-mini-tributacion-directa.onrender.com";

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


let esquemaIntegracionPromise = null;

async function columnaConfiguracionExiste(nombre) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS existe
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'configuracion_facturacion'
        AND COLUMN_NAME = ?`,
    [nombre]
  );
  return Number(row?.existe || 0) > 0;
}

async function crearTablaConfiguracionIntegraciones() {
  await pool.query(`CREATE TABLE IF NOT EXISTS configuracion_integracion_servicios (
    id_configuracion TINYINT NOT NULL PRIMARY KEY,
    factura_bonita_url VARCHAR(500) NULL,
    factura_bonita_api_key LONGTEXT NULL,
    banco_checkout_url VARCHAR(500) NULL,
    banco_login_url VARCHAR(500) NULL,
    banco_registro_url VARCHAR(500) NULL,
    banco_merchant_id VARCHAR(160) NULL,
    banco_afiliado BOOLEAN NOT NULL DEFAULT FALSE,
    firma_digital_url VARCHAR(500) NULL,
    factura_electronica_url VARCHAR(500) NULL,
    factura_electronica_correo VARCHAR(180) NULL,
    factura_electronica_telefono VARCHAR(40) NULL,
    factura_electronica_password LONGTEXT NULL,
    factura_electronica_cuenta_confirmada BOOLEAN NOT NULL DEFAULT FALSE,
    tributacion_url VARCHAR(500) NULL,
    tributacion_provincia VARCHAR(80) NULL,
    tributacion_canton VARCHAR(80) NULL,
    tributacion_distrito VARCHAR(80) NULL,
    tributacion_otras_senas VARCHAR(250) NULL,
    tributacion_telefono VARCHAR(40) NULL,
    tributacion_actividad_economica VARCHAR(160) NULL,
    tributacion_descripcion_servicio VARCHAR(250) NULL,
    tributacion_contribuyente_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const columnas = [
    ["factura_electronica_correo", "VARCHAR(180) NULL"],
    ["factura_electronica_telefono", "VARCHAR(40) NULL"],
    ["factura_electronica_password", "LONGTEXT NULL"],
    ["factura_electronica_cuenta_confirmada", "BOOLEAN NOT NULL DEFAULT FALSE"],
    ["tributacion_provincia", "VARCHAR(80) NULL"],
    ["tributacion_canton", "VARCHAR(80) NULL"],
    ["tributacion_distrito", "VARCHAR(80) NULL"],
    ["tributacion_otras_senas", "VARCHAR(250) NULL"],
    ["tributacion_telefono", "VARCHAR(40) NULL"],
    ["tributacion_actividad_economica", "VARCHAR(160) NULL"],
    ["tributacion_descripcion_servicio", "VARCHAR(250) NULL"],
    ["tributacion_contribuyente_confirmado", "BOOLEAN NOT NULL DEFAULT FALSE"]
  ];
  for (const [nombre, definicion] of columnas) {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS existe FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_integracion_servicios' AND COLUMN_NAME = ?`,
      [nombre]
    );
    if (!Number(row?.existe || 0)) {
      await pool.query(`ALTER TABLE configuracion_integracion_servicios ADD COLUMN ${nombre} ${definicion}`);
    }
  }
}

async function crearTablaDocumentosIntegrados() {
  await pool.query(`CREATE TABLE IF NOT EXISTS documento_facturacion_integrada (
    id_documento BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_cargo INT NOT NULL,
    tipo ENUM('pdf_visual','factura_electronica','acuse') NOT NULL,
    estado VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    identificador_externo VARCHAR(160) NULL,
    url_documento VARCHAR(1000) NULL,
    mime_type VARCHAR(120) NULL,
    contenido LONGTEXT NULL,
    respuesta_json JSON NULL,
    error_mensaje VARCHAR(500) NULL,
    fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_documento_integrado_cargo_tipo (id_cargo, tipo),
    KEY idx_documento_integrado_estado (estado),
    CONSTRAINT fk_documento_integrado_cargo FOREIGN KEY (id_cargo) REFERENCES cargo_estudiante(id_cargo)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function asegurarEsquemaIntegracion() {
  if (esquemaIntegracionPromise) return esquemaIntegracionPromise;
  esquemaIntegracionPromise = (async () => {
    // La tabla de integraciones es la fuente de verdad para credenciales y endpoints.
    // Se crea primero para que una BD anterior pueda guardar configuraciones aunque
    // configuracion_facturacion todavía tenga el esquema original.
    await crearTablaConfiguracionIntegraciones();
    await crearTablaDocumentosIntegrados();
  })().catch((error) => {
    esquemaIntegracionPromise = null;
    throw error;
  });
  return esquemaIntegracionPromise;
}

function urlOpcional(valor, etiqueta) {
  const limpio = String(valor || '').trim().replace(/\/+$/, '');
  if (!limpio) return null;
  if (!esUrlHttpValida(limpio)) throw new Error(`${etiqueta} debe ser una URL http/https válida.`);
  return limpio.slice(0, 500);
}

export async function obtenerConfiguracionInternaIntegraciones() {
  return obtenerConfigInterna();
}

function ocultarApiKey(config) {
  if (!config) return config;
  const { factura_bonita_api_key, factura_electronica_password, ...resto } = config;
  return {
    ...resto,
    factura_bonita_api_key_configurada: Boolean(factura_bonita_api_key),
    factura_electronica_password_configurada: Boolean(factura_electronica_password),
    factura_electronica_cuenta_confirmada: Boolean(config.factura_electronica_cuenta_confirmada)
  };
}

async function obtenerConfigInterna() {
  await asegurarLogoConfiguracion();
  await asegurarEsquemaIntegracion();
  const [rows] = await pool.query(`SELECT * FROM configuracion_facturacion WHERE id_configuracion = 1 LIMIT 1`);
  let integrationRows;
  try {
    [integrationRows] = await pool.query(`SELECT * FROM configuracion_integracion_servicios WHERE id_configuracion = 1 LIMIT 1`);
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    // Reparación defensiva para instalaciones que fueron creadas con un SQL anterior.
    await crearTablaConfiguracionIntegraciones();
    [integrationRows] = await pool.query(`SELECT * FROM configuracion_integracion_servicios WHERE id_configuracion = 1 LIMIT 1`);
  }
  const fiscal = rows[0] || {};
  const integration = integrationRows[0] || {};
  const camposIntegracion = [
    'factura_bonita_url','factura_bonita_api_key','banco_checkout_url','banco_login_url','banco_registro_url',
    'banco_merchant_id','banco_afiliado','firma_digital_url','factura_electronica_url','factura_electronica_correo','factura_electronica_telefono','factura_electronica_password','factura_electronica_cuenta_confirmada','tributacion_url','tributacion_provincia','tributacion_canton','tributacion_distrito','tributacion_otras_senas','tributacion_telefono','tributacion_actividad_economica','tributacion_descripcion_servicio','tributacion_contribuyente_confirmado'
  ];
  const merged = { ...fiscal };
  for (const campo of camposIntegracion) {
    if (integration[campo] !== undefined && integration[campo] !== null) merged[campo] = integration[campo];
  }
  return Object.keys(merged).length ? merged : null;
}

function apiKeyFacturaBonita(config) {
  try { return config?.factura_bonita_api_key ? descifrarSecreto(config.factura_bonita_api_key) : ''; }
  catch { return ''; }
}

function raizFacturaBonita(config) {
  return urlOpcional(config?.factura_bonita_url, 'Factura Bonita') || obtenerRaizFacturacion();
}

let esquemaLogoConfiguracionPromise = null;
const logoSincronizadoPorFactura = new Map();

function firmaLogo(valor) {
  const texto = String(valor || "");
  return `${texto.length}:${texto.slice(-48)}`;
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sincronizarLogoFacturaRemota(idFactura) {
  const id = String(idFactura || '').trim();
  if (!id) return;

  let config;
  try {
    config = await obtenerConfigInterna();
  } catch {
    return;
  }

  // Cuando EduControl está vinculado con una X-Api-Key, la identidad visual
  // pertenece a la cuenta de Factura Bonita y no debe ser sobrescrita desde aquí.
  if (apiKeyFacturaBonita(config)) return;

  const logo = config?.logo_data || null;
  const firma = firmaLogo(logo);
  if (logoSincronizadoPorFactura.get(id) === firma) return;

  const root = obtenerRaizFacturacion();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${root}/api/facturas/${encodeURIComponent(id)}/logo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ logoUrl: logo, logoPosicion: 'left' }),
      signal: controller.signal
    });
    if (response.ok) {
      logoSincronizadoPorFactura.set(id, firma);
      cacheDocumentosFactura.clear();
    }
  } catch (error) {
    console.warn(`Facturación: no se pudo sincronizar el logo de ${id}:`, error?.message || error);
  } finally {
    clearTimeout(timeout);
  }
}

async function asegurarLogoConfiguracion() {
  if (esquemaLogoConfiguracionPromise) return esquemaLogoConfiguracionPromise;

  esquemaLogoConfiguracionPromise = (async () => {
    // Una base recién restaurada puede no traer aún la tabla de configuración.
    // La integración debe poder recuperarse por sí sola antes de intentar ALTER/SELECT.
    await pool.query(`CREATE TABLE IF NOT EXISTS configuracion_facturacion (
      id_configuracion TINYINT NOT NULL PRIMARY KEY,
      institucion_nombre VARCHAR(100) NOT NULL DEFAULT '',
      tipo_identificacion VARCHAR(10) NOT NULL DEFAULT '',
      numero_identificacion VARCHAR(30) NULL,
      correo VARCHAR(150) NULL,
      logo_data LONGTEXT NULL,
      moneda VARCHAR(10) NOT NULL DEFAULT 'CRC',
      condicion_venta VARCHAR(10) NOT NULL DEFAULT '01',
      estado BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS existe, MAX(DATA_TYPE) AS data_type
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
    } else if (String(row?.data_type || '').toLowerCase() !== 'longtext') {
      // Algunas instalaciones antiguas tenían logo_data como TEXT/VARCHAR y la
      // imagen podía truncarse o perderse al recargar. LONGTEXT permite guardar
      // cómodamente el data URL validado (máximo 500 KB en la aplicación).
      await pool.query(
        `ALTER TABLE configuracion_facturacion
         MODIFY COLUMN logo_data LONGTEXT NULL`
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
    throw new Error("El logo es demasiado grande. Usa una imagen PNG, JPG o WEBP menor a 500 KB.");
  }

  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(data)) {
    throw new Error("El logo debe ser una imagen PNG, JPG o WEBP válida.");
  }

  return data;
}

export async function obtenerConfiguracionFacturacion() {
  const actual = await obtenerConfigInterna();
  const base = actual || {
    institucion_nombre: '',
    tipo_identificacion: '',
    numero_identificacion: '',
    correo: '',
    logo_data: null,
    factura_bonita_url: process.env.FACTURACION_API_URL || DEFAULT_FACTURACION_API_URL,
    banco_checkout_url: process.env.BANK_CHECKOUT_URL || DEFAULT_BANK_CHECKOUT_URL,
    banco_login_url: process.env.BANK_LOGIN_URL || DEFAULT_BANK_LOGIN_URL,
    banco_registro_url: process.env.BANK_REGISTER_URL || DEFAULT_BANK_REGISTER_URL,
    banco_merchant_id: process.env.BANK_MERCHANT_ID || null,
    banco_afiliado: Boolean(process.env.BANK_MERCHANT_ID),
    firma_digital_url: DEFAULT_FIRMA_DIGITAL_URL,
    factura_electronica_url: DEFAULT_FACTURASMART_URL,
    factura_electronica_correo: null,
    factura_electronica_telefono: null,
    factura_electronica_password: null,
    factura_electronica_cuenta_confirmada: false,
    tributacion_url: DEFAULT_TRIBUTACION_API_URL,
    tributacion_provincia: null,
    tributacion_canton: null,
    tributacion_distrito: null,
    tributacion_otras_senas: null,
    tributacion_telefono: null,
    tributacion_actividad_economica: null,
    tributacion_descripcion_servicio: null,
    tributacion_contribuyente_confirmado: false
  };
  return ocultarApiKey(base);
}

export async function actualizarConfiguracionFacturacion(datos) {
  await asegurarLogoConfiguracion();
  await asegurarEsquemaIntegracion();

  const actual = (await obtenerConfigInterna()) || {};
  const nombre = String(datos.institucion_nombre ?? actual.institucion_nombre ?? '').trim().slice(0, 100);
  const tipo = String(datos.tipo_identificacion ?? actual.tipo_identificacion ?? '').trim();
  const numeroId = String(datos.numero_identificacion ?? actual.numero_identificacion ?? '').trim().slice(0, 30);
  const correo = String(datos.correo ?? actual.correo ?? '').trim().toLowerCase().slice(0, 150);
  const logoData = Object.prototype.hasOwnProperty.call(datos || {}, "logo_data")
    ? normalizarLogoData(datos.logo_data)
    : (actual?.logo_data || null);

  const facturaBonitaUrl = urlOpcional(datos.factura_bonita_url ?? actual?.factura_bonita_url ?? process.env.FACTURACION_API_URL ?? DEFAULT_FACTURACION_API_URL, "Factura Bonita");
  const bancoCheckoutUrl = urlOpcional(datos.banco_checkout_url ?? actual?.banco_checkout_url ?? DEFAULT_BANK_CHECKOUT_URL, "Servicio de pago");
  const bancoLoginUrl = urlOpcional(datos.banco_login_url ?? actual?.banco_login_url ?? DEFAULT_BANK_LOGIN_URL, "Acceso al servicio de pago");
  const bancoRegistroUrl = urlOpcional(datos.banco_registro_url ?? actual?.banco_registro_url ?? DEFAULT_BANK_REGISTER_URL, "Afiliación al servicio de pago");
  const firmaDigitalUrl = urlOpcional(datos.firma_digital_url ?? actual?.firma_digital_url ?? DEFAULT_FIRMA_DIGITAL_URL, "Firma Digital");
  const facturaElectronicaUrl = urlOpcional(datos.factura_electronica_url ?? actual?.factura_electronica_url ?? DEFAULT_FACTURASMART_URL, "Facturación Electrónica");
  const facturaElectronicaCorreo = String(datos.factura_electronica_correo ?? actual?.factura_electronica_correo ?? '').trim().toLowerCase().slice(0, 180) || null;
  const facturaElectronicaTelefono = String(datos.factura_electronica_telefono ?? actual?.factura_electronica_telefono ?? "").trim().slice(0, 40) || null;
  let facturaElectronicaPassword = actual?.factura_electronica_password || null;
  const nuevaPasswordElectronica = String(datos.factura_electronica_password || "").trim();
  if (nuevaPasswordElectronica) {
    if (nuevaPasswordElectronica.length < 8) throw new Error("La contraseña de FacturaSmart debe tener al menos 8 caracteres.");
    facturaElectronicaPassword = cifrarSecreto(nuevaPasswordElectronica);
  }
  if (datos.limpiar_factura_electronica_password === true) facturaElectronicaPassword = null;
  const cuentaElectronicaConfirmada = Boolean(
    actual?.factura_electronica_cuenta_confirmada &&
    !nuevaPasswordElectronica &&
    facturaElectronicaUrl &&
    facturaElectronicaCorreo &&
    facturaElectronicaPassword
  );
  const tributacionUrl = urlOpcional(datos.tributacion_url ?? actual?.tributacion_url ?? DEFAULT_TRIBUTACION_API_URL, "Tributación");
  const tributacionProvincia = String(datos.tributacion_provincia ?? actual?.tributacion_provincia ?? '').trim().slice(0, 80) || null;
  const tributacionCanton = String(datos.tributacion_canton ?? actual?.tributacion_canton ?? '').trim().slice(0, 80) || null;
  const tributacionDistrito = String(datos.tributacion_distrito ?? actual?.tributacion_distrito ?? '').trim().slice(0, 80) || null;
  const tributacionOtrasSenas = String(datos.tributacion_otras_senas ?? actual?.tributacion_otras_senas ?? '').trim().slice(0, 250) || null;
  const tributacionTelefono = String(datos.tributacion_telefono ?? actual?.tributacion_telefono ?? '').trim().slice(0, 40) || null;
  const tributacionActividad = String(datos.tributacion_actividad_economica ?? actual?.tributacion_actividad_economica ?? '').trim().slice(0, 160) || null;
  const tributacionDescripcion = String(datos.tributacion_descripcion_servicio ?? actual?.tributacion_descripcion_servicio ?? '').trim().slice(0, 250) || null;
  const tributacionContribuyenteConfirmado = Boolean(actual?.tributacion_contribuyente_confirmado);

  let apiKeyCifrada = actual?.factura_bonita_api_key || null;
  if (datos.limpiar_factura_bonita_api_key === true) apiKeyCifrada = null;
  const nuevaApiKey = String(datos.factura_bonita_api_key || "").trim();
  if (nuevaApiKey) {
    if (!/^fb_[A-Za-z0-9_-]{20,120}$/.test(nuevaApiKey)) {
      throw new Error("La clave de Factura Bonita no tiene un formato válido.");
    }
    apiKeyCifrada = cifrarSecreto(nuevaApiKey);
  }

  const tieneMerchantEntrante = Object.prototype.hasOwnProperty.call(datos || {}, 'banco_merchant_id');
  const merchantEntrante = String(datos.banco_merchant_id ?? '').trim();
  const bancoMerchantId = String(
    tieneMerchantEntrante
      ? merchantEntrante
      : (actual?.banco_merchant_id || process.env.BANK_MERCHANT_ID || '')
  ).trim().slice(0, 160) || null;
  const bancoAfiliadoSolicitado = Object.prototype.hasOwnProperty.call(datos || {}, 'banco_afiliado')
    ? (datos.banco_afiliado === true || String(datos.banco_afiliado).toLowerCase() === 'true' || Number(datos.banco_afiliado) === 1)
    : Boolean(actual?.banco_afiliado || process.env.BANK_MERCHANT_ID);
  const bancoAfiliado = Boolean(bancoAfiliadoSolicitado && bancoMerchantId);
  if (bancoAfiliado && !bancoMerchantId) {
    throw new Error("Indica el identificador de comercio del servicio de pago antes de marcarlo como afiliado.");
  }
  if (bancoMerchantId && !/^[A-Za-z0-9_-]{20,128}$/.test(bancoMerchantId)) {
    throw new Error("El identificador de comercio del servicio de pago no tiene un formato válido.");
  }

  await pool.query(
    `INSERT INTO configuracion_integracion_servicios
      (id_configuracion, factura_bonita_url, factura_bonita_api_key, banco_checkout_url, banco_login_url, banco_registro_url,
       banco_merchant_id, banco_afiliado, firma_digital_url, factura_electronica_url, factura_electronica_correo, factura_electronica_telefono, factura_electronica_password, factura_electronica_cuenta_confirmada, tributacion_url,
       tributacion_provincia, tributacion_canton, tributacion_distrito, tributacion_otras_senas, tributacion_telefono, tributacion_actividad_economica, tributacion_descripcion_servicio, tributacion_contribuyente_confirmado)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       factura_bonita_url=VALUES(factura_bonita_url), factura_bonita_api_key=VALUES(factura_bonita_api_key),
       banco_checkout_url=VALUES(banco_checkout_url), banco_login_url=VALUES(banco_login_url), banco_registro_url=VALUES(banco_registro_url),
       banco_merchant_id=VALUES(banco_merchant_id), banco_afiliado=VALUES(banco_afiliado),
       firma_digital_url=VALUES(firma_digital_url), factura_electronica_url=VALUES(factura_electronica_url),
       factura_electronica_correo=VALUES(factura_electronica_correo), factura_electronica_telefono=VALUES(factura_electronica_telefono), factura_electronica_password=VALUES(factura_electronica_password),
       factura_electronica_cuenta_confirmada=VALUES(factura_electronica_cuenta_confirmada), tributacion_url=VALUES(tributacion_url),
       tributacion_provincia=VALUES(tributacion_provincia), tributacion_canton=VALUES(tributacion_canton), tributacion_distrito=VALUES(tributacion_distrito),
       tributacion_otras_senas=VALUES(tributacion_otras_senas), tributacion_telefono=VALUES(tributacion_telefono),
       tributacion_actividad_economica=VALUES(tributacion_actividad_economica), tributacion_descripcion_servicio=VALUES(tributacion_descripcion_servicio),
       tributacion_contribuyente_confirmado=VALUES(tributacion_contribuyente_confirmado)`,
    [facturaBonitaUrl, apiKeyCifrada, bancoCheckoutUrl, bancoLoginUrl, bancoRegistroUrl, bancoMerchantId, bancoAfiliado ? 1 : 0,
     firmaDigitalUrl, facturaElectronicaUrl, facturaElectronicaCorreo, facturaElectronicaTelefono, facturaElectronicaPassword, cuentaElectronicaConfirmada ? 1 : 0, tributacionUrl,
     tributacionProvincia, tributacionCanton, tributacionDistrito, tributacionOtrasSenas, tributacionTelefono, tributacionActividad, tributacionDescripcion, tributacionContribuyenteConfirmado ? 1 : 0]
  );

  // Los datos fiscales se guardan en su tabla propia. Los endpoints/credenciales
  // permanecen únicamente en configuracion_integracion_servicios para evitar
  // duplicación y diferencias entre versiones de la base de datos.
  const emisorCompleto = Boolean(nombre && tipo && numeroId && correo);
  await pool.query(
    `INSERT INTO configuracion_facturacion
      (id_configuracion, institucion_nombre, tipo_identificacion, numero_identificacion, correo, logo_data, moneda, condicion_venta, estado)
     VALUES (1, ?, ?, ?, ?, ?, 'CRC', '01', ?)
     ON DUPLICATE KEY UPDATE
       institucion_nombre = VALUES(institucion_nombre),
       tipo_identificacion = VALUES(tipo_identificacion),
       numero_identificacion = VALUES(numero_identificacion),
       correo = VALUES(correo),
       logo_data = VALUES(logo_data),
       estado = VALUES(estado)`,
    [nombre, tipo, numeroId, correo, logoData, emisorCompleto ? 1 : 0]
  );

  // Cualquier cambio de credenciales debe invalidar el token anterior. Esto es
  // especialmente importante si la cuenta externa fue recreada con el mismo correo.
  if (typeof facturaSmartTokenCache !== 'undefined') facturaSmartTokenCache = { key: '', token: '', expiresAt: 0 };
  return obtenerConfiguracionFacturacion();
}


let facturaSmartTokenCache = { key: '', token: '', expiresAt: 0 };

function raizFacturaSmart(config) {
  return urlOpcional(config?.factura_electronica_url || DEFAULT_FACTURASMART_URL, 'Facturación Electrónica') || DEFAULT_FACTURASMART_URL;
}

function uuidFacturaSmartCargo(idCargo, referenciaUnica = '') {
  // No usamos solamente id_cargo: al recrear la base de datos MySQL, los IDs
  // vuelven a 1, 2, 3... y chocan con facturas antiguas que FacturaSmart aún
  // conserva. La factura visual de Factura Bonita (F-XXXXXXXX) sí es única y
  // estable para cada cobro, por eso forma parte del identificador remoto.
  const referencia = String(referenciaUnica || '').trim() || `cargo:${Number(idCargo)}`;
  const hex = createHash('sha256').update(`educontrol:factura:${referencia}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8','9','a','b'][parseInt(hex[16], 16) % 4];
  const h = hex.join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function tipoIdentificacionFacturaSmart(tipo) {
  const mapa = { '01': 'CEDULA_FISICA', '02': 'CEDULA_JURIDICA', '03': 'DIMEX', '04': 'NITE' };
  const limpio = String(tipo || '').trim().toUpperCase();
  return mapa[limpio] || (['CEDULA_FISICA','CEDULA_JURIDICA','DIMEX','NITE'].includes(limpio) ? limpio : 'CEDULA_FISICA');
}

function fechaFacturaSmart(valor) {
  const fecha = valor ? new Date(valor) : new Date();
  const valida = Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  // El contrato publicado por FacturaSmart usa LocalDateTime (sin Z/offset).
  // Enviar Date#toISOString() directamente agrega `Z` y puede ser rechazado
  // antes de que la factura llegue a registrarse en su portal.
  return valida.toISOString().replace(/\.\d{3}Z$/, '');
}

async function fetchFacturaSmart(root, ruta, { method = 'GET', body = null, token = null, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${String(root).replace(/\/$/, '')}${ruta}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { mensaje: text } : null; }
    if (!response.ok) {
      const error = new Error(data?.message || data?.mensaje || data?.error || `FacturaSmart respondió HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.responseData = data;
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}

async function loginFacturaSmart(config, { force = false } = {}) {
  const root = raizFacturaSmart(config);
  const correo = String(config?.factura_electronica_correo || '').trim().toLowerCase();
  let password = '';
  try { password = config?.factura_electronica_password ? descifrarSecreto(config.factura_electronica_password) : ''; } catch {}
  if (!correo || !password) throw new Error('Configura el correo y la contraseña de FacturaSmart antes de emitir factura electrónica.');
  // El mismo correo puede corresponder a una cuenta recreada con otra contraseña.
  // Incluir una huella de la contraseña evita reutilizar durante 45 minutos el
  // token de una cuenta anterior que ya fue eliminada/recreada en FacturaSmart.
  const passwordFingerprint = createHash('sha256').update(password).digest('hex').slice(0, 16);
  const key = `${root}|${correo}|${passwordFingerprint}`;
  if (!force && facturaSmartTokenCache.key === key && facturaSmartTokenCache.token && facturaSmartTokenCache.expiresAt > Date.now() + 30000) {
    return facturaSmartTokenCache.token;
  }
  const data = await fetchFacturaSmart(root, '/api/v1/auth/login', { method: 'POST', body: { correo, password }, timeout: 30000 });
  const token = String(data?.accessToken || data?.token || '').trim();
  if (!token) throw new Error('FacturaSmart inició sesión, pero no devolvió accessToken.');
  facturaSmartTokenCache = { key, token, expiresAt: Date.now() + 45 * 60 * 1000 };
  return token;
}

async function consumirFacturaSmart(config, ruta, options = {}) {
  const root = raizFacturaSmart(config);
  let token = await loginFacturaSmart(config);
  try {
    return await fetchFacturaSmart(root, ruta, { ...options, token });
  } catch (error) {
    if (Number(error?.statusCode) !== 401) throw error;
    token = await loginFacturaSmart(config, { force: true });
    return fetchFacturaSmart(root, ruta, { ...options, token });
  }
}

function datosFiscalesDesdePerfilFacturaSmart(perfil) {
  const p = perfil?.cliente || perfil?.data || perfil || {};
  const identificacion = p?.identificacion && typeof p.identificacion === 'object' ? p.identificacion : {};
  const nombre = String(p.nombreRazonSocial ?? p.nombre_razon_social ?? p.nombre ?? '').trim();
  const tipoExterno = String(p.tipoIdentificacion ?? p.tipo_identificacion ?? identificacion.tipo ?? '').trim().toUpperCase();
  const numero = String(p.numeroIdentificacion ?? p.numero_identificacion ?? identificacion.numero ?? '').trim();
  const correo = String(p.correo ?? p.email ?? '').trim().toLowerCase();
  const tipoLocal = ({ CEDULA_FISICA: '01', CEDULA_JURIDICA: '02', DIMEX: '03', NITE: '04' })[tipoExterno] || null;
  return { nombre, tipoExterno, tipoLocal, numero, correo };
}

async function sincronizarEmisorConPerfilFacturaSmart(perfil) {
  const fiscal = datosFiscalesDesdePerfilFacturaSmart(perfil);
  if (!fiscal.tipoLocal || !fiscal.numero) return { sincronizado: false, coincide: null, ...fiscal };

  // El emisor de EduControl es configuración propia de la escuela. Nunca se
  // sobrescribe automáticamente con el perfil remoto: al recrear las bases, el
  // administrador debe capturarlo manualmente. FacturaSmart se consulta solo
  // para avisar si los datos no coinciden antes de generar el XML.
  const [actualRows] = await pool.query(`SELECT * FROM configuracion_facturacion WHERE id_configuracion=1 LIMIT 1`);
  const actual = actualRows?.[0] || {};
  const coincide = Boolean(
    String(actual.tipo_identificacion || '').trim() === String(fiscal.tipoLocal || '').trim() &&
    String(actual.numero_identificacion || '').replace(/\D/g, '') === String(fiscal.numero || '').replace(/\D/g, '')
  );
  return { sincronizado: false, coincide, ...fiscal };
}

export async function vincularCuentaFacturaSmart() {
  await asegurarEsquemaIntegracion();
  const config = await obtenerConfigInterna();
  const root = raizFacturaSmart(config);
  const correo = String(config?.factura_electronica_correo || '').trim().toLowerCase();
  let password = '';
  try { password = config?.factura_electronica_password ? descifrarSecreto(config.factura_electronica_password) : ''; } catch {}
  if (!correo || !password) throw new Error('Primero crea o inicia sesión en el portal oficial de FacturaSmart y guarda aquí ese correo y contraseña.');

  // EduControl NO replica el formulario de registro de FacturaSmart. La cuenta se
  // crea en su portal oficial; aquí únicamente comprobamos el login y persistimos
  // que esta instalación de EduControl quedó vinculada con esa cuenta.
  const token = await loginFacturaSmart(config, { force: true });

  // Un login correcto ya demuestra que las credenciales pertenecen a una cuenta
  // válida. Marcamos la integración como activa antes de consultar el perfil para
  // que una demora o fallo secundario de /clientes/me no deje el estado en
  // "Pendiente" aunque la autenticación haya sido exitosa.
  await pool.query(`UPDATE configuracion_integracion_servicios SET factura_electronica_cuenta_confirmada=TRUE WHERE id_configuracion=1`);

  let perfil = null;
  try {
    perfil = await fetchFacturaSmart(root, '/api/v1/clientes/me', { token, timeout: 20000 });
  } catch {
    perfil = null;
  }
  return { ok: true, correo, url: root, perfil };
}

async function procesarFacturaElectronicaFacturaSmart(idCargo, payloadBase, config) {
  if (!config?.factura_electronica_url) return { ok: false, estado: 'pendiente_endpoint' };
  if (!config?.factura_electronica_password || !config?.factura_electronica_correo) {
    await upsertDocumentoIntegrado(idCargo, 'factura_electronica', { estado: 'pendiente_credenciales', error: 'Falta vincular la cuenta de FacturaSmart.' });
    return { ok: false, estado: 'pendiente_credenciales' };
  }

  const [rows] = await pool.query(`SELECT identificador_externo, estado FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' LIMIT 1`, [Number(idCargo)]);
  if (rows[0]?.identificador_externo && rows[0]?.estado === 'disponible') {
    return { ok: true, id: rows[0].identificador_externo, estado: 'disponible' };
  }

  // La identidad del emisor que acepta FacturaSmart es la de la cuenta
  // autenticada. Consultarla antes de procesar evita que una base recreada o un
  // dato escrito distinto en EduControl provoque un 4xx/502 en la integración.
  // Los datos fiscales de EduControl no se sobrescriben: solo usamos el perfil
  // remoto como fuente de verdad para ESTA petición electrónica.
  let perfilFacturaSmart = null;
  try {
    perfilFacturaSmart = await consumirFacturaSmart(config, '/api/v1/clientes/me', { timeout: 20000 });
  } catch (errorPerfil) {
    console.warn(`FacturaSmart perfil (cargo ${idCargo}):`, errorPerfil?.message || errorPerfil);
  }
  const fiscalRemoto = datosFiscalesDesdePerfilFacturaSmart(perfilFacturaSmart);
  const emisorFacturaSmart = {
    nombre: fiscalRemoto.nombre || payloadBase.emisor.nombre,
    identificacion: {
      tipo: fiscalRemoto.tipoExterno || tipoIdentificacionFacturaSmart(payloadBase.emisor.identificacion?.tipo),
      numero: fiscalRemoto.numero || payloadBase.emisor.identificacion?.numero
    },
    correo: fiscalRemoto.correo || String(config?.factura_electronica_correo || '').trim().toLowerCase() || payloadBase.emisor.correo
  };

  // FacturaSmart publica un contrato JSON estricto para /facturas/procesar.
  // Desde que EduControl incorporó IVA, el payload visual de Factura Bonita
  // empezó a incluir campos adicionales (monto del impuesto, baseImponible,
  // impuestoAsumidoEmisor, totales extendidos, etc.). Esos campos son válidos
  // para nuestro PDF, pero NO forman parte del DTO público de FacturaSmart y
  // pueden hacer que Spring/Jackson rechace la solicitud antes de registrarla.
  // Construimos aquí un DTO limpio exactamente con el contrato de integración.
  const itemsFacturaSmart = (Array.isArray(payloadBase.items) ? payloadBase.items : []).map((item, index) => {
    const precioUnitario = Math.max(0, numero(item?.precioUnitario));
    const descuento = Math.max(0, numero(item?.descuento));
    const tarifa = Math.max(0, numero(item?.impuesto?.tarifa));
    const subtotal = Math.max(0, Math.round((precioUnitario * Math.max(1, numero(item?.cantidad) || 1) - descuento) * 100) / 100);
    const montoTotalLinea = Math.max(0, numero(item?.montoTotalLinea));
    return {
      numeroLinea: Number(item?.numeroLinea || index + 1),
      detalle: String(item?.detalle || 'Servicio educativo').trim(),
      cantidad: Math.max(1, numero(item?.cantidad) || 1),
      precioUnitario,
      descuento,
      impuesto: { tarifa },
      subtotal,
      montoTotalLinea
    };
  });

  const totalGravado = Math.max(0, numero(payloadBase?.totales?.totalGravado));
  const totalExento = Math.max(0, numero(payloadBase?.totales?.totalExento));
  const totalDescuentos = Math.max(0, numero(payloadBase?.totales?.totalDescuentos));
  const totalImpuesto = Math.max(0, numero(payloadBase?.totales?.totalImpuesto));
  const totalComprobante = Math.max(0, numero(payloadBase?.totales?.totalComprobante));

  const facturaVisualId = String(payloadBase?.facturaVisualId || payloadBase?.idFacturaVisual || '').trim();
  const idFacturaSmartEsperado = uuidFacturaSmartCargo(idCargo, facturaVisualId);

  const body = {
    id: idFacturaSmartEsperado,
    fecha: fechaFacturaSmart(payloadBase.fecha),
    moneda: String(payloadBase.moneda || 'CRC'),
    condicionVenta: String(payloadBase.condicionVenta || '01'),
    medioPago: String(payloadBase.medioPago || '01'),
    tipoDocumento: 'FACTURA_ELECTRONICA',
    emisor: emisorFacturaSmart,
    receptor: {
      nombre: payloadBase.receptor.nombre,
      identificacion: payloadBase.receptor.identificacion ? {
        tipo: tipoIdentificacionFacturaSmart(payloadBase.receptor.identificacion.tipo),
        numero: String(payloadBase.receptor.identificacion.numero || '').trim()
      } : null,
      correo: payloadBase.receptor.correo
    },
    items: itemsFacturaSmart,
    totales: {
      totalGravado,
      totalExento,
      totalDescuentos,
      totalImpuesto,
      totalComprobante
    }
  };

  try {
    const respuesta = await consumirFacturaSmart(config, '/api/v1/facturas/procesar', { method: 'POST', body, timeout: 60000 });
    const id = String(respuesta?.id || respuesta?.facturaId || respuesta?.factura?.id || body.id).trim();
    const root = raizFacturaSmart(config);

    // La factura electrónica no debe quedar solamente "en FacturaSmart". En cuanto
    // se procesa, EduControl intenta traer el XML y conservar una copia local en
    // base64. Así el módulo de Facturación puede entregarlo directamente aunque el
    // servicio externo esté temporalmente dormido más adelante.
    let xmlLocal = null;
    let xmlMime = 'application/xml';
    let errorCopiaXml = null;
    try {
      const xml = await fetchFacturaSmartBinario(config, `/api/v1/facturas/${encodeURIComponent(id)}/xml`, 30000);
      xmlLocal = xml.buffer.toString('base64');
      xmlMime = xml.contentType || 'application/xml';
    } catch (errorXml) {
      errorCopiaXml = errorXml?.message || 'El XML fue generado en FacturaSmart, pero EduControl todavía no pudo copiarlo.';
    }

    await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
      estado: xmlLocal ? 'disponible' : 'remoto_disponible',
      identificador: id,
      url: `${root}/api/v1/facturas/${encodeURIComponent(id)}/xml`,
      mimeType: xmlMime,
      contenido: xmlLocal,
      respuesta,
      error: errorCopiaXml
    });
    // FacturaSmart puede generar y conservar el XML desde ahora. El acuse no se
    // marca como error: queda expresamente pendiente hasta que exista firma digital
    // y el flujo DGTD/Tributación esté habilitado por los otros grupos.
    await upsertDocumentoIntegrado(idCargo, 'acuse', {
      estado: 'pendiente_tributacion',
      identificador: id,
      error: 'Factura electrónica generada. Pendiente de validación y acuse de Mini Tributación.'
    });
    await procesarFacturaTributacion(idCargo, payloadBase, config).catch((errorTributacion) => {
      console.warn(`Mini Tributación (cargo ${idCargo}):`, errorTributacion?.message || errorTributacion);
    });
    return { ok: true, id, estado: 'disponible', respuesta };
  } catch (error) {
    const mensaje = error?.message || 'No se pudo procesar la factura electrónica.';
    const status = Number(error?.statusCode || 0);
    const detalle = String(error?.responseData?.message || error?.responseData?.mensaje || mensaje || '');
    const esDuplicada = [400, 409].includes(status) && /ya existe una factura|already exists|duplicad/i.test(detalle);

    // FacturaSmart actualmente puede responder 400 (no solo 409) cuando el ID
    // ya existe. Eso no debe dejar la factura en error: significa que un intento
    // anterior alcanzó a registrar el comprobante. Recuperamos directamente su
    // XML y lo vinculamos al cargo local sin volver a cobrar ni borrar datos.
    if (esDuplicada) {
      try {
        const idExistente = idFacturaSmartEsperado;
        let existente = null;
        try {
          existente = await consumirFacturaSmart(config, `/api/v1/facturas/${encodeURIComponent(idExistente)}`, { timeout: 30000 });
        } catch {}

        let xml = null;
        let ultimoErrorXml = null;
        for (const espera of [0, 700, 1500, 3000]) {
          if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
          try {
            xml = await fetchFacturaSmartBinario(config, `/api/v1/facturas/${encodeURIComponent(idExistente)}/xml`, 30000);
            if (xml?.buffer?.length) break;
          } catch (errorXml) {
            ultimoErrorXml = errorXml;
          }
        }

        if (xml?.buffer?.length) {
          const root = raizFacturaSmart(config);
          await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
            estado: 'disponible',
            identificador: idExistente,
            url: `${root}/api/v1/facturas/${encodeURIComponent(idExistente)}/xml`,
            mimeType: xml.contentType || 'application/xml',
            contenido: xml.buffer.toString('base64'),
            respuesta: existente || error?.responseData || { recuperada: true },
            error: null
          });
          await upsertDocumentoIntegrado(idCargo, 'acuse', {
            estado: 'pendiente_tributacion',
            identificador: idExistente,
            error: 'Factura electrónica XML recuperada. Pendiente de validación y acuse de Mini Tributación.'
          });
          await procesarFacturaTributacion(idCargo, payloadBase, config).catch(() => null);
          console.log(`FacturaSmart recuperada (cargo ${idCargo}): ${idExistente}`);
          return { ok: true, id: idExistente, estado: 'disponible', recuperada: true };
        }

        if (ultimoErrorXml) {
          console.warn(`FacturaSmart existente sin XML recuperable (cargo ${idCargo}):`, ultimoErrorXml?.message || ultimoErrorXml);
        }
      } catch (errorRecuperacion) {
        console.warn(`FacturaSmart recuperación (cargo ${idCargo}):`, errorRecuperacion?.message || errorRecuperacion);
      }
    }

    console.error(`FacturaSmart directo (cargo ${idCargo}):`, mensaje, error?.responseData ? JSON.stringify(error.responseData) : '');
    await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
      estado: 'error',
      identificador: idFacturaSmartEsperado,
      error: mensaje
    });
    return { ok: false, estado: 'error', mensaje };
  }
}

async function registrarElectronicaRecibidaDesdeFacturaBonita(idCargo, datos, config) {
  if (!datos?.ok) return null;
  const id = String(datos?.id || datos?.facturaSmartId || '').trim();
  const xmlBase64 = String(datos?.xmlBase64 || '').trim();
  if (!id || !xmlBase64) return null;

  await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
    estado: 'disponible',
    identificador: id,
    url: `${raizFacturaSmart(config)}/api/v1/facturas/${encodeURIComponent(id)}/xml`,
    mimeType: datos?.mimeType || 'application/xml',
    contenido: xmlBase64,
    respuesta: { origen: 'api-factura', servicio: datos?.servicio || raizFacturaSmart(config) },
    error: null
  });
  await upsertDocumentoIntegrado(idCargo, 'acuse', {
    estado: 'pendiente_tributacion',
    identificador: id,
    error: 'Factura electrónica XML disponible. Pendiente de validación y acuse de Mini Tributación.'
  });
  await procesarFacturaTributacion(idCargo, null, config).catch(() => null);
  return { ok: true, id, estado: 'disponible', origen: 'api-factura' };
}

async function fetchFacturaSmartBinario(config, ruta, timeout = 30000) {
  const root = raizFacturaSmart(config);
  let token = await loginFacturaSmart(config);
  for (let intento = 0; intento < 2; intento += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${root}${ruta}`, {
        headers: { Accept: '*/*', Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      if (response.status === 401 && intento === 0) {
        token = await loginFacturaSmart(config, { force: true });
        continue;
      }
      if (!response.ok) throw new Error(`FacturaSmart respondió HTTP ${response.status} al consultar el documento.`);
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type') || 'application/octet-stream'
      };
    } finally { clearTimeout(timer); }
  }
  throw new Error('No se pudo autenticar la consulta del documento de FacturaSmart.');
}

async function obtenerElectronicaCacheadaEnFacturaBonita(idCargo, config) {
  const [[vinculo]] = await pool.query(
    `SELECT id_factura_externa FROM factura_cargo WHERE id_cargo=? LIMIT 1`,
    [Number(idCargo)]
  );
  const idVisual = String(vinculo?.id_factura_externa || '').trim();
  if (!idVisual) return null;

  const root = raizFacturaBonita(config);
  const headers = { Accept: 'application/json' };
  const key = apiKeyFacturaBonita(config);
  if (key) headers['X-Api-Key'] = key;

  let estado = null;
  try {
    const response = await fetch(`${root}/api/facturas/${encodeURIComponent(idVisual)}/electronica`, { headers });
    if (response.ok) estado = await response.json();
  } catch {}
  if (!estado?.xmlDisponible) return null;

  const response = await fetch(`${root}/api/facturas/${encodeURIComponent(idVisual)}/electronica/xml`, {
    headers: { ...headers, Accept: 'application/xml,text/xml,*/*' }
  });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) return null;
  const smartId = String(estado?.facturaSmartId || '').trim();
  await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
    estado: 'disponible',
    identificador: smartId || null,
    mimeType: response.headers.get('content-type') || 'application/xml',
    contenido: buffer.toString('base64'),
    respuesta: { origen: 'api-factura-cache', factura_visual: idVisual },
    error: null
  }).catch(() => {});
  return {
    buffer,
    contentType: response.headers.get('content-type') || 'application/xml',
    id: smartId || idVisual
  };
}

export async function obtenerDocumentoElectronicoFacturaSmart(idCargo, formato = 'xml') {
  const config = await obtenerConfigInterna();
  const [rows] = await pool.query(
    `SELECT identificador_externo, estado, mime_type, contenido FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' LIMIT 1`,
    [Number(idCargo)]
  );
  const registro = rows[0] || {};
  let id = String(registro.identificador_externo || '').trim();
  const limpio = String(formato || 'xml').toLowerCase();

  // El XML se sirve primero desde la copia recibida por EduControl.
  if (limpio === 'xml' && registro.contenido) {
    return {
      buffer: Buffer.from(String(registro.contenido), 'base64'),
      contentType: registro.mime_type || 'application/xml',
      filename: `factura-electronica-${id || Number(idCargo)}.xml`
    };
  }

  // Si Factura Bonita ya recibió y guardó el XML desde FacturaSmart, EduControl
  // puede recuperarlo desde ese puente incluso si la llamada directa se interrumpió.
  if (limpio === 'xml') {
    const cacheBonita = await obtenerElectronicaCacheadaEnFacturaBonita(idCargo, config).catch(() => null);
    if (cacheBonita) {
      return {
        buffer: cacheBonita.buffer,
        contentType: cacheBonita.contentType,
        filename: `factura-electronica-${cacheBonita.id}.xml`
      };
    }
  }

  if (!config?.factura_electronica_cuenta_confirmada) throw new Error('La cuenta de FacturaSmart todavía no está vinculada.');
  if (!id) throw new Error('La factura electrónica todavía no está disponible para este cargo.');

  const ruta = limpio === 'pdf' ? `/api/v1/facturas/${encodeURIComponent(id)}/pdf` : `/api/v1/facturas/${encodeURIComponent(id)}/xml`;
  const documento = await fetchFacturaSmartBinario(config, ruta, 30000);

  // Si EduControl aún no tenía la copia XML (por ejemplo, FacturaSmart estaba
  // despertando al momento del pago), la guardamos en el primer acceso exitoso.
  if (limpio === 'xml') {
    await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
      estado: 'disponible',
      identificador: id,
      mimeType: documento.contentType || 'application/xml',
      contenido: documento.buffer.toString('base64'),
      error: null
    }).catch(() => {});
  }

  return {
    ...documento,
    filename: limpio === 'pdf' ? `factura-electronica-${id}.pdf` : `factura-electronica-${id}.xml`
  };
}

export async function registrarPagoBankyFacturaSmart(idCargo, payload = {}) {
  const config = await obtenerConfigInterna().catch(() => null);
  if (!config?.factura_electronica_url || !config?.factura_electronica_password) return { ok: false, omitido: true };
  const [rows] = await pool.query(`SELECT identificador_externo FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' AND estado='disponible' LIMIT 1`, [Number(idCargo)]);
  const id = String(rows[0]?.identificador_externo || '').trim();
  if (!id) return { ok: false, pendiente: true };
  const body = {
    status: String(payload?.status || 'completed').toLowerCase(),
    transactionCode: String(payload?.transactionCode || payload?.transaction_code || '').trim(),
    cardBrand: payload?.cardBrand || payload?.card_brand || null,
    cardLastFourDigits: payload?.cardLastFourDigits || payload?.card_last_four_digits || payload?.last4 || null,
    cardholderName: payload?.cardholderName || payload?.cardholder_name || null
  };
  if (!body.transactionCode) return { ok: false, omitido: true };
  try {
    const respuesta = await consumirFacturaSmart(config, `/api/v1/facturas/${encodeURIComponent(id)}/pago-banky`, { method: 'POST', body, timeout: 30000 });
    return { ok: true, id, respuesta };
  } catch (error) {
    console.warn(`FacturaSmart: no se pudo registrar Banky para cargo ${idCargo}:`, error?.message || error);
    return { ok: false, id, mensaje: error?.message || 'No se pudo registrar el pago Banky.' };
  }
}




function raizFirmaDigital(config) {
  return urlOpcional(config?.firma_digital_url || DEFAULT_FIRMA_DIGITAL_URL, 'Firma Digital') || DEFAULT_FIRMA_DIGITAL_URL;
}

async function fetchFirmaDigital(config, ruta, { method = 'GET', body = null, timeout = 30000 } = {}) {
  const root = raizFirmaDigital(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${root}${ruta}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { mensaje: text } : null; }
    if (!response.ok) {
      const error = new Error(data?.error || data?.mensaje || data?.message || data?.motivo || `Firma Digital respondió HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.responseData = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Firma Digital tardó demasiado en responder.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function listaCertificadosFirma(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.certificados)) return data.certificados;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function consultarCertificadoFirma(config, identificacion) {
  const id = String(identificacion || '').trim();
  if (!id) return { encontrado: false, vigente: false, certificados: [] };
  try {
    const data = await fetchFirmaDigital(config, `/api/documentos/certificados/por-identificacion/${encodeURIComponent(id)}`, { timeout: 25000 });
    const certificados = listaCertificadosFirma(data);
    const vigente = certificados.find((item) =>
      String(item?.certificado?.estado || item?.estado || '').trim().toUpperCase() === 'VIGENTE' || item?.firmaVigente === true
    ) || null;
    return { encontrado: certificados.length > 0, vigente: Boolean(vigente), certificado: vigente, certificados };
  } catch (error) {
    if (Number(error?.statusCode) === 404) return { encontrado: false, vigente: false, certificados: [] };
    throw error;
  }
}

async function probarFirmaDigital(config) {
  const url = raizFirmaDigital(config);
  const identificacion = String(config?.numero_identificacion || '').trim();
  if (!identificacion) {
    return { configurado: true, disponible: true, estado: 'pendiente_identificacion', url, portal_url: DEFAULT_FIRMA_DIGITAL_URL, certificado_vigente: false, detalle: 'Completa la identificación fiscal de EduControl para verificar la firma digital.' };
  }
  try {
    const resultado = await consultarCertificadoFirma(config, identificacion);
    return {
      configurado: true,
      disponible: true,
      estado: resultado.vigente ? 'vinculado' : (resultado.encontrado ? 'certificado_no_vigente' : 'pendiente_registro'),
      url,
      portal_url: DEFAULT_FIRMA_DIGITAL_URL,
      certificado_vigente: resultado.vigente,
      certificado: resultado.certificado || null,
      detalle: resultado.vigente
        ? 'EduControl está registrado en HSM Sign CR y posee un certificado VIGENTE.'
        : resultado.encontrado
          ? 'EduControl aparece en HSM Sign CR, pero no tiene un certificado VIGENTE.'
          : 'La identificación de EduControl todavía no aparece registrada en HSM Sign CR.'
    };
  } catch (error) {
    return { configurado: true, disponible: false, estado: 'error', url, portal_url: DEFAULT_FIRMA_DIGITAL_URL, certificado_vigente: false, detalle: error?.message || 'No fue posible consultar Firma Digital.' };
  }
}

export async function obtenerEstadoFirmaDigital() {
  const config = await obtenerConfiguracionFacturacion();
  return probarFirmaDigital(config);
}

function xmlTieneFirmaDigital(xml) {
  const texto = String(xml || '');
  return /<(?:[A-Za-z0-9_-]+:)?Signature\b/i.test(texto);
}

export async function firmarFacturaElectronicaHSM(idCargo, pin) {
  const cargoId = Number(idCargo);
  if (!Number.isFinite(cargoId) || cargoId <= 0) throw new Error('Cargo inválido.');
  const pinLimpio = String(pin || '');
  if (!pinLimpio) {
    const error = new Error('Ingresa el PIN de Firma Digital para firmar el XML.');
    error.statusCode = 400;
    throw error;
  }

  const config = await obtenerConfigInterna();
  const identificacion = String(config?.numero_identificacion || '').trim();
  if (!identificacion) throw new Error('Falta la identificación fiscal de EduControl.');

  const certificado = await consultarCertificadoFirma(config, identificacion);
  if (!certificado.vigente) {
    const error = new Error(certificado.encontrado ? 'EduControl no tiene un certificado VIGENTE en Firma Digital.' : 'EduControl no está registrado en Firma Digital.');
    error.statusCode = 400;
    error.code = 'FIRMA_DIGITAL_NO_VIGENTE';
    throw error;
  }

  const documento = await obtenerDocumentoElectronicoFacturaSmart(cargoId, 'xml');
  const xmlOriginal = documento.buffer.toString('utf8');
  if (!xmlOriginal.trim()) throw new Error('La factura XML todavía no está disponible.');

  if (xmlTieneFirmaDigital(xmlOriginal)) {
    const validacion = await fetchFirmaDigital(config, '/api/documentos/validar', { method: 'POST', body: { xmlFirmado: xmlOriginal }, timeout: 45000 });
    if (validacion?.esValida === true) {
      const tributacion = await procesarFacturaTributacion(cargoId, null, config);
      return { ok: true, ya_firmado: true, validacion, tributacion };
    }
  }

  const firma = await fetchFirmaDigital(config, '/api/documentos/firmar', {
    method: 'POST',
    body: { identificacion, pin: pinLimpio, xmlFactura: xmlOriginal },
    timeout: 60000
  });
  const xmlFirmado = String(firma?.xmlFirmado || '').trim();
  if (!firma?.success || !xmlFirmado) throw new Error(firma?.error || firma?.mensaje || 'Firma Digital no devolvió el XML firmado.');

  const validacion = await fetchFirmaDigital(config, '/api/documentos/validar', {
    method: 'POST', body: { xmlFirmado }, timeout: 45000
  });
  if (validacion?.esValida !== true) {
    const error = new Error(validacion?.motivo || 'El XML fue firmado, pero HSM Sign CR no pudo validar la firma.');
    error.statusCode = 422;
    throw error;
  }

  const [rows] = await pool.query(`SELECT identificador_externo FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' LIMIT 1`, [cargoId]);
  const identificador = String(rows[0]?.identificador_externo || '').trim() || null;
  await upsertDocumentoIntegrado(cargoId, 'factura_electronica', {
    estado: 'disponible',
    identificador,
    mimeType: 'application/xml',
    contenido: Buffer.from(xmlFirmado, 'utf8').toString('base64'),
    respuesta: {
      firmado: true,
      servicio: 'HSM Sign CR',
      hashDocumento: firma?.hashDocumento || null,
      serialCertificado: firma?.serialCertificado || validacion?.serialCertificado || null,
      signerId: validacion?.signerId || identificacion,
      signerName: validacion?.signerName || null,
      certificateStatus: validacion?.certificateStatus || 'VIGENTE',
      signatureDate: validacion?.signatureDate || new Date().toISOString()
    },
    error: null
  });

  await upsertDocumentoIntegrado(cargoId, 'acuse', {
    estado: 'pendiente_tributacion',
    error: 'XML firmado correctamente. Enviando a Mini Tributación.'
  });

  const tributacion = await procesarFacturaTributacion(cargoId, null, config);
  return {
    ok: true,
    firmado: true,
    hashDocumento: firma?.hashDocumento || null,
    serialCertificado: firma?.serialCertificado || null,
    validacion,
    tributacion
  };
}

function raizTributacion(config) {
  return urlOpcional(config?.tributacion_url || DEFAULT_TRIBUTACION_API_URL, 'Tributación') || DEFAULT_TRIBUTACION_API_URL;
}

async function fetchTributacion(config, ruta, { method = 'GET', body = null, timeout = 30000 } = {}) {
  const root = raizTributacion(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${root}${ruta}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { mensaje: text } : null; }
    if (!response.ok) {
      const error = new Error(data?.mensaje || data?.message || data?.motivo || `Mini Tributación respondió HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.responseData = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Mini Tributación tardó demasiado en responder.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function tipoPersonaTributacion(tipo) {
  const limpio = String(tipo || '').trim().toUpperCase();
  if (['01', 'CEDULA_FISICA', 'FISICA', 'FÍSICA'].includes(limpio)) return 'Persona física';
  if (['02', 'CEDULA_JURIDICA', 'JURIDICA', 'JURÍDICA'].includes(limpio)) return 'Persona jurídica';
  if (['03', 'DIMEX'].includes(limpio)) return 'DIMEX';
  if (['04', 'NITE'].includes(limpio)) return 'NITE';
  return 'Persona jurídica';
}

async function consultarContribuyenteTributacion(config, identificacion) {
  const id = String(identificacion || '').trim();
  if (!id) return null;
  try {
    return await fetchTributacion(config, `/api/contribuyentes/${encodeURIComponent(id)}`, { timeout: 20000 });
  } catch (error) {
    if (Number(error?.statusCode) === 404) return null;
    throw error;
  }
}

async function validarFirmaDesdeTributacion(config, identificacion) {
  const id = String(identificacion || '').trim();
  if (!id) return { valido: false, mensaje: 'Falta la identificación del emisor.' };
  return fetchTributacion(config, '/api/contribuyentes/validar-firma-digital', {
    method: 'POST', body: { identificacion: id }, timeout: 30000
  });
}

export async function registrarContribuyenteTributacion() {
  await asegurarEsquemaIntegracion();
  const config = await obtenerConfigInterna();
  if (!config) throw new Error('Guarda primero los datos de integración.');

  const identificacion = String(config.numero_identificacion || '').trim();
  const nombre = String(config.institucion_nombre || '').trim();
  const correo = String(config.correo || '').trim().toLowerCase();
  if (!identificacion || !nombre || !correo || !config.tipo_identificacion) {
    throw new Error('Completa primero los Datos del emisor de EduControl.');
  }

  const requeridos = [
    ['provincia', config.tributacion_provincia],
    ['cantón', config.tributacion_canton],
    ['distrito', config.tributacion_distrito],
    ['teléfono', config.tributacion_telefono],
    ['actividad económica', config.tributacion_actividad_economica],
    ['descripción del servicio', config.tributacion_descripcion_servicio]
  ];
  const faltantes = requeridos.filter(([, valor]) => !String(valor || '').trim()).map(([nombreCampo]) => nombreCampo);
  if (faltantes.length) {
    throw new Error(`Completa los datos de Mini Tributación: ${faltantes.join(', ')}.`);
  }

  const firma = await validarFirmaDesdeTributacion(config, identificacion);
  if (firma?.valido !== true) {
    const error = new Error(firma?.mensaje || 'La escuela todavía no posee una firma digital válida.');
    error.statusCode = 400;
    error.code = 'FIRMA_DIGITAL_REQUERIDA';
    throw error;
  }

  const existente = await consultarContribuyenteTributacion(config, identificacion);
  if (existente) {
    if (String(existente.estado || '').toLowerCase() === 'desinscrito') {
      await fetchTributacion(config, `/api/contribuyentes/${encodeURIComponent(identificacion)}/reinscribir`, { method: 'PUT', timeout: 30000 });
    }
    await pool.query(`UPDATE configuracion_integracion_servicios SET tributacion_contribuyente_confirmado=TRUE WHERE id_configuracion=1`);
    return { ok: true, ya_registrado: true, contribuyente: existente, firma };
  }

  const tipoContribuyente = tipoPersonaTributacion(config.tipo_identificacion);
  const body = {
    identificacion,
    nombreCompleto: nombre,
    ...(tipoContribuyente === 'Persona jurídica' ? { razonSocial: nombre } : {}),
    tipo: tipoContribuyente,
    provincia: config.tributacion_provincia,
    canton: config.tributacion_canton,
    distrito: config.tributacion_distrito,
    otrasSenas: config.tributacion_otras_senas || '',
    correo,
    telefono: config.tributacion_telefono,
    actividadEconomica: config.tributacion_actividad_economica,
    descripcionServicio: config.tributacion_descripcion_servicio,
    sucursales: [],
    metodoFacturacion: 'Factura electrónica'
  };
  const respuesta = await fetchTributacion(config, '/api/contribuyentes', { method: 'POST', body, timeout: 45000 });
  await pool.query(`UPDATE configuracion_integracion_servicios SET tributacion_contribuyente_confirmado=TRUE WHERE id_configuracion=1`);
  return { ok: true, firma, ...respuesta };
}

async function construirPayloadTributacionDesdeCargo(idCargo) {
  const cargoId = Number(idCargo);
  const config = await obtenerConfigInterna();
  const [[cargo]] = await pool.query(
    `SELECT c.id_cargo, c.descripcion, c.monto_base, c.descuento, c.impuesto, c.total,
            ce.impuesto_tarifa,
            p.nombre, p.apellido1, p.apellido2,
            rp.nombre AS responsable_nombre, rp.tipo_identificacion AS responsable_tipo_id,
            rp.numero_identificacion AS responsable_numero_id, rp.correo AS responsable_correo,
            fc.id_factura_externa
       FROM cargo_estudiante c
       INNER JOIN estudiante e ON e.id_estudiante=c.id_estudiante
       INNER JOIN persona p ON p.id_persona=e.id_persona
       INNER JOIN concepto_cobro ce ON ce.id_concepto=c.id_concepto
       LEFT JOIN responsable_pago rp ON rp.id_estudiante=e.id_estudiante AND rp.principal=TRUE AND rp.estado=TRUE
       LEFT JOIN factura_cargo fc ON fc.id_cargo=c.id_cargo
      WHERE c.id_cargo=? LIMIT 1`,
    [cargoId]
  );
  if (!cargo) throw new Error('No se encontró el cargo para enviarlo a Mini Tributación.');

  const base = Math.max(0, numero(cargo.monto_base));
  const descuento = Math.max(0, Math.min(base, numero(cargo.descuento)));
  const tarifa = Math.max(0, numero(cargo.impuesto_tarifa));
  const impuestoBruto = Math.max(0, Math.round((base * tarifa / 100) * 100) / 100);
  const proporcionDescuento = base > 0 ? Math.min(1, descuento / base) : 0;
  const impuestoCubierto = Math.max(0, Math.round((impuestoBruto * proporcionDescuento) * 100) / 100);
  const descuentoTotal = Math.max(0, Math.round((descuento + impuestoCubierto) * 100) / 100);
  const total = Math.max(0, numero(cargo.total));
  const receptorNombre = String(cargo.responsable_nombre || [cargo.nombre, cargo.apellido1, cargo.apellido2].filter(Boolean).join(' ')).trim();
  const receptorCorreo = String(cargo.responsable_correo || config?.correo || '').trim().toLowerCase();
  const receptorNumero = String(cargo.responsable_numero_id || '').trim();

  return {
    facturaVisualId: String(cargo.id_factura_externa || `cargo-${cargoId}`).trim(),
    fecha: new Date().toISOString(),
    moneda: String(config?.moneda || 'CRC'),
    condicionVenta: String(config?.condicion_venta || '01'),
    medioPago: '99',
    emisor: {
      nombre: String(config?.institucion_nombre || '').trim(),
      identificacion: { tipo: String(config?.tipo_identificacion || '02'), numero: String(config?.numero_identificacion || '').trim() },
      correo: String(config?.correo || '').trim().toLowerCase()
    },
    receptor: {
      nombre: receptorNombre,
      identificacion: receptorNumero ? { tipo: String(cargo.responsable_tipo_id || '01'), numero: receptorNumero } : null,
      correo: receptorCorreo
    },
    items: [{ detalle: String(cargo.descripcion || 'Servicio educativo'), cantidad: 1, precioUnitario: base, montoTotalLinea: total }],
    totales: {
      totalGravado: tarifa > 0 ? base : 0,
      totalExento: tarifa > 0 ? 0 : base,
      totalDescuentos: descuentoTotal,
      totalImpuesto: impuestoBruto,
      totalComprobante: total
    }
  };
}

async function buscarFacturaTributacionPorIdExterno(config, identificacion, idExterno) {
  const lista = await fetchTributacion(config, `/api/facturas/contribuyente/${encodeURIComponent(identificacion)}`, { timeout: 30000 }).catch(() => []);
  const items = Array.isArray(lista) ? lista : [];
  return items.find((item) => String(item?.idExterno || item?.id || '').trim() === String(idExterno || '').trim()) || null;
}

async function guardarResultadoTributacion(idCargo, respuesta, estadoForzado = null) {
  const estadoRemoto = String(estadoForzado || respuesta?.estado || '').trim().toLowerCase();
  const aceptada = estadoRemoto === 'aceptada' || estadoRemoto === 'aceptado' || Boolean(respuesta?.numeroAcuse);
  const numeroAcuse = respuesta?.numeroAcuse ?? respuesta?.numero_acuse ?? respuesta?.factura?.numeroAcuse ?? null;
  const motivo = respuesta?.motivo || respuesta?.mensaje || respuesta?.acuseRecibido || null;
  await upsertDocumentoIntegrado(idCargo, 'acuse', {
    estado: aceptada ? 'disponible' : 'rechazado',
    identificador: numeroAcuse != null ? String(numeroAcuse) : (respuesta?.factura?.id != null ? String(respuesta.factura.id) : null),
    mimeType: 'application/json',
    contenido: Buffer.from(JSON.stringify(respuesta || {}, null, 2), 'utf8').toString('base64'),
    respuesta: respuesta || {},
    error: aceptada ? null : (motivo || 'Mini Tributación rechazó la factura.')
  });
  return { ok: aceptada, estado: aceptada ? 'disponible' : 'rechazado', numeroAcuse, respuesta };
}

export async function procesarFacturaTributacion(idCargo, payloadBase = null, configEntrada = null) {
  const cargoId = Number(idCargo);
  const config = configEntrada || await obtenerConfigInterna();
  if (!config?.tributacion_url) {
    await upsertDocumentoIntegrado(cargoId, 'acuse', { estado: 'pendiente_endpoint', error: 'Falta configurar Mini Tributación.' });
    return { ok: false, estado: 'pendiente_endpoint' };
  }

  const payload = payloadBase || await construirPayloadTributacionDesdeCargo(cargoId);
  const identificacion = String(payload?.emisor?.identificacion?.numero || config?.numero_identificacion || '').trim();
  const idExterno = String(payload?.facturaVisualId || payload?.idFacturaVisual || '').trim() || `EDUCONTROL-${cargoId}`;
  if (!identificacion) throw new Error('Falta la identificación fiscal de EduControl para Mini Tributación.');

  let xmlBuffer = null;
  const [[xmlRow]] = await pool.query(`SELECT contenido, mime_type FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' LIMIT 1`, [cargoId]);
  if (xmlRow?.contenido) xmlBuffer = Buffer.from(String(xmlRow.contenido), 'base64');
  if (!xmlBuffer?.length) {
    try { xmlBuffer = (await obtenerDocumentoElectronicoFacturaSmart(cargoId, 'xml')).buffer; } catch {}
  }
  if (!xmlBuffer?.length) {
    await upsertDocumentoIntegrado(cargoId, 'acuse', { estado: 'pendiente_xml', error: 'Mini Tributación espera el XML; la factura electrónica todavía no está disponible.' });
    return { ok: false, estado: 'pendiente_xml' };
  }

  if (!xmlTieneFirmaDigital(xmlBuffer.toString('utf8'))) {
    await upsertDocumentoIntegrado(cargoId, 'acuse', { estado: 'pendiente_firma', error: 'El XML ya está disponible, pero todavía debe firmarse digitalmente antes de enviarlo a Mini Tributación.' });
    return { ok: false, estado: 'pendiente_firma' };
  }

  const firma = await validarFirmaDesdeTributacion(config, identificacion).catch((error) => ({ valido: false, mensaje: error?.message || 'No se pudo validar la firma digital.' }));
  if (firma?.valido !== true) {
    const rechazo = {
      mensaje: 'Factura electrónica rechazada.', estado: 'Rechazada',
      motivo: firma?.mensaje || 'La firma digital del emisor no es válida.',
      codigo: 'FIRMA_DIGITAL_INVALIDA', firma
    };
    await guardarResultadoTributacion(cargoId, rechazo, 'Rechazada');
    return { ok: false, estado: 'rechazado_firma', respuesta: rechazo };
  }

  const contribuyente = await consultarContribuyenteTributacion(config, identificacion).catch(() => null);
  if (!contribuyente) {
    const rechazo = {
      mensaje: 'Factura electrónica rechazada.', estado: 'Rechazada',
      motivo: 'EduControl todavía no está registrado como contribuyente en Mini Tributación.',
      codigo: 'CONTRIBUYENTE_NO_REGISTRADO'
    };
    await guardarResultadoTributacion(cargoId, rechazo, 'Rechazada');
    return { ok: false, estado: 'pendiente_registro_tributacion', respuesta: rechazo };
  }

  const existente = await buscarFacturaTributacionPorIdExterno(config, identificacion, idExterno).catch(() => null);
  if (existente?.id != null) {
    if (String(existente.estado || '').toLowerCase() === 'aceptada') {
      return guardarResultadoTributacion(cargoId, existente, 'Aceptada');
    }
    try {
      const revalidada = await fetchTributacion(config, `/api/facturas/${encodeURIComponent(existente.id)}/revalidar`, { method: 'POST', timeout: 45000 });
      return guardarResultadoTributacion(cargoId, revalidada);
    } catch (error) {
      const data = error?.responseData || { mensaje: error?.message, estado: 'Rechazada', motivo: error?.message };
      return guardarResultadoTributacion(cargoId, data, 'Rechazada');
    }
  }

  const body = {
    id: idExterno,
    fecha: payload?.fecha || new Date().toISOString(),
    moneda: String(payload?.moneda || 'CRC'),
    condicionVenta: String(payload?.condicionVenta || '01'),
    medioPago: String(payload?.medioPago || '99'),
    tipoDocumento: 'Factura electrónica',
    emisor: {
      nombre: payload?.emisor?.nombre,
      identificacion: { tipo: tipoIdentificacionFacturaSmart(payload?.emisor?.identificacion?.tipo), numero: identificacion },
      correo: payload?.emisor?.correo
    },
    receptor: {
      nombre: payload?.receptor?.nombre || 'Cliente EduControl',
      identificacion: payload?.receptor?.identificacion ? {
        tipo: tipoIdentificacionFacturaSmart(payload.receptor.identificacion.tipo),
        numero: String(payload.receptor.identificacion.numero || '').trim()
      } : { tipo: 'CEDULA_FISICA', numero: '000000000' },
      correo: payload?.receptor?.correo || config?.correo
    },
    items: (Array.isArray(payload?.items) ? payload.items : []).map((item) => ({
      detalle: String(item?.detalle || 'Servicio educativo'),
      cantidad: Math.max(1, numero(item?.cantidad) || 1),
      precioUnitario: Math.max(0, numero(item?.precioUnitario)),
      montoTotalLinea: Math.max(0, numero(item?.montoTotalLinea))
    })),
    totales: {
      totalGravado: Math.max(0, numero(payload?.totales?.totalGravado)),
      totalExento: Math.max(0, numero(payload?.totales?.totalExento)),
      totalDescuentos: Math.max(0, numero(payload?.totales?.totalDescuentos)),
      totalImpuesto: Math.max(0, numero(payload?.totales?.totalImpuesto)),
      totalComprobante: Math.max(0, numero(payload?.totales?.totalComprobante))
    },
    archivoXML: xmlBuffer.toString('utf8')
  };

  try {
    const respuesta = await fetchTributacion(config, '/api/facturas', { method: 'POST', body, timeout: 60000 });
    return guardarResultadoTributacion(cargoId, respuesta);
  } catch (error) {
    if (Number(error?.statusCode) === 409) {
      const encontrada = await buscarFacturaTributacionPorIdExterno(config, identificacion, idExterno).catch(() => null);
      if (encontrada?.id != null) {
        try {
          const revalidada = await fetchTributacion(config, `/api/facturas/${encodeURIComponent(encontrada.id)}/revalidar`, { method: 'POST', timeout: 45000 });
          return guardarResultadoTributacion(cargoId, revalidada);
        } catch {}
      }
    }
    const data = error?.responseData || { mensaje: 'Factura electrónica rechazada.', estado: 'Rechazada', motivo: error?.message || 'Mini Tributación rechazó la factura.' };
    await guardarResultadoTributacion(cargoId, data, 'Rechazada');
    return { ok: false, estado: 'rechazado', respuesta: data };
  }
}

export async function obtenerAcuseTributacion(idCargo) {
  const cargoId = Number(idCargo);
  await procesarFacturaTributacion(cargoId).catch(() => null);
  const [[row]] = await pool.query(`SELECT estado, identificador_externo, contenido, respuesta_json, error_mensaje FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='acuse' LIMIT 1`, [cargoId]);
  if (!row) throw new Error('El acuse todavía no está disponible.');
  let data = null;
  if (row.respuesta_json) {
    try { data = typeof row.respuesta_json === 'string' ? JSON.parse(row.respuesta_json) : row.respuesta_json; } catch {}
  }
  if (!data && row.contenido) {
    try { data = JSON.parse(Buffer.from(String(row.contenido), 'base64').toString('utf8')); } catch {}
  }
  data ||= { estado: row.estado, numeroAcuse: row.identificador_externo || null, motivo: row.error_mensaje || null };
  return {
    buffer: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    contentType: 'application/json; charset=utf-8',
    filename: `acuse-tributacion-cargo-${cargoId}.json`,
    estado: row.estado
  };
}

async function probarMiniTributacion(config) {
  const url = raizTributacion(config);
  try {
    const health = await fetchTributacion(config, '/api/health', { timeout: 15000 });
    const identificacion = String(config?.numero_identificacion || '').trim();
    let contribuyente = null;
    let firma = null;
    if (identificacion) {
      [contribuyente, firma] = await Promise.all([
        consultarContribuyenteTributacion(config, identificacion).catch(() => null),
        validarFirmaDesdeTributacion(config, identificacion).catch(() => null)
      ]);
    }
    const registrado = Boolean(contribuyente && String(contribuyente.estado || '').toLowerCase() !== 'desinscrito');
    const firmaValida = firma?.valido === true;
    return {
      configurado: true,
      disponible: true,
      estado: registrado && firmaValida ? 'vinculado' : (firmaValida ? 'pendiente_registro' : 'pendiente_firma'),
      url,
      portal_url: DEFAULT_TRIBUTACION_PORTAL_URL,
      contribuyente_registrado: registrado,
      firma_valida: firmaValida,
      health,
      detalle: registrado && firmaValida
        ? 'EduControl está registrado en Mini Tributación y la firma digital es válida.'
        : firmaValida
          ? 'Mini Tributación responde y la firma es válida. Falta registrar a EduControl como contribuyente.'
          : 'Mini Tributación responde, pero EduControl aún no tiene una firma digital válida; el registro fiscal será rechazado hasta contar con ella.'
    };
  } catch (error) {
    return {
      configurado: true, disponible: false, estado: 'error', url,
      portal_url: DEFAULT_TRIBUTACION_PORTAL_URL,
      detalle: error?.message || 'No fue posible conectar con Mini Tributación.'
    };
  }
}

async function verificarFacturaRemota(idFactura) {
  const id = String(idFactura || "").trim();
  if (!id) return false;

  const root = obtenerRaizFacturacion();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${root}/api/facturas/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (response.status === 404) return false;
    if (!response.ok) return null;
    return true;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function buscarFacturaRemotaPorCargo(idCargo) {
  const root = obtenerRaizFacturacion();
  const referencia = `cargo:${Number(idCargo)}`;
  try {
    const data = await consumirServicio(
      `${root}/api/facturas?origen=educontrol&referenciaExterna=${encodeURIComponent(referencia)}&limit=1`,
      { method: "GET", timeout: 8000, retry429: 0 }
    );
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    return items[0]?.id ? items[0] : null;
  } catch {
    return null;
  }
}

export async function generarFacturaDeCargo(idCargo, metodoPago = "otro") {
  let apiRoot = obtenerRaizFacturacion();
  let apiUrl = `${apiRoot}/api/facturas`;

  const [cargoRows] = await pool.query(
    `SELECT
       c.id_cargo, c.descripcion, c.monto_base, c.descuento, c.impuesto, c.total, c.saldo, c.estado,
       COALESCE((SELECT SUM(pg.monto) FROM pago pg WHERE pg.id_cargo = c.id_cargo AND pg.estado = 'aplicado'), 0) AS total_pagado,
       (SELECT pg2.metodo_pago FROM pago pg2 WHERE pg2.id_cargo = c.id_cargo AND pg2.estado = 'aplicado' ORDER BY pg2.fecha_pago DESC, pg2.id_pago DESC LIMIT 1) AS ultimo_metodo_pago,
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

  const totalCargo = Number(cargo.total || 0);
  const totalPagadoValidacion = Number(cargo.total_pagado || 0);
  const baseCargo = Math.max(0, Number(cargo.monto_base || 0));
  const descuentoCargo = Math.max(0, Number(cargo.descuento || 0));
  const bonificacionTotalCierre =
    baseCargo > 0 &&
    descuentoCargo + 0.001 >= baseCargo &&
    totalCargo <= 0.001 &&
    Number(cargo.saldo || 0) <= 0.001 &&
    String(cargo.estado || "").toLowerCase() === "pagado";

  // Un cargo exonerado al 100% no tiene un pago monetario y, por tanto, no
  // debe depender de SUM(pago). Es un cierre financiero válido por descuento.
  const cargoPagado =
    String(cargo.estado || "").toLowerCase() === "pagado" &&
    Number(cargo.saldo || 0) <= 0.001 &&
    (bonificacionTotalCierre || totalPagadoValidacion + 0.001 >= totalCargo);

  if (!cargoPagado) {
    return {
      ok: false,
      estado: "pendiente_pago",
      mensaje: "La factura se genera cuando el cargo queda completamente pagado."
    };
  }

  const [existente] = await pool.query(
    `SELECT * FROM factura_cargo WHERE id_cargo = ? LIMIT 1`,
    [idCargo]
  );

  if (existente.length && existente[0].id_factura_externa) {
    const estadoRemoto = await verificarFacturaRemota(existente[0].id_factura_externa);

    if (estadoRemoto !== false) {
      const configExistente = await obtenerConfigInterna().catch(() => null);
      const rootExistente = configExistente ? raizFacturaBonita(configExistente) : obtenerRaizFacturacion();
      await registrarDocumentosIntegracionInicial(idCargo, existente[0].id_factura_externa, rootExistente, configExistente).catch(() => {});
      const [[docElectronico]] = await pool.query(
        `SELECT estado FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo='factura_electronica' LIMIT 1`,
        [Number(idCargo)]
      );
      const requiereElectronica = Boolean(
        configExistente?.factura_electronica_url &&
        configExistente?.factura_electronica_password &&
        String(docElectronico?.estado || '') !== 'disponible'
      );
      if (!requiereElectronica) {
        return {
          ok: true,
          estado: existente[0].estado_factura,
          id_factura: existente[0].id_factura_externa,
          mensaje: estadoRemoto === true
            ? "El cargo ya fue facturado."
            : "La factura ya está registrada localmente; se conserva mientras el servicio remoto vuelve a responder."
        };
      }
      // Si la factura visual ya existe pero la electrónica quedó pendiente,
      // continuamos. Factura Bonita es idempotente por cargo y devolverá la misma
      // factura visual; después se procesa FacturaSmart sin duplicar el comprobante.
    }

    if (estadoRemoto === false) {
      // La base de EduControl conserva el identificador, pero la factura ya no existe
      // en Factura Bonita (por ejemplo, después de reiniciar/restaurar su base).
      // Se limpia únicamente el vínculo externo para volver a crearla de forma segura.
      await pool.query(
        `UPDATE factura_cargo SET id_factura_externa = NULL, estado_factura = 'pendiente_recrear', url_documento = NULL, error_mensaje = 'La factura remota dejó de existir; se conservará el historial local y se recreará de forma idempotente.', fecha_actualizacion = NOW() WHERE id_cargo = ?`,
        [idCargo]
      );
      cacheDocumentosFactura.clear();
    }
  }

  // Factura Bonita ya garantiza idempotencia con origen + referenciaExterna.
  // Evitamos un GET previo a cada creación: reduce llamadas, elimina carreras
  // y permite que el pago final genere el comprobante inmediatamente.

  let configGuardada = null;
  try {
    configGuardada = await obtenerConfigInterna();
  } catch (error) {
    console.warn("Facturación: no se pudo leer configuracion_facturacion; se usarán valores de respaldo.", error?.message);
  }

  const config = {
    institucion_nombre:
      configGuardada?.institucion_nombre ||
      process.env.FACTURACION_EMISOR_NOMBRE ||
      "",
    tipo_identificacion:
      configGuardada?.tipo_identificacion ||
      process.env.FACTURACION_EMISOR_TIPO_ID ||
      "",
    numero_identificacion:
      configGuardada?.numero_identificacion ||
      process.env.FACTURACION_EMISOR_NUMERO_ID ||
      "",
    correo:
      configGuardada?.correo ||
      process.env.FACTURACION_EMISOR_CORREO ||
      "",
    logo_data: configGuardada?.logo_data || null,
    moneda: configGuardada?.moneda || "CRC",
    condicion_venta: configGuardada?.condicion_venta || "01"
  };

  if (!config.institucion_nombre || !config.tipo_identificacion || !config.numero_identificacion || !config.correo) {
    throw new Error('Completa y guarda los Datos del emisor antes de generar comprobantes. La base nueva no trae datos fiscales precargados.');
  }

  apiRoot = raizFacturaBonita(configGuardada);
  apiUrl = `${apiRoot}/api/facturas`;
  const integrationApiKey = apiKeyFacturaBonita(configGuardada);

  // Para una exoneración del 100% igualmente se emite un comprobante y se
  // requieren los datos reales de la persona responsable. No usamos datos
  // ficticios/fallback en ese caso porque debe quedar trazabilidad de quién
  // recibió el beneficio. Para cargos pagados de forma convencional se conserva
  // la compatibilidad con registros históricos.
  const receptorNombre = String(
    cargo.responsable_nombre ||
    (bonificacionTotalCierre ? "" : [cargo.nombre, cargo.apellido1, cargo.apellido2].filter(Boolean).join(" "))
  ).trim();
  const receptorCorreo = String(
    cargo.responsable_correo ||
    (bonificacionTotalCierre ? "" : (process.env.FACTURACION_RECEPTOR_CORREO_FALLBACK || config.correo))
  ).trim().toLowerCase();
  const receptorNumeroId = String(cargo.responsable_numero_id || "").trim();

  if (!receptorNombre || !receptorCorreo || (bonificacionTotalCierre && !receptorNumeroId)) {
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
      mensaje: bonificacionTotalCierre
        ? "Completa nombre, correo e identificación del responsable para emitir el comprobante de exoneración."
        : "No fue posible determinar el receptor de la factura."
    };
  }

  const totalPagado = numero(cargo.total_pagado);
  const totalRegistrado = numero(cargo.total);
  const baseRegistrada = numero(cargo.monto_base);
  const descuentoRegistrado = Math.max(0, numero(cargo.descuento));
  const bonificacionTotal = bonificacionTotalCierre;

  // Un descuento del 100% es un cierre financiero válido. El comprobante visual
  // debe conservar la base y el descuento aunque el total a cobrar sea CRC 0.
  const total = totalRegistrado > 0 ? totalRegistrado : (bonificacionTotal ? 0 : totalPagado);
  if (total <= 0 && !bonificacionTotal) {
    return {
      ok: false,
      estado: 'pendiente_monto',
      mensaje: 'El cargo no tiene un monto facturable. Corrige el cargo antes de generar el PDF.'
    };
  }

  // Compatibilidad con cargos históricos: si el total original quedó en 0
  // pero existen pagos aplicados, se utiliza el monto efectivamente pagado.
  const base = baseRegistrada > 0 ? baseRegistrada : total;
  const descuento = Math.min(descuentoRegistrado, base);
  const tarifa = Math.max(0, numero(cargo.impuesto_tarifa));
  const impuestoBruto = Math.max(0, Math.round((base * tarifa / 100) * 100) / 100);
  const proporcionDescuento = base > 0 ? Math.min(1, descuento / base) : 0;
  const impuestoCubierto = Math.max(0, Math.round((impuestoBruto * proporcionDescuento) * 100) / 100);
  const descuentoTotal = Math.max(0, Math.round((descuento + impuestoCubierto) * 100) / 100);
  const subtotal = Math.max(0, Math.round((base - descuento) * 100) / 100);
  const impuesto = impuestoBruto;
  const totalVentaNeta = Math.max(0, Math.round((base - descuentoTotal) * 100) / 100);

  const payload = {
    origen: "educontrol",
    referenciaExterna: `cargo:${idCargo}`,
    fecha: new Date().toISOString(),
    moneda: config.moneda || "CRC",
    condicionVenta: config.condicion_venta || "01",
    medioPago: bonificacionTotal ? "99" : (METODOS_FACTURA[String((metodoPago && metodoPago !== 'otro') ? metodoPago : (cargo.ultimo_metodo_pago || 'otro')).toLowerCase()] || "99"),
    estadoPago: "PAGADO",
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
      identificacion: receptorNumeroId
        ? {
            tipo: cargo.responsable_tipo_id || "01",
            numero: receptorNumeroId
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
        // El descuento comercial se captura sobre la matrícula base. Cuando hay
        // IVA, el mismo porcentaje de beneficio cubre también esa proporción del
        // impuesto. Factura Bonita recibe ambos datos para que el IVA quede
        // visible incluso si el total final es CRC 0.
        descuento,
        impuesto: { tarifa, monto: impuestoBruto },
        impuestoAsumidoEmisor: impuestoCubierto,
        baseImponible: base,
        subtotal,
        montoTotalLinea: total
      }
    ],
    totales: {
      totalServiciosGravados: tarifa > 0 ? base : 0,
      totalServiciosExentos: tarifa > 0 ? 0 : base,
      totalGravado: tarifa > 0 ? base : 0,
      totalExento: tarifa > 0 ? 0 : base,
      totalVenta: base,
      totalDescuentos: descuentoTotal,
      totalVentaNeta,
      totalImpuesto: impuesto,
      totalIVADevuelto: 0,
      totalOtrosCargos: 0,
      totalComprobante: total
    }
  };

  try {
    const headersFactura = integrationApiKey ? { "X-Api-Key": integrationApiKey } : {};

    // El PDF visual se crea primero y no espera a FacturaSmart. El XML se
    // sincroniza después en segundo plano para que el botón Pagar responda en
    // cuanto el banco y EduControl confirman el cobro.
    const respuesta = await consumirServicio(apiUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: headersFactura,
      timeout: Number(process.env.FACTURACION_TIMEOUT_MS || 60000),
      retry429: 3
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
    await registrarDocumentosIntegracionInicial(idCargo, respuesta.id, apiRoot, configGuardada);

    // La factura electrónica se procesa en segundo plano. De esta manera un
    // servicio externo lento o en despliegue no mantiene el botón Pagar en
    // "Procesando..." después de que el cobro ya fue aprobado.
    void (async () => {
      let facturaElectronica = null;

      // PRIMER CAMINO: EduControl -> FacturaSmart directamente. Este es el flujo
      // más corto y evita que un error 502 del puente de Factura Bonita impida
      // generar el XML.
      if (configGuardada?.factura_electronica_url && configGuardada?.factura_electronica_correo && configGuardada?.factura_electronica_password) {
        try {
          facturaElectronica = await procesarFacturaElectronicaFacturaSmart(
            idCargo,
            { ...payload, facturaVisualId: respuesta.id },
            configGuardada
          );
        } catch (errorDirecto) {
          console.error(`FacturaSmart directo (cargo ${idCargo}):`, errorDirecto?.message || errorDirecto);
        }
      }

      // RESPALDO: api-factura puede seguir sincronizando si el camino directo no
      // pudo completar el XML. Un 502 aquí ya no bloquea el flujo principal.
      if (!facturaElectronica?.ok) {
        try {
          let passwordFacturaSmart = '';
          try { passwordFacturaSmart = configGuardada?.factura_electronica_password ? descifrarSecreto(configGuardada.factura_electronica_password) : ''; } catch {}
          if (configGuardada?.factura_electronica_url && configGuardada?.factura_electronica_correo && passwordFacturaSmart) {
            const bodySync = {
              baseUrl: raizFacturaSmart(configGuardada),
              correo: String(configGuardada.factura_electronica_correo).trim().toLowerCase(),
              password: passwordFacturaSmart
            };
            try {
              const tokenFacturaSmart = await loginFacturaSmart(configGuardada, { force: true });
              if (tokenFacturaSmart) bodySync.accessToken = tokenFacturaSmart;
            } catch {}

            const sync = await consumirServicio(
              `${apiRoot}/api/facturas/${encodeURIComponent(respuesta.id)}/electronica/sincronizar`,
              {
                method: 'POST',
                body: JSON.stringify(bodySync),
                headers: integrationApiKey ? { 'X-Api-Key': integrationApiKey } : {},
                timeout: Number(process.env.FACTURACION_ELECTRONICA_TIMEOUT_MS || 45000),
                retry429: 1
              }
            );
            facturaElectronica = await registrarElectronicaRecibidaDesdeFacturaBonita(idCargo, {
              ok: Boolean(sync?.ok),
              id: sync?.facturaSmartId || sync?.id,
              xmlBase64: sync?.xmlBase64,
              mimeType: sync?.mimeType,
              estado: sync?.estado,
              mensaje: sync?.mensaje
            }, configGuardada).catch(() => null);
          }
        } catch (errorSync) {
          console.warn(`FacturaSmart vía api-factura (cargo ${idCargo}):`, errorSync?.message || errorSync);
        }
      }
    })();

    return {
      ok: true,
      estado: "generada",
      id_factura: respuesta.id,
      factura: respuesta,
      factura_electronica: {
        ok: false,
        estado: configGuardada?.factura_electronica_cuenta_confirmada ? 'procesando' : 'pendiente_credenciales',
        mensaje: configGuardada?.factura_electronica_cuenta_confirmada
          ? 'El XML se está sincronizando en segundo plano.'
          : 'FacturaSmart está pendiente de vincular.'
      },
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
        estado: "capacidad_temporal",
        mensaje: "El servicio de facturación alcanzó temporalmente su capacidad. Inténtalo nuevamente en unos segundos.",
        servicio: apiRoot
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

async function probarServicioHttp(baseUrl, ruta = '/health') {
  if (!baseUrl) {
    return {
      configurado: false,
      disponible: false,
      estado: "no_configurado",
      detalle: "No hay URL configurada."
    };
  }

  const timeoutConfigurado = Number(process.env.FACTURACION_HEALTH_TIMEOUT_MS || 10000);
  const timeoutMs = Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5000
    ? timeoutConfigurado
    : 10000;

  try {
    const { response, data } = await solicitarEstado(baseUrl, ruta, timeoutMs);

    if (response.ok || response.status === 429) {
      const detalle = response.status === 429
        ? "Factura Bonita está disponible, pero aplicó límite temporal de solicitudes."
        : (typeof data === "object" && data !== null
          ? (data.detalle || data.status || data.mensaje || data.id || "Respuesta correcta")
          : "Respuesta correcta");

      const estadoRemoto = typeof data === 'object' && data !== null
        ? String(data.status || '').toLowerCase()
        : '';

      return {
        configurado: true,
        disponible: true,
        estado: response.status === 429
          ? "limitado"
          : (estadoRemoto === 'degraded' ? 'degradado' : 'disponible'),
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
  const config = await obtenerConfigInterna().catch(() => null);
  const facturacionRoot = raizFacturaBonita(config);
  const documentosRoot = facturacionRoot;

  const [facturacion, documentos] = await Promise.all([
    probarServicioHttp(facturacionRoot, '/health'),
    probarServicioHttp(documentosRoot, '/health/documentos')
  ]);

  const bancoUrl = config?.banco_checkout_url || DEFAULT_BANK_CHECKOUT_URL;
  let banco;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(bancoUrl, { method: 'GET', redirect: 'manual', signal: controller.signal });
    clearTimeout(timer);
    banco = {
      configurado: true,
      disponible: response.status >= 200 && response.status < 500,
      estado: response.status >= 200 && response.status < 500 ? 'disponible' : 'error',
      http_status: response.status,
      url: bancoUrl,
      afiliado: Boolean(config?.banco_afiliado),
      merchant_configurado: Boolean(config?.banco_merchant_id),
      listo_cobro: Boolean(config?.banco_afiliado && config?.banco_merchant_id && response.status >= 200 && response.status < 500),
      login_url: config?.banco_login_url || DEFAULT_BANK_LOGIN_URL,
      registro_url: config?.banco_registro_url || DEFAULT_BANK_REGISTER_URL,
      detalle: config?.banco_afiliado
        ? 'Servicio de pago afiliado y disponible para EduControl.'
        : 'El endpoint de pago está disponible. Falta completar la afiliación del negocio.'
    };
  } catch (error) {
    banco = {
      configurado: true, disponible: false, estado: error?.name === 'AbortError' ? 'timeout' : 'error',
      url: bancoUrl, afiliado: Boolean(config?.banco_afiliado),
      merchant_configurado: Boolean(config?.banco_merchant_id),
      listo_cobro: false,
      login_url: config?.banco_login_url || DEFAULT_BANK_LOGIN_URL,
      registro_url: config?.banco_registro_url || DEFAULT_BANK_REGISTER_URL,
      detalle: 'No fue posible comprobar el servicio de pago en este momento.'
    };
  }

  const pendiente = (url, nombre) => ({
    configurado: Boolean(url),
    disponible: false,
    estado: url ? 'configurado_sin_contrato' : 'pendiente_endpoint',
    url: url || null,
    detalle: url
      ? `${nombre} tiene una URL guardada, pero todavía falta confirmar el contrato JSON antes de activarlo.`
      : `Pendiente de recibir el endpoint de ${nombre}.`
  });

  const [tributacion, firmaDigital] = await Promise.all([
    probarMiniTributacion(config),
    probarFirmaDigital(config)
  ]);

  return {
    facturacion: {
      ...facturacion,
      url: facturacionRoot,
      cuenta_vinculada: Boolean(config?.factura_bonita_api_key),
      detalle: config?.factura_bonita_api_key
        ? (facturacion.detalle || 'Factura Bonita disponible y cuenta vinculada.')
        : 'Factura Bonita responde, pero EduControl todavía no tiene guardada la clave de integración de su cuenta.'
    },
    documentos: { ...documentos, url: documentosRoot },
    banco,
    firma_digital: firmaDigital,
    factura_electronica: {
      configurado: true,
      disponible: Boolean(config?.factura_electronica_cuenta_confirmada && config?.factura_electronica_password),
      estado: config?.factura_electronica_cuenta_confirmada ? 'vinculado' : 'pendiente_cuenta',
      url: raizFacturaSmart(config),
      cuenta_vinculada: Boolean(config?.factura_electronica_cuenta_confirmada),
      detalle: config?.factura_electronica_cuenta_confirmada
        ? 'FacturaSmart está vinculado y EduControl recibe el XML para enviarlo a Mini Tributación.'
        : 'Crea o inicia sesión en el portal oficial de FacturaSmart y después vincula esa misma cuenta en EduControl.'
    },
    tributacion,
    flujo: {
      listo_actual: Boolean(facturacion.disponible && config?.factura_bonita_api_key && banco.listo_cobro),
      listo_completo: Boolean(
        facturacion.disponible && config?.factura_bonita_api_key &&
        banco.listo_cobro &&
        config?.factura_electronica_url && config?.factura_electronica_cuenta_confirmada &&
        firmaDigital?.certificado_vigente && tributacion?.contribuyente_registrado && tributacion?.firma_valida
      )
    }
  };
}

export async function reconciliarFacturasEduControl() {
  const apiRoot = obtenerRaizFacturacion();
  if (!apiRoot) return { conciliadas: 0 };

  const data = await consumirServicio(
    `${apiRoot}/api/facturas?origen=educontrol&limit=200`,
    { method: "GET", timeout: 8000, retry429: 0 }
  );

  const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  let conciliadas = 0;

  for (const factura of items) {
    const referencia = String(factura?.referenciaExterna || factura?.referencia_externa || "").trim();
    const match = /^cargo:(\d+)$/i.exec(referencia);
    const idFactura = String(factura?.id || "").trim();
    if (!match || !idFactura) continue;

    const idCargo = Number(match[1]);
    if (!Number.isInteger(idCargo) || idCargo <= 0) continue;

    const [[cargo]] = await pool.query(
      `SELECT id_cargo, estado, saldo FROM cargo_estudiante WHERE id_cargo = ? LIMIT 1`,
      [idCargo]
    );
    if (!cargo || (String(cargo.estado).toLowerCase() !== "pagado" && Number(cargo.saldo || 0) > 0)) continue;

    await registrarEstadoFactura(idCargo, idFactura, "generada", factura, null);
    conciliadas += 1;
  }

  return { conciliadas };
}

const cacheDocumentosFactura = new Map();
const documentosFacturaEnCurso = new Map();
const DOCUMENTO_CACHE_TTL_MS = 10 * 60 * 1000;

function leerDocumentoCache(clave) {
  const entrada = cacheDocumentosFactura.get(clave);
  if (!entrada) return null;
  if (Date.now() - entrada.creadoEn > DOCUMENTO_CACHE_TTL_MS) {
    cacheDocumentosFactura.delete(clave);
    return null;
  }
  return entrada.documento;
}

function guardarDocumentoCache(clave, documento) {
  cacheDocumentosFactura.set(clave, { creadoEn: Date.now(), documento });
  if (cacheDocumentosFactura.size > 40) {
    const primera = cacheDocumentosFactura.keys().next().value;
    if (primera) cacheDocumentosFactura.delete(primera);
  }
}

function esperaTransitoria(response, intento) {
  const retryAfterHeader = String(response.headers.get("retry-after") || "").trim();
  const segundos = Number(retryAfterHeader);
  if (Number.isFinite(segundos) && segundos > 0) {
    return Math.min(Math.max(segundos * 1000, 1500), 30000);
  }

  const fecha = Date.parse(retryAfterHeader);
  if (Number.isFinite(fecha)) {
    return Math.min(Math.max(fecha - Date.now(), 1500), 30000);
  }

  return [3000, 8000, 15000][Math.min(intento, 2)];
}

async function descargarDocumentoFactura(url, formatoNormalizado, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let ultimoResponse = null;

    for (let intento = 0; intento < 2; intento += 1) {
      const response = await fetch(url, {
        headers: {
          Accept: formatoNormalizado === "pdf" ? "application/pdf" : "text/html"
        },
        signal: controller.signal
      });

      ultimoResponse = response;
      if (![429, 503].includes(response.status)) break;

      if (intento < 1) {
        const esperaMs = esperaTransitoria(response, intento);
        console.warn(`Facturación: servicio de documentos respondió ${response.status}. Reintento ${intento + 1}/1 en ${esperaMs} ms.`);
        try { await response.arrayBuffer(); } catch {}
        await esperar(esperaMs);
      }
    }

    const response = ultimoResponse;
    if (!response) throw new Error("El servicio de documentos no respondió.");

    if (!response.ok) {
      const texto = await response.text().catch(() => "");
      let mensaje = [429, 503].includes(response.status)
        ? "El servicio de facturación alcanzó temporalmente su capacidad. Espera unos segundos e inténtalo nuevamente."
        : "No se pudo generar el documento de la factura.";

      if (texto) {
        try {
          const json = JSON.parse(texto);
          const detalle = json?.detalle || json?.error || json?.mensaje;
          if (detalle && ![429, 503].includes(response.status)) mensaje = detalle;
        } catch {
          if (![429, 503].includes(response.status)) mensaje = texto.slice(0, 220) || mensaje;
        }
      }
      throw new Error(mensaje);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("Factura Bonita devolvió un documento vacío.");

    return {
      buffer,
      contentType: response.headers.get("content-type") || (
        formatoNormalizado === "pdf"
          ? "application/pdf"
          : "text/html; charset=utf-8"
      )
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

export async function obtenerDocumentoDeCargo(idCargo, formato = "pdf") {
  const formatoNormalizado = String(formato || "pdf").toLowerCase() === "html" ? "html" : "pdf";

  const cargarVinculo = async () => {
    const [rows] = await pool.query(
      `SELECT fc.id_factura_externa, fc.estado_factura, c.estado AS estado_cargo
       FROM factura_cargo fc
       INNER JOIN cargo_estudiante c ON c.id_cargo = fc.id_cargo
       WHERE fc.id_cargo = ?
       LIMIT 1`,
      [idCargo]
    );
    return rows[0] || null;
  };

  let vinculo = await cargarVinculo();

  if (!vinculo?.id_factura_externa) {
    const generada = await generarFacturaDeCargo(idCargo, "otro");
    if (!generada?.ok || !generada?.id_factura) {
      throw new Error(generada?.mensaje || "Primero genera la factura de este cargo.");
    }
    vinculo = await cargarVinculo();
  }

  const descargar = async (idFactura) => {
    const root = obtenerRaizDocumentos();
    if (!root) throw new Error("El servicio de documentos no está configurado.");

    const clave = `${idFactura}:${formatoNormalizado}`;
    const cache = leerDocumentoCache(clave);
    if (cache) return cache;

    if (documentosFacturaEnCurso.has(clave)) return documentosFacturaEnCurso.get(clave);

    const tarea = (async () => {
      await sincronizarLogoFacturaRemota(idFactura);
      const baseDocumento = `${root}/api/documentos/facturas/${encodeURIComponent(idFactura)}`;
      const timeoutConfigurado = Number(process.env.DOCUMENTOS_TIMEOUT_MS || 45000);
      const timeoutMs = Number.isFinite(timeoutConfigurado) && timeoutConfigurado >= 5000
        ? timeoutConfigurado
        : 45000;

      let descargado;
      let formatoEntregado = formatoNormalizado;

      try {
        const url = `${baseDocumento}?formato=${formatoNormalizado}&plantilla=auto`;
        descargado = await descargarDocumentoFactura(url, formatoNormalizado, timeoutMs);
      } catch (errorPdf) {
        // Si Puppeteer/Chrome está frío o temporalmente sin capacidad, Factura Bonita
        // puede entregar el mismo comprobante como HTML imprimible. Así el usuario
        // no pierde acceso a la factura mientras se recupera el renderer PDF.
        if (formatoNormalizado !== 'pdf') throw errorPdf;

        console.warn(`Facturación: PDF no disponible para ${idFactura}; intentando vista HTML.`, errorPdf?.message || errorPdf);
        try {
          const htmlUrl = `${baseDocumento}?formato=html&plantilla=auto`;
          descargado = await descargarDocumentoFactura(htmlUrl, 'html', Math.min(timeoutMs, 30000));
          formatoEntregado = 'html';
        } catch (errorHtml) {
          // Para una factura inexistente conservamos el error original, porque la
          // capa exterior sabe regenerar el vínculo y reintentar automáticamente.
          if (/factura no encontrada|no encontrada|not found/i.test(String(errorPdf?.message || ''))) {
            throw errorPdf;
          }
          throw new Error(errorHtml?.message || errorPdf?.message || 'No se pudo preparar la factura.');
        }
      }

      const documento = {
        ...descargado,
        filename: `factura-${idFactura}.${formatoEntregado === 'html' ? 'html' : 'pdf'}`,
        idFactura,
        formatoEntregado
      };

      guardarDocumentoCache(clave, documento);
      return documento;
    })();

    documentosFacturaEnCurso.set(clave, tarea);
    try {
      return await tarea;
    } finally {
      documentosFacturaEnCurso.delete(clave);
    }
  };

  const idInicial = String(vinculo.id_factura_externa);

  try {
    return await descargar(idInicial);
  } catch (error) {
    const mensaje = String(error?.message || "");
    if (!/factura no encontrada|no encontrada|not found/i.test(mensaje)) throw error;

    // Autorreparación: el id externo quedó obsoleto. Se vuelve a publicar la factura
    // usando la misma referencia cargo:<id>, se actualiza el vínculo local y se reintenta.
    await pool.query(`UPDATE factura_cargo SET id_factura_externa = NULL, estado_factura = 'pendiente_recrear', error_mensaje = NULL, fecha_actualizacion = NOW() WHERE id_cargo = ?`, [idCargo]);
    cacheDocumentosFactura.clear();

    const regenerada = await generarFacturaDeCargo(idCargo, "otro");
    if (!regenerada?.ok || !regenerada?.id_factura) {
      throw new Error(regenerada?.mensaje || "No se pudo volver a preparar la factura.");
    }

    return descargar(String(regenerada.id_factura));
  }
}


async function upsertDocumentoIntegrado(idCargo, tipo, datos = {}) {
  await asegurarEsquemaIntegracion();
  await pool.query(
    `INSERT INTO documento_facturacion_integrada
      (id_cargo, tipo, estado, identificador_externo, url_documento, mime_type, contenido, respuesta_json, error_mensaje, fecha_actualizacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       estado=VALUES(estado),
       identificador_externo=COALESCE(VALUES(identificador_externo), identificador_externo),
       url_documento=COALESCE(VALUES(url_documento), url_documento),
       mime_type=COALESCE(VALUES(mime_type), mime_type),
       contenido=COALESCE(VALUES(contenido), contenido),
       respuesta_json=COALESCE(VALUES(respuesta_json), respuesta_json),
       error_mensaje=VALUES(error_mensaje),
       fecha_actualizacion=NOW()`,
    [idCargo, tipo, datos.estado || 'pendiente', datos.identificador || null, datos.url || null,
     datos.mimeType || null, datos.contenido || null,
     datos.respuesta ? JSON.stringify(datos.respuesta) : null, datos.error || null]
  );
}

async function registrarDocumentosIntegracionInicial(idCargo, idFactura, apiRoot, config) {
  await upsertDocumentoIntegrado(idCargo, 'pdf_visual', {
    estado: 'disponible',
    identificador: idFactura,
    url: `${String(apiRoot || '').replace(/\/$/, '')}/api/documentos/facturas/${encodeURIComponent(idFactura)}?formato=pdf&plantilla=auto`,
    mimeType: 'application/pdf'
  });

  const [existentes] = await pool.query(
    `SELECT tipo FROM documento_facturacion_integrada WHERE id_cargo=? AND tipo IN ('factura_electronica','acuse')`,
    [Number(idCargo)]
  );
  const tipos = new Set(existentes.map((r) => r.tipo));
  if (!tipos.has('factura_electronica')) {
    await upsertDocumentoIntegrado(idCargo, 'factura_electronica', {
      estado: config?.factura_electronica_url
        ? (config?.factura_electronica_password ? 'pendiente_procesar' : 'pendiente_credenciales')
        : 'pendiente_endpoint'
    });
  }
  if (!tipos.has('acuse')) {
    await upsertDocumentoIntegrado(idCargo, 'acuse', {
      estado: config?.tributacion_url ? 'pendiente_xml' : 'pendiente_endpoint',
      error: config?.tributacion_url ? 'Pendiente de XML y validación en Mini Tributación.' : 'Pendiente de configurar Mini Tributación.'
    });
  }
}

export async function obtenerDocumentosIntegrados(idCargo) {
  await asegurarEsquemaIntegracion();
  const cargoId = Number(idCargo);
  let [rows] = await pool.query(
    `SELECT tipo, estado, identificador_externo, url_documento, mime_type, error_mensaje, fecha_actualizacion
       FROM documento_facturacion_integrada
      WHERE id_cargo=?
      ORDER BY FIELD(tipo,'pdf_visual','factura_electronica','acuse')`,
    [cargoId]
  );
  let mapa = Object.fromEntries(rows.map((r) => [r.tipo, r]));

  // Si el PDF ya existe pero la electrónica falló o quedó pendiente, el simple
  // hecho de consultar la sección de Facturación dispara un único reintento.
  // Esto recupera cargos ya pagados después de corregir/configurar FacturaSmart,
  // sin obligar al usuario a volver a cobrar ni a generar otro comprobante visual.
  const estadoXml = String(mapa.factura_electronica?.estado || '');
  if (['pendiente_procesar', 'pendiente_credenciales', 'pendiente_endpoint', 'error'].includes(estadoXml)) {
    const [[vinculo]] = await pool.query(`SELECT id_factura_externa FROM factura_cargo WHERE id_cargo=? LIMIT 1`, [cargoId]);
    if (vinculo?.id_factura_externa) {
      await generarFacturaDeCargo(cargoId, 'otro').catch(() => null);
      [rows] = await pool.query(
        `SELECT tipo, estado, identificador_externo, url_documento, mime_type, error_mensaje, fecha_actualizacion
           FROM documento_facturacion_integrada
          WHERE id_cargo=?
          ORDER BY FIELD(tipo,'pdf_visual','factura_electronica','acuse')`,
        [cargoId]
      );
      mapa = Object.fromEntries(rows.map((r) => [r.tipo, r]));
    }
  }
  if (String(mapa.factura_electronica?.estado || '') === 'remoto_disponible') {
    const config = await obtenerConfigInterna().catch(() => null);
    const idRemoto = String(mapa.factura_electronica?.identificador_externo || '').trim();
    if (config && idRemoto) {
      try {
        const xml = await fetchFacturaSmartBinario(config, `/api/v1/facturas/${encodeURIComponent(idRemoto)}/xml`, 20000);
        if (xml?.buffer?.length) {
          await upsertDocumentoIntegrado(cargoId, 'factura_electronica', {
            estado: 'disponible', identificador: idRemoto,
            mimeType: xml.contentType || 'application/xml', contenido: xml.buffer.toString('base64'), error: null
          });
          [rows] = await pool.query(
            `SELECT tipo, estado, identificador_externo, url_documento, mime_type, error_mensaje, fecha_actualizacion
               FROM documento_facturacion_integrada WHERE id_cargo=?
               ORDER BY FIELD(tipo,'pdf_visual','factura_electronica','acuse')`,
            [cargoId]
          );
          mapa = Object.fromEntries(rows.map((r) => [r.tipo, r]));
        }
      } catch {}
    }
  }
  const estadoXmlFinal = String(mapa.factura_electronica?.estado || '');
  const estadoAcuse = String(mapa.acuse?.estado || '');
  if (['disponible','remoto_disponible'].includes(estadoXmlFinal) && estadoAcuse !== 'disponible') {
    await procesarFacturaTributacion(cargoId).catch(() => null);
    [rows] = await pool.query(
      `SELECT tipo, estado, identificador_externo, url_documento, mime_type, error_mensaje, fecha_actualizacion
         FROM documento_facturacion_integrada WHERE id_cargo=?
         ORDER BY FIELD(tipo,'pdf_visual','factura_electronica','acuse')`,
      [cargoId]
    );
    mapa = Object.fromEntries(rows.map((r) => [r.tipo, r]));
  }
  if (['disponible','remoto_disponible'].includes(String(mapa.factura_electronica?.estado || ''))) {
    mapa.factura_electronica.url_xml_educontrol = `/api/finanzas/cargos/${Number(idCargo)}/factura-electronica?formato=xml`;
    mapa.factura_electronica.url_pdf_educontrol = `/api/finanzas/cargos/${Number(idCargo)}/factura-electronica?formato=pdf`;
  }
  if (mapa.acuse) mapa.acuse.url_acuse_educontrol = `/api/finanzas/cargos/${Number(idCargo)}/acuse`;
  return {
    completo: ['pdf_visual','factura_electronica','acuse'].every((tipo) => mapa[tipo]?.estado === 'disponible'),
    documentos: mapa
  };
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
