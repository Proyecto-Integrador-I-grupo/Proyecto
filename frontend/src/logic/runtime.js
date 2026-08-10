import {
  setCurrentUser,
  clearCurrentUser,
  restoreAccessibilitySettings,
  initAccessibilityWidget,
  initApp,
} from './ui.js';

// runtime.js solo coordina el arranque.
// La lógica funcional vive en cada módulo.
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

  restoreAccessibilitySettings();
  initAccessibilityWidget();
}

export function syncReactSession(user) {
  setCurrentUser(user);

  if (user) {
    initApp();
  }
}

export function legacyLogout() {
  clearCurrentUser();
}