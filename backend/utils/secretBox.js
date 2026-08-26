import crypto from "crypto";

function key() {
  const raw = String(process.env.INTEGRATION_SECRET_KEY || process.env.SESSION_SECRET || "educontrol-development-secret-change-me");
  return crypto.createHash("sha256").update(raw).digest();
}

export function cifrarSecreto(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function descifrarSecreto(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length < 29) return "";
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
