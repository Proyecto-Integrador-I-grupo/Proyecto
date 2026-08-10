import { apiFetch } from './api';

export const SESSION_KEY = 'educontrol_usuario';

export function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function login(correo, contrasena) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ correo, contrasena }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.mensaje || data.message || 'Credenciales incorrectas.');
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.usuario));
  return data.usuario;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
