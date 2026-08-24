import crypto from "crypto";

const SECRET = String(
  process.env.SESSION_SECRET ||
  process.env.DB_PASSWORD ||
  "educontrol-local-session-secret"
);
const TTL_SECONDS = Math.max(900, Math.min(Number(process.env.SESSION_TTL_SECONDS || 28800), 86400));

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(input) {
  return crypto.createHmac("sha256", SECRET).update(input).digest("base64url");
}

export function crearSessionToken(usuario) {
  const payload = {
    sub: Number(usuario.id_usuario),
    rol: String(usuario.nom_rol || usuario.rol || ""),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verificarSessionToken(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
