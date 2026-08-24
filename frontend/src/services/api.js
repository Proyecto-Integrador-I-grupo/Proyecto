const baseUrl = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://proyecto-vcz6.onrender.com'
);

const REQUEST_TIMEOUT = 90000;

export async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const sessionRaw = sessionStorage.getItem('educontrol_usuario');
  let sessionUser = null;
  try {
    sessionUser = sessionRaw ? JSON.parse(sessionRaw) : null;
  } catch {
    sessionUser = null;
  }

  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  if (sessionUser?.token) {
    headers.Authorization = `Bearer ${sessionUser.token}`;
  } else if (sessionUser?.id_usuario) {
    headers['x-user-id'] = String(sessionUser.id_usuario);
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    if (response.status === 401) {
      sessionStorage.removeItem('educontrol_usuario');
      window.dispatchEvent(new CustomEvent('educontrol:session-expired'));
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión e inténtalo nuevamente.');
    }
    if (!navigator.onLine) {
      throw new Error('No hay conexión a Internet. Revisa tu conexión e inténtalo nuevamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export { baseUrl };
