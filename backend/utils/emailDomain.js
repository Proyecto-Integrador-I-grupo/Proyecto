export function obtenerDominioEscuela() {
  return String(process.env.SCHOOL_EMAIL_DOMAIN || "educontrol.com")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

export function esCorreoInstitucional(correo) {
  const email = String(correo || "").trim().toLowerCase();
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const dominio = obtenerDominioEscuela();
  return Boolean(email && dominio && email.endsWith(`@${dominio}`));
}

export function validarCorreoInstitucional(correo) {
  if (!esCorreoInstitucional(correo)) {
    throw new Error(`Solo se permiten correos institucionales @${obtenerDominioEscuela()}.`);
  }
  return String(correo || "").trim().toLowerCase();
}
