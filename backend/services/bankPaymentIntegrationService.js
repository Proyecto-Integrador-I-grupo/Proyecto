import { randomUUID } from 'node:crypto';
import pool from '../config/database.js';
import { registrarPago } from './finanzaService.js';
import { obtenerConfiguracionInternaIntegraciones } from './facturacionIntegrationService.js';

const DEFAULT_BANK_CHECKOUT_URL = 'https://bankyfinanzas.netlify.app/checkout';
const BANK_CHANNEL = 'bankyfinanzas:checkout';
let schemaPromise = null;

function clean(value, max = 250) {
  return String(value ?? '').trim().slice(0, max);
}

function money(value, field = 'El monto') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} debe ser un monto válido.`);
  return Math.round(n * 100) / 100;
}

function publicOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.origin;
  } catch {
    throw new Error('No se pudo determinar el origen seguro de EduControl para iniciar el pago.');
  }
}

function bankOrigin(checkoutUrl) {
  try { return new URL(checkoutUrl || DEFAULT_BANK_CHECKOUT_URL).origin; }
  catch { return 'https://bankyfinanzas.netlify.app'; }
}

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS intento_pago_banco (
      id_intento BIGINT AUTO_INCREMENT PRIMARY KEY,
      token CHAR(36) NOT NULL,
      id_cargo INT NOT NULL,
      referencia VARCHAR(100) NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      moneda VARCHAR(3) NOT NULL DEFAULT 'CRC',
      estado VARCHAR(30) NOT NULL DEFAULT 'iniciado',
      transaction_code VARCHAR(100) NULL,
      payment_id VARCHAR(100) NULL,
      intent_id VARCHAR(100) NULL,
      datos_pago_json LONGTEXT NULL,
      respuesta_banco_json LONGTEXT NULL,
      id_usuario INT NULL,
      fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_expiracion DATETIME NOT NULL,
      fecha_confirmacion DATETIME NULL,
      UNIQUE KEY uq_intento_pago_banco_token (token),
      UNIQUE KEY uq_intento_pago_banco_referencia (referencia),
      UNIQUE KEY uq_intento_pago_banco_transaction (transaction_code),
      UNIQUE KEY uq_intento_pago_banco_payment (payment_id),
      KEY idx_intento_pago_banco_cargo (id_cargo),
      KEY idx_intento_pago_banco_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

async function verifyBankIfConfigured({ reference, amount, currency, payload }) {
  const verifyUrl = clean(process.env.BANK_VERIFY_URL, 1000);
  if (!verifyUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.BANK_VERIFY_TIMEOUT_MS || 12000));
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, amount, currency, payload }),
      signal: controller.signal
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
    if (!response.ok) throw new Error(`El banco no validó el pago (HTTP ${response.status}).`);
    const status = String(body?.status || body?.estado || '').toLowerCase();
    const ok = body?.paid === true || body?.success === true || ['paid','success','completed','aprobado','pagado'].includes(status);
    if (!ok) throw new Error('El banco respondió, pero el pago todavía no aparece aprobado.');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function iniciarPagoBanco(idCargo, datos, idUsuario, requestOrigin) {
  await ensureSchema();
  const cargoId = Number(idCargo);
  if (!Number.isInteger(cargoId) || cargoId <= 0) throw new Error('El cargo no es válido.');
  const monto = money(datos?.monto, 'El monto del pago');

  const [[cargo]] = await pool.query(
    `SELECT ce.id_cargo, ce.saldo, ce.estado, ce.descripcion, ce.id_estudiante,
            CONCAT_WS(' ', p.nombre, p.apellido1, p.apellido2) AS estudiante_nombre
       FROM cargo_estudiante ce
       JOIN estudiante e ON e.id_estudiante = ce.id_estudiante
       JOIN persona p ON p.id_persona = e.id_persona
      WHERE ce.id_cargo = ? LIMIT 1`,
    [cargoId]
  );
  if (!cargo) throw new Error('Cargo no encontrado.');
  if (String(cargo.estado).toLowerCase() === 'pagado' || Number(cargo.saldo) <= 0) {
    const error = new Error('El cargo ya está pagado.');
    error.statusCode = 409;
    error.esperado = true;
    throw error;
  }
  if (monto > Number(cargo.saldo) + 0.001) {
    throw new Error(`El pago no puede superar el saldo pendiente de CRC ${Number(cargo.saldo).toLocaleString('es-CR')}.`);
  }

  const config = await obtenerConfiguracionInternaIntegraciones();
  const checkoutUrl = clean(config?.banco_checkout_url || process.env.BANK_CHECKOUT_URL || DEFAULT_BANK_CHECKOUT_URL, 1000);
  const merchant = clean(config?.banco_merchant_id || process.env.BANK_MERCHANT_ID, 160);
  if (!config?.banco_afiliado) {
    const error = new Error('EduControl todavía no está marcado como afiliado al servicio de pago. Completa la afiliación desde Configuración.');
    error.statusCode = 409;
    error.esperado = true;
    throw error;
  }
  if (!merchant) {
    const error = new Error('Falta el identificador de comercio entregado por el servicio de pago.');
    error.statusCode = 409;
    error.esperado = true;
    throw error;
  }

  const origin = publicOrigin(requestOrigin || datos?.origin);
  const token = randomUUID();
  const reference = `EDU-${cargoId}-${token.slice(0, 8).toUpperCase()}`;
  const expiry = new Date(Date.now() + 20 * 60 * 1000);
  const paymentData = {
    responsable: datos?.responsable || null,
    plazo: datos?.plazo || null
  };

  await pool.query(
    `INSERT INTO intento_pago_banco
      (token, id_cargo, referencia, monto, moneda, estado, datos_pago_json, id_usuario, fecha_expiracion)
     VALUES (?, ?, ?, ?, 'CRC', 'iniciado', ?, ?, ?)`,
    [token, cargoId, reference, monto, JSON.stringify(paymentData), idUsuario || null, expiry]
  );

  const checkout = new URL(checkoutUrl);
  checkout.searchParams.set('reference', reference);
  checkout.searchParams.set('orderId', reference);
  checkout.searchParams.set('amount', monto.toFixed(2));
  checkout.searchParams.set('currency', 'CRC');
  checkout.searchParams.set('description', clean(cargo.descripcion || `Cargo EduControl #${cargoId}`, 180));
  checkout.searchParams.set('origin', origin);
  checkout.searchParams.set('returnUrl', `${origin}/?paymentReference=${encodeURIComponent(reference)}`);
  checkout.searchParams.set('merchantId', merchant);
  checkout.searchParams.set('merchant', merchant);
  const merchantName = clean(config?.institucion_nombre || 'EduControl', 160);
  if (merchantName) checkout.searchParams.set('merchantName', merchantName);

  return {
    token,
    checkoutUrl: checkout.toString(),
    referencia: reference,
    monto,
    moneda: 'CRC',
    expectedOrigin: bankOrigin(checkoutUrl),
    channel: BANK_CHANNEL,
    expiresAt: expiry.toISOString()
  };
}

export async function confirmarPagoBanco(idCargo, datos, idUsuario) {
  await ensureSchema();
  const cargoId = Number(idCargo);
  const token = clean(datos?.token, 36);
  if (!Number.isInteger(cargoId) || cargoId <= 0 || !token) throw new Error('El intento de pago no es válido.');

  const connection = await pool.getConnection();
  let intent;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM intento_pago_banco WHERE token = ? AND id_cargo = ? FOR UPDATE`,
      [token, cargoId]
    );
    intent = rows[0];
    if (!intent) throw new Error('No se encontró el intento de pago bancario.');
    if (intent.estado === 'completado') {
      const error = new Error('Este pago bancario ya fue aplicado.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    if (new Date(intent.fecha_expiracion).getTime() < Date.now()) {
      await connection.query(`UPDATE intento_pago_banco SET estado='expirado' WHERE id_intento=?`, [intent.id_intento]);
      await connection.commit();
      const error = new Error('El intento de pago expiró. Inicia el pago nuevamente.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch {}
    connection.release();
    throw error;
  }
  connection.release();

  const config = await obtenerConfiguracionInternaIntegraciones();
  const checkoutUrl = clean(config?.banco_checkout_url || process.env.BANK_CHECKOUT_URL || DEFAULT_BANK_CHECKOUT_URL, 1000);
  const expectedOrigin = bankOrigin(checkoutUrl);
  if (String(datos?.sourceOrigin || '') !== expectedOrigin) {
    const error = new Error('El resultado no proviene del origen del servicio de pago configurado.');
    error.statusCode = 403;
    error.esperado = true;
    throw error;
  }

  const payload = datos?.payload && typeof datos.payload === 'object' ? datos.payload : {};
  let verified = await verifyBankIfConfigured({
    reference: intent.referencia,
    amount: Number(intent.monto),
    currency: intent.moneda,
    payload
  });

  if (!verified) {
    const status = String(payload.status || '').toLowerCase();
    if (status !== 'completed') {
      const error = new Error('El servicio de pago no reportó la operación como completada.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    const paidAmount = Number(payload.amount);
    if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(intent.monto)) > 0.01) {
      const error = new Error('El monto confirmado por el servicio de pago no coincide con el monto solicitado.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    if (String(payload.currency || '').toUpperCase() !== String(intent.moneda || 'CRC').toUpperCase()) {
      const error = new Error('La moneda confirmada por el servicio de pago no coincide con la operación.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    if (!clean(payload.transactionCode, 100)) {
      const error = new Error('El servicio de pago no devolvió un código de transacción.');
      error.statusCode = 409;
      error.esperado = true;
      throw error;
    }
    verified = payload;
  }

  const transactionCode = clean(verified.transactionCode || payload.transactionCode, 100);
  const paymentId = clean(verified.paymentId || payload.paymentId, 100) || null;
  const externalIntentId = clean(verified.intentId || payload.intentId, 100) || null;

  const [dups] = await pool.query(
    `SELECT id_intento FROM intento_pago_banco
      WHERE id_intento <> ? AND (transaction_code = ? OR (? IS NOT NULL AND payment_id = ?)) LIMIT 1`,
    [intent.id_intento, transactionCode, paymentId, paymentId]
  );
  if (dups.length) {
    const error = new Error('Ese pago bancario ya fue utilizado por otra operación.');
    error.statusCode = 409;
    error.esperado = true;
    throw error;
  }

  let storedData = {};
  try { storedData = JSON.parse(intent.datos_pago_json || '{}') || {}; } catch {}

  const resultado = await registrarPago(
    cargoId,
    {
      monto: Number(intent.monto),
      metodo_pago: 'tarjeta',
      referencia: transactionCode,
      responsable: storedData.responsable || undefined,
      plazo: storedData.plazo || undefined
    },
    idUsuario
  );

  await pool.query(
    `UPDATE intento_pago_banco
        SET estado='completado', transaction_code=?, payment_id=?, intent_id=?, respuesta_banco_json=?, fecha_confirmacion=NOW()
      WHERE id_intento=?`,
    [transactionCode, paymentId, externalIntentId, JSON.stringify(verified), intent.id_intento]
  );

  return {
    ...resultado,
    banco: {
      ok: true,
      referencia: intent.referencia,
      transactionCode,
      paymentId,
      channel: BANK_CHANNEL
    }
  };
}

export async function registrarResultadoNoCompletadoBanco(idCargo, datos) {
  await ensureSchema();
  const token = clean(datos?.token, 36);
  if (!token) return { ok: false };
  const payload = datos?.payload && typeof datos.payload === 'object' ? datos.payload : {};
  const status = String(payload.status || '').toLowerCase();
  if (!['cancelled','rejected'].includes(status)) return { ok: false };
  await pool.query(
    `UPDATE intento_pago_banco SET estado=?, respuesta_banco_json=? WHERE token=? AND id_cargo=? AND estado='iniciado'`,
    [status === 'cancelled' ? 'cancelado' : 'rechazado', JSON.stringify(payload), token, Number(idCargo)]
  );
  return { ok: true, estado: status };
}
