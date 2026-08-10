
import {
  restoreAccessibilitySettings,
  initAccessibilityWidget,
  initApp,
  setCurrentUser,
  clearCurrentUser,
  renderUserInfo
} from './ui.js';

// Registrar los módulos para que cada uno exponga su inicializador/cargador.
import './dashboard.js';
import './estudiantes.js';
import './profesores.js';
import './matricula.js';
import './asistencia.js';
import './consultas.js';
import './reportes.js';
import './perfil.js';

let booted = false;

export function bootLegacyRuntime() {
  if (booted) return;
  booted = true;

  // Estas funciones solo preparan elementos globales que React ya renderizó.
  restoreAccessibilitySettings();
  initAccessibilityWidget();
}

export function syncReactSession(user) {
  setCurrentUser(user);

  if (!user) return;
  renderUserInfo();
  initApp();
}

export function legacyLogout() {
  clearCurrentUser();
}