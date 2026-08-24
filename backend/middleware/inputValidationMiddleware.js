const LIMITS = {
  nombre: 60,
  primer_apellido: 60,
  apellido1: 60,
  apellido2: 60,
  nombre_grupo: 80,
  nombre_seccion: 80,
  materia: 60,
  correo: 150,
  telefono: 25,
  referencia: 100,
  descripcion: 250,
  observaciones: 500,
  motivo: 300,
  parentesco: 40,
  periodo: 30,
  numero_identificacion: 30,
  identificacion: 30,
  codigo: 50,
  institucion_nombre: 100
};

function keyLimit(key) {
  if (LIMITS[key]) return LIMITS[key];
  if (key.includes("correo")) return 150;
  if (key.includes("descripcion")) return 250;
  if (key.includes("observacion")) return 500;
  if (key.includes("nombre")) return 100;
  return 1200;
}

function inspect(value, key = "", path = "") {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length > 500) return `${path || "La lista"} contiene demasiados elementos.`;
    for (let i = 0; i < value.length; i += 1) {
      const err = inspect(value[i], key, `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      const err = inspect(childValue, childKey, path ? `${path}.${childKey}` : childKey);
      if (err) return err;
    }
    return null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const limit = keyLimit(key);
  if (trimmed.length > limit) return `${path || key || "El campo"} supera el límite permitido de ${limit} caracteres.`;
  if (/\u0000/.test(value)) return `${path || key || "El campo"} contiene caracteres no permitidos.`;

  if (key.includes("correo") && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `${path || key} no tiene un formato de correo válido.`;
  }

  return null;
}

export function validateInputPayload(req, res, next) {
  if (!req.body || typeof req.body !== "object") return next();
  const error = inspect(req.body);
  if (error) return res.status(400).json({ error });
  return next();
}
