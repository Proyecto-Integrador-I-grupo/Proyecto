const DEFAULT_TIMEOUT = 60000;
const DEFAULT_429_RETRIES = 3;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response, intento) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const segundos = Number(retryAfter);
    if (Number.isFinite(segundos) && segundos >= 0) return Math.max(1000, segundos * 1000);

    const fecha = Date.parse(retryAfter);
    if (Number.isFinite(fecha)) return Math.max(1000, fecha - Date.now());
  }

  return [2000, 5000, 10000][Math.min(intento, 2)];
}

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
    const max429Retries = Number.isFinite(Number(options.retry429))
      ? Math.max(0, Number(options.retry429))
      : DEFAULT_429_RETRIES;

    for (let intento = 0; ; intento += 1) {
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

      if (response.status === 429 && intento < max429Retries) {
        const pausa = retryAfterMs(response, intento);
        console.warn(`Integración: HTTP 429 en ${url}. Reintento ${intento + 1}/${max429Retries} en ${pausa} ms.`);
        await esperar(pausa);
        continue;
      }

      if (!response.ok) {
        const detalle = typeof data === "object" && data !== null
          ? (data.detalle || data.error || data.mensaje)
          : String(data || "").slice(0, 240);

        if (response.status === 429) {
          throw new Error("Factura Bonita está aplicando un límite temporal de solicitudes. Espera unos segundos y vuelve a intentarlo.");
        }

        throw new Error(
          detalle || `El servicio externo respondió con estado ${response.status}.`
        );
      }

      return data;
    }
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
