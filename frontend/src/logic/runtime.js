
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
import './pagos.js';
import './consultas.js';
import './reportes.js';
import './perfil.js';


function applyInputGuards() {
  const inferLimit = (el) => {
    const key = `${el.id || ''} ${el.name || ''}`.toLowerCase();
    if (key.includes('correo') || el.type === 'email') return 150;
    if (key.includes('apellido') || /(^|[-_])nombre($|[-_])/.test(key)) return 60;
    if (key.includes('telefono')) return 25;
    if (key.includes('referencia')) return 100;
    if (key.includes('descripcion')) return 250;
    if (key.includes('observacion') || el.tagName === 'TEXTAREA') return 500;
    if (key.includes('busqueda') || key.includes('search') || el.type === 'search') return 120;
    return 180;
  };

  document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input[type="tel"], textarea').forEach((el) => {
    if (!el.hasAttribute('maxlength')) el.maxLength = inferLimit(el);
  });
}

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
    applyInputGuards();
    initApp();
  };

  sessionInitFrame = requestAnimationFrame(initializeWhenReactIsReady);
}

export function legacyLogout() {
  clearCurrentUser();
}