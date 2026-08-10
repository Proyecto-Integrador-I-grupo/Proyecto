// Runtime mínimo de compatibilidad para la migración a React.
// La lógica funcional vive en los módulos de src/logic.

import {
  restoreAccessibilitySettings,
  initAccessibilityWidget,
  initApp,
  setCurrentUser,
  clearCurrentUser
} from './ui.js';

// Registrar todos los módulos antes de que React sincronice la sesión.
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

  if (!user) return;

  // React ya montó App.jsx cuando este efecto se ejecuta.
  initApp();
}

export function legacyLogout() {
  clearCurrentUser();
}
