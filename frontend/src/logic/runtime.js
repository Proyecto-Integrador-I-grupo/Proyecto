
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

function installCharacterCounters() {
  const selector = 'input[maxlength]:not([type="password"]):not([type="search"]), textarea[maxlength]';
  document.querySelectorAll(selector).forEach((el) => {
    if (el.dataset.eduCounterWired === '1' || el.dataset.noCounter === '1') return;
    const key = `${el.id || ''} ${el.name || ''}`.toLowerCase();
    if (/(search|busqueda|búsqueda|filtro|filter)/.test(key)) return;
    const limit = Number(el.getAttribute('maxlength'));
    if (!Number.isFinite(limit) || limit <= 0) return;

    el.dataset.eduCounterWired = '1';
    const counter = document.createElement('div');
    counter.className = 'edu-char-counter';
    counter.setAttribute('aria-live', 'polite');
    const id = el.id ? `${el.id}-counter` : `edu-counter-${Math.random().toString(36).slice(2)}`;
    counter.id = id;

    const update = () => {
      const used = String(el.value || '').length;
      counter.textContent = `${used}/${limit}`;
      counter.classList.toggle('near-limit', used >= Math.ceil(limit * 0.85));
      counter.classList.toggle('at-limit', used >= limit);
    };

    const group = el.closest('.input-group');
    const anchor = group || el;
    anchor.insertAdjacentElement('afterend', counter);
    const describedBy = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (!describedBy.includes(id)) describedBy.push(id);
    el.setAttribute('aria-describedby', describedBy.join(' '));
    el.addEventListener('input', update);
    update();
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
  const content = modal.querySelector('.modal-content');
  if (!dialog || !content) return;

  dialog.style.removeProperty('zoom');
  dialog.style.removeProperty('--edu-modal-fit');

  const available = Math.max(320, window.innerHeight - 16);
  const height = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
  if (!height || height <= available) return;

  const scale = Math.max(0.62, Math.min(0.98, available / height));
  dialog.style.zoom = String(scale);
  dialog.style.setProperty('--edu-modal-fit', String(scale));
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
    // Neutraliza cualquier padding que Bootstrap haya agregado al body.
    document.body.style.paddingRight = '0px';
    window.requestAnimationFrame(() => fitModalToViewport(event.target));
  });
  document.addEventListener('hidden.bs.modal', (event) => {
    event.target?.querySelector('.modal-dialog')?.style.removeProperty('zoom');
    window.setTimeout(unlockDocumentAfterModal, 0);
  });
  window.addEventListener('resize', () => window.requestAnimationFrame(fitOpenModals));

  const stopScrollWhenModalOpen = (event) => {
    if (!document.querySelector('.modal.show')) return;
    event.preventDefault();
  };

  document.addEventListener('wheel', stopScrollWhenModalOpen, { passive: false, capture: true });
  document.addEventListener('touchmove', stopScrollWhenModalOpen, { passive: false, capture: true });
  document.addEventListener('keydown', (event) => {
    if (!document.querySelector('.modal.show')) return;
    if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(event.key)) {
      event.preventDefault();
    }
  }, true);
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
    initApp();
  };

  sessionInitFrame = requestAnimationFrame(initializeWhenReactIsReady);
}

export function legacyLogout() {
  clearCurrentUser();
}