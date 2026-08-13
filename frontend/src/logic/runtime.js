
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

let sessionInitFrame = null;
let sessionInitAttempts = 0;

export function syncReactSession(user) {
  setCurrentUser(user);

  if (sessionInitFrame) {
    cancelAnimationFrame(sessionInitFrame);
    sessionInitFrame = null;
  }

  sessionInitAttempts = 0;

  if (!user) return;

  const initializeWhenReactIsReady = () => {
    const appShell = document.getElementById('app-shell');
    const navButtons = document.querySelectorAll('.sidebar button[data-view]');
    const viewSections = document.querySelectorAll('#content .view');

    if ((!appShell || navButtons.length === 0 || viewSections.length === 0) && sessionInitAttempts < 20) {
      sessionInitAttempts += 1;
      sessionInitFrame = requestAnimationFrame(initializeWhenReactIsReady);
      return;
    }

    sessionInitFrame = null;
    renderUserInfo();
    initApp();
  };

  sessionInitFrame = requestAnimationFrame(initializeWhenReactIsReady);
}

export function legacyLogout() {
  clearCurrentUser();
}