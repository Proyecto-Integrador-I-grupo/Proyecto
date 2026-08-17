const DEFAULT_TIMEOUT = 60000;

export async function consumirServicio(url, options = {}) {
  if (!url) {
    throw new Error("El servicio externo no está configurado.");
  }

  const timeoutMs = Number(options.timeout || DEFAULT_TIMEOUT);
  const fetchOptions = { ...options };
  delete fetchOptions.timeout;

  const controller = options.signal ? null : new AbortController();
  const timeout = controller
    ? setTimeout(
        () => controller.abort(),
        Number.isFinite(timeoutMs) && timeoutMs >= 1000 ? timeoutMs : DEFAULT_TIMEOUT
      )
    : null;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      signal: options.signal || controller?.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");

    if (!response.ok) {
      const detalle = typeof data === "object" && data !== null
        ? (data.detalle || data.error || data.mensaje)
        : String(data || "").slice(0, 240);

      throw new Error(
        detalle || `El servicio externo respondió con estado ${response.status}.`
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("El servicio externo tardó demasiado en responder.");
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function obtenerUrlServicio(nombreVariable, ruta = "") {
  const base = String(process.env[nombreVariable] || "").trim().replace(/\/$/, "");
  if (!base) return "";
  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
