
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


let modalScrollY = 0;

function lockDocumentForModal() {
  const body = document.body;
  const html = document.documentElement;
  if (!body || body.dataset.eduModalLocked === '1') return;

  modalScrollY = window.scrollY || window.pageYOffset || 0;

  body.dataset.eduModalLocked = '1';
  html.classList.add('edu-modal-lock');
  body.classList.add('edu-modal-lock');
  body.style.position = 'fixed';
  body.style.top = `-${modalScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  // Bootstrap compensa la barra de desplazamiento con padding-right. Como el
  // documento usa scrollbar-gutter estable, esa compensación provoca un salto
  // horizontal innecesario al abrir/cerrar una ventana.
  body.style.paddingRight = '0px';
}

function unlockDocumentAfterModal() {
  const body = document.body;
  const html = document.documentElement;
  if (!body || body.dataset.eduModalLocked !== '1') return;
  if (document.querySelector('.modal.show')) return;

  delete body.dataset.eduModalLocked;
  html.classList.remove('edu-modal-lock');
  body.classList.remove('edu-modal-lock');
  body.style.removeProperty('position');
  body.style.removeProperty('top');
  body.style.removeProperty('left');
  body.style.removeProperty('right');
  body.style.removeProperty('width');
  body.style.removeProperty('overflow');
  body.style.removeProperty('padding-right');

  // Si una ventana se cerró de forma programática y Bootstrap dejó un
  // backdrop huérfano, lo retiramos solo cuando ya no existe ningún modal
  // abierto. Esto evita pantallas bloqueadas y botones aparentemente inactivos.
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());

  const restoreY = modalScrollY;
  // Restaurar después de que Bootstrap termine de devolver el foco evita que
  // el navegador desplace la página al botón que abrió el modal.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreY, left: 0, behavior: 'auto' });
    });
  });
}

function fitModalToViewport(modal) {
  if (!modal || modal.classList.contains('finance-invoice-preview-modal')) return;
  const dialog = modal.querySelector('.modal-dialog');
  if (!dialog) return;

  // No escalamos/encogemos modales con zoom. El layout CSS mantiene header y
  // footer visibles y permite desplazar solamente el contenido cuando la
  // altura de la pantalla realmente lo exige.
  dialog.style.removeProperty('zoom');
  dialog.style.removeProperty('--edu-modal-fit');
  modal.classList.toggle('edu-modal-compact-height', window.innerHeight < 760);
}

function fitOpenModals() {
  document.querySelectorAll('.modal.show').forEach(fitModalToViewport);
}

function initGlobalModalLock() {
  if (document.documentElement.dataset.eduModalGuard === '1') return;
  document.documentElement.dataset.eduModalGuard = '1';

  document.addEventListener('show.bs.modal', lockDocumentForModal);
  document.addEventListener('shown.bs.modal', (event) => {
    lockDocumentForModal();
    document.body.style.paddingRight = '0px';
    window.requestAnimationFrame(() => fitModalToViewport(event.target));
  });
  document.addEventListener('hidden.bs.modal', (event) => {
    event.target?.classList.remove('edu-modal-compact-height');
    window.setTimeout(unlockDocumentAfterModal, 0);
  });
  window.addEventListener('resize', () => window.requestAnimationFrame(fitOpenModals));

  // La página de fondo queda inmóvil, pero el usuario sí puede usar rueda,
  // touch y teclado dentro de la ventana emergente. Antes se bloqueaba la
  // barra espaciadora incluso al escribir nombres como "Juana Perez".
  const stopBackgroundScroll = (event) => {
    const modal = document.querySelector('.modal.show');
    if (!modal) return;
    if (modal.contains(event.target)) return;
    event.preventDefault();
  };

  document.addEventListener('wheel', stopBackgroundScroll, { passive: false, capture: true });
  document.addEventListener('touchmove', stopBackgroundScroll, { passive: false, capture: true });
  document.addEventListener('keydown', (event) => {
    const modal = document.querySelector('.modal.show');
    if (!modal) return;
    if (modal.contains(event.target)) return;
    if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
      event.preventDefault();
    }
  }, true);
}

function installHumanNameNormalization() {
  const selector = [
    '#nombre', '#apellido1', '#apellido2',
    '#prof-nombre', '#prof-apellido1', '#prof-apellido2',
    '#edit-prof-nombre', '#edit-prof-apellido1', '#edit-prof-apellido2',
    '#usuario-nombre', '#usuario-apellido1',
    '#usuario-editar-nombre', '#usuario-editar-apellido1',
    '#perfil-nombre', '#perfil-apellido1', '#perfil-apellido2'
  ].join(',');

  document.querySelectorAll(selector).forEach((input) => {
    if (input.dataset.eduHumanName === '1') return;
    input.dataset.eduHumanName = '1';
    input.addEventListener('blur', () => {
      // Conserva los espacios internos y solo corrige espacios repetidos.
      input.value = String(input.value || '').replace(/\\s+/g, ' ').trim();
    });
  });
}

let booted = false;

export function bootLegacyRuntime() {
  if (booted) return;
  booted = true;

  // Estas funciones solo preparan elementos globales que React ya renderizó.
  restoreAccessibilitySettings();
  initAccessibilityWidget();
  initGlobalModalLock();
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
    installHumanNameNormalization();
    initApp();
  };

  sessionInitFrame = requestAnimationFrame(initializeWhenReactIsReady);
}

export function legacyLogout() {
  clearCurrentUser();
}