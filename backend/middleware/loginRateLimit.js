const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function keyFor(req) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(req.body?.correo || "").trim().toLowerCase()}`;
}

export function loginRateLimit(req, res, next) {
  const now = Date.now();
  const key = keyFor(req);
  const current = attempts.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    attempts.set(key, { count: 1, startedAt: now });
    return next();
  }
  current.count += 1;
  if (current.count > MAX_ATTEMPTS) {
    const wait = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 60000));
    return res.status(429).json({ mensaje: `Demasiados intentos. Espera ${wait} minuto(s) antes de volver a intentar.` });
  }
  return next();
}

export function clearLoginAttempts(req) {
  attempts.delete(keyFor(req));
}
