const DEFAULT_TIMEOUT = 60000;

export async function consumirServicio(url, options = {}) {
  if (!url) {
    throw new Error("El servicio externo no está configurado.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      signal: options.signal || controller.signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.detalle ||
        data?.error ||
        data?.mensaje ||
        `El servicio externo respondió con estado ${response.status}.`
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("El servicio externo tardó demasiado en responder.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function obtenerUrlServicio(nombreVariable, ruta = "") {
  const base = String(process.env[nombreVariable] || "").trim().replace(/\/$/, "");
  if (!base) return "";
  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
