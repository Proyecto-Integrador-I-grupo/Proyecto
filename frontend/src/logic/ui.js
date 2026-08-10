// frontend/ui.js
const baseUrl = import.meta.env.VITE_API_URL || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://proyecto-vcz6.onrender.com");

const SESSION_KEY = "educontrol_usuario";

let currentUser = null;
let views = [];
let appViewsReady = false;
let appInitialized = false;

const ACCESSIBILITY_KEY = 'educontrol_accesibilidad';

let accessibilitySettings = {
  isDark: false,
  highContrast: false,
  fontSize: 100
};

window.addEventListener('app:views-ready', () => {
  appViewsReady = true;
});

/* ==========================================
   1. SESIÓN Y AUTENTICACIÓN
   ========================================== */

function wireLoginScreen() {
  const loginForm = document.getElementById('login-form');
  const togglePassword = document.getElementById('toggle-password');

  loginForm?.addEventListener('submit', handleLogin);

  togglePassword?.addEventListener('click', () => {
    const input = document.getElementById('login-contrasena');
    const icon = togglePassword.querySelector('i');

    if (!input) return;

    const showing = input.type === 'text';

    input.type = showing ? 'password' : 'text';

    icon?.classList.toggle('bi-eye', showing);
    icon?.classList.toggle('bi-eye-slash', !showing);

    togglePassword.setAttribute('aria-pressed', String(!showing));

    togglePassword.setAttribute(
      'aria-label',
      showing ? 'Mostrar contraseña' : 'Ocultar contraseña'
    );
  });

  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

function restoreSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);

  if (!saved) {
    showLoginScreen();
    return;
  }

  try {
    currentUser = JSON.parse(saved);
    showApp();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  }
}

async function handleLogin(e) {
  e.preventDefault();

  const correoInput = document.getElementById('login-correo');
  const contrasenaInput = document.getElementById('login-contrasena');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  const correo = correoInput ? correoInput.value.trim() : '';
  const contrasena = contrasenaInput ? contrasenaInput.value : '';

  if (errorBox) {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  if (!correo || !contrasena) {
    if (errorBox) {
      errorBox.textContent = 'Ingresa correo y contraseña.';
      errorBox.classList.remove('hidden');
    }

    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm"></span> Ingresando...';
  }

  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        correo,
        contrasena
      })
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        json.mensaje ||
        json.message ||
        'Credenciales incorrectas.'
      );
    }

    currentUser = json.usuario;

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(currentUser)
    );

    showApp();

  } catch (error) {
    if (correoInput) {
      correoInput.value = '';
    }

    if (contrasenaInput) {
      contrasenaInput.value = '';
    }

    if (errorBox) {
      errorBox.textContent =
        error.message ||
        'Usuario o contraseña incorrectos.';

      errorBox.classList.remove('hidden');
    }

  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;

      submitBtn.innerHTML =
        '<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión';
    }
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);

  currentUser = null;
  window.EduControlCurrentUser = null;

  appInitialized = false;
  views = [];

  document.getElementById('login-form')?.reset();

  showLoginScreen();
}

function showLoginScreen() {
  document
    .getElementById('login-screen')
    ?.classList.remove('hidden');

  document
    .getElementById('app-shell')
    ?.classList.add('hidden');
}

function showApp() {
  document
    .getElementById('login-screen')
    ?.classList.add('hidden');

  document
    .getElementById('app-shell')
    ?.classList.remove('hidden');

  renderUserInfo();

  if (appViewsReady) {
    initApp();
  }
}

// Módulos a los que el rol "Profesor" NO tiene acceso
const VISTAS_RESTRINGIDAS_PROFESOR = [
  'matricula',
  'estudiantes',
  'profesores',
  'usuarios'
];

function renderUserInfo() {
  if (!currentUser) return;

  const nombreCompleto =
    `${currentUser.nombre ?? ''} ${currentUser.apellido1 ?? ''}`.trim();

  const iniciales =
    `${(currentUser.nombre || '?')[0] ?? ''}${(currentUser.apellido1 || '?')[0] ?? ''}`
      .toUpperCase();

  const rol = currentUser.rol || '—';
  const rolNormalizado = rol.toLowerCase();

  const esAdmin =
    rolNormalizado === 'administrador';

  const esProfesor =
    rolNormalizado === 'profesor';

  const rolClase =
    esAdmin
      ? 'role-badge-admin'
      : (
          esProfesor
            ? 'role-badge-profesor'
            : 'role-badge-asistente'
        );

  // Nombre de usuario
  const nombreEl =
    document.getElementById('sidebar-user-name');

  if (nombreEl) {
    nombreEl.textContent = nombreCompleto;
  }

  // Avatares / Fotos de perfil
  const claveFoto =
    `educontrol-perfil-foto-${currentUser.id_usuario}`;

  const fotoGuardada =
    localStorage.getItem(claveFoto);

  const fotoFinal =
    currentUser.foto || fotoGuardada;

  const avatarEl =
    document.getElementById('sidebar-avatar');

  if (avatarEl) {
    if (fotoFinal) {
      if (avatarEl.tagName === 'IMG') {
        avatarEl.src = fotoFinal;
      } else {
        avatarEl.style.backgroundImage =
          `url("${fotoFinal}")`;

        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
      }
    } else {
      avatarEl.textContent = iniciales;
    }
  }

  const rolBadgeEl =
    document.getElementById('sidebar-role-badge');

  if (rolBadgeEl) {
    rolBadgeEl.textContent = rol;

    rolBadgeEl.className =
      `role-badge ${rolClase}`;
  }

  const topbarName = document.getElementById('topbar-user-name');
  const topbarRole = document.getElementById('topbar-user-role');
  const topbarAvatar = document.getElementById('topbar-avatar');

  if (topbarName) topbarName.textContent = nombreCompleto || 'Usuario';
  if (topbarRole) topbarRole.textContent = rol;

  if (topbarAvatar) {
    if (fotoFinal) {
      topbarAvatar.style.backgroundImage = `url("${fotoFinal}")`;
      topbarAvatar.style.backgroundSize = 'cover';
      topbarAvatar.style.backgroundPosition = 'center';
      topbarAvatar.textContent = '';
    } else {
      topbarAvatar.style.backgroundImage = '';
      topbarAvatar.textContent = iniciales;
    }
  }

  document.body.classList.toggle(
    'is-admin',
    esAdmin
  );

  document.body.classList.toggle(
    'is-asistente',
    !esAdmin && !esProfesor
  );

  document.body.classList.toggle(
    'is-profesor',
    esProfesor
  );

  const assistantBanner =
    document.getElementById(
      'assistant-permission-notice'
    );

  if (assistantBanner) {
    assistantBanner.classList.toggle(
      'hidden',
      esAdmin
    );
  }

  aplicarRestriccionesModulos(
    rolNormalizado
  );
}

function aplicarRestriccionesModulos(rolNormalizado) {
  const esAdmin =
    rolNormalizado === 'administrador';

  const esProfesor =
    rolNormalizado === 'profesor';

  document
    .querySelectorAll('.sidebar button[data-view]')
    .forEach((btn) => {
      const vista = btn.dataset.view;

      let restringida = false;

      // Módulos exclusivos del Administrador.
      if (vista === 'usuarios' || vista === 'reportes') {
        restringida = !esAdmin;

      } else if (
        esProfesor &&
        VISTAS_RESTRINGIDAS_PROFESOR.includes(vista)
      ) {
        restringida = true;
      }

      const item =
        btn.closest('.nav-item') || btn;

      item.classList.toggle(
        'hidden',
        restringida
      );
    });
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  if (currentUser?.id_usuario) {
    headers['x-user-id'] = String(currentUser.id_usuario);
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });

    if (res.status === 401) {
      showToast('Tu sesión expiró. Inicia sesión de nuevo.', 'error');
      window.dispatchEvent(new CustomEvent('educontrol:session-expired'));
      logout();
    }

    return res;
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

/* ==========================================
   2. INICIALIZACIÓN Y NAVEGACIÓN
   ========================================== */

function initApp() {
  /*
   * React puede volver a ejecutar esta función
   * después de actualizar el estado de sesión.
   *
   * Evitamos registrar los mismos listeners
   * varias veces.
   */
  if (appInitialized) {
    views = document.querySelectorAll(
      '.sidebar button[data-view]'
    );

    const activeButton =
      document.querySelector(
        '.sidebar button[data-view].active'
      );

    setActiveView(
      activeButton?.dataset.view ||
      'dashboard'
    );

    return;
  }

  views = document.querySelectorAll(
    '.sidebar button[data-view]'
  );

  views.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        setActiveView(
          button.dataset.view
        );
      }
    );
  });

  wireUsuariosForm();
  wireUsuariosDelete();
  wireSidebarToggle();
  initAccessibilityWidget();

  appInitialized = true;

  /*
   * React ya renderizó las páginas.
   * Solo activamos la vista inicial.
   *
   * NO llamamos refreshDashboardCounts()
   * aquí porque esa lógica pertenece al
   * módulo dashboard.js.
   */
  setActiveView('dashboard');
}

function wireSidebarToggle() {
  const toggle =
    document.getElementById('sidebar-toggle');

  const icon =
    toggle?.querySelector('i');

  const sidebar =
    document.querySelector('.sidebar');
  const backdrop =
    document.getElementById('sidebar-backdrop');

  if (!toggle || !sidebar || !icon) {
    return;
  }

  if (toggle.dataset.wired === 'true') {
    return;
  }

  toggle.dataset.wired = 'true';

  const updateToggleState = () => {
    const isOpen =
      sidebar.classList.contains('open');

    icon.className =
      isOpen
        ? 'bi bi-x-lg'
        : 'bi bi-list';

    toggle.setAttribute(
      'aria-label',
      isOpen
        ? 'Cerrar menú'
        : 'Abrir menú'
    );

    backdrop?.classList.toggle('show', isOpen);
    document.body.classList.toggle('sidebar-menu-open', isOpen);
  };

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    updateToggleState();
  };

  toggle.addEventListener(
    'click',
    () => {
      sidebar.classList.toggle('open');

      updateToggleState();
    }
  );

  backdrop?.addEventListener('click', closeSidebar);

  document.addEventListener(
    'click',
    (event) => {
      if (window.innerWidth >= 992) {
        return;
      }

      if (!sidebar.classList.contains('open')) {
        return;
      }

      if (
        toggle.contains(event.target) ||
        sidebar.contains(event.target) ||
        backdrop?.contains(event.target)
      ) {
        return;
      }

      closeSidebar();
    }
  );

  updateToggleState();
}

function setActiveView(viewName) {
  const rolNormalizado =
    (currentUser?.rol || '').toLowerCase();

  const esAdmin =
    rolNormalizado === 'administrador';

  // Usuarios y Reportes son exclusivos del Administrador.
  if (
    ['usuarios', 'reportes'].includes(viewName) &&
    !esAdmin
  ) {
    showToast(
      'Acceso restringido. Solo administradores.',
      'error'
    );

    viewName = 'dashboard';

  } else if (
    rolNormalizado === 'profesor' &&
    VISTAS_RESTRINGIDAS_PROFESOR.includes(
      viewName
    )
  ) {
    viewName = 'dashboard';
  }

  const targetSection =
    document.getElementById(
      `${viewName}-view`
    );

  if (!targetSection) {
    console.warn(
      `EduControl: no existe la vista "${viewName}-view".`
    );

    return;
  }

  const modulo =
    window.EduControlModules?.[viewName];

  if (
    modulo &&
    typeof modulo.init === 'function'
  ) {
    try {
      modulo.init();
    } catch (error) {
      console.error(
        `EduControl: error inicializando módulo ${viewName}:`,
        error
      );
    }
  }

  views.forEach((button) => {
    const isActive =
      button.dataset.view === viewName;

    button.classList.toggle(
      'active',
      isActive
    );
  });

  const sections =
    document.querySelectorAll('.view');

  sections.forEach((section) => {
    section.classList.toggle(
      'hidden',
      section.id !== `${viewName}-view`
    );
  });

  const heroCard =
    document.getElementById(
      'dashboard-hero'
    );

  if (heroCard) {
    heroCard.classList.toggle(
      'hidden',
      viewName !== 'dashboard'
    );
  }

  const titleElement =
    document.getElementById(
      'view-title'
    );

  if (titleElement) {
    const activeButton =
      document.querySelector(
        `.sidebar button[data-view="${viewName}"]`
      );

    titleElement.textContent =
      activeButton?.textContent.trim() ||
      'Dashboard';
  }

  document.title = `${titleElement?.textContent || 'Dashboard'} · EduControl`;

  /*
   * Cada módulo ES registra su propia función
   * de carga.
   *
   * Evitamos depender de funciones globales
   * que antes venían del runtime monolítico.
   */
  if (
    modulo &&
    typeof modulo.load === 'function'
  ) {
    Promise
      .resolve(modulo.load())
      .catch((error) => {
        console.error(
          `EduControl: error cargando módulo ${viewName}:`,
          error
        );
      });
  } else if (viewName === 'usuarios') {
    Promise.resolve(loadUsuariosData()).catch((error) => {
      console.error('EduControl: error cargando usuarios:', error);
    });
  }

  if (window.innerWidth < 992) {
    document
      .querySelector('.sidebar')
      ?.classList.remove('open');
    document
      .getElementById('sidebar-backdrop')
      ?.classList.remove('show');
    document.body.classList.remove('sidebar-menu-open');
    const mobileToggle = document.getElementById('sidebar-toggle');
    const mobileIcon = mobileToggle?.querySelector('i');
    if (mobileIcon) mobileIcon.className = 'bi bi-list';
    mobileToggle?.setAttribute('aria-label', 'Abrir menú');
  }
}

/* ==========================================
   3. MÓDULO DE USUARIOS Y PERMISOS
   ========================================== */

function wireUsuariosForm() {
  const form =
    document.getElementById(
      'usuario-form'
    );

  if (
    !form ||
    form.dataset.wired === "true"
  ) {
    return;
  }

  form.dataset.wired = "true";

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();

      const submitBtn =
        document.getElementById(
          'btn-guardar-usuario'
        );

      const nombre =
        document
          .getElementById(
            'usuario-nombre'
          )
          ?.value
          .trim();

      const apellido1 =
        document
          .getElementById(
            'usuario-apellido1'
          )
          ?.value
          .trim();

      const correo =
        document
          .getElementById(
            'usuario-correo'
          )
          ?.value
          .trim();

      const rolTexto =
        document.getElementById(
          'usuario-rol'
        )?.value;

      const contrasena =
        document.getElementById(
          'usuario-clave'
        )?.value;

      if (
        !nombre ||
        !apellido1 ||
        !correo ||
        !contrasena
      ) {
        showToast(
          'Por favor completa todos los campos.',
          'error'
        );

        return;
      }

      const payload = {
        nombre,
        primer_apellido: apellido1,
        correo,
        contrasena,
        id_rol:
          rolTexto === 'Administrador'
            ? 1
            : 2
      };

      if (submitBtn) {
        submitBtn.disabled = true;

        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm"></span> Guardando...';
      }

      try {
        const res = await apiFetch(
          '/api/usuarios',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify(payload)
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.mensaje ||
            'Error al guardar el usuario.'
          );
        }

        showToast(
          'Usuario guardado con éxito.',
          'success'
        );

        form.reset();

        await loadUsuariosData();

      } catch (err) {
        showToast(
          err.message,
          'error'
        );

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;

          submitBtn.innerHTML =
            '<i class="bi bi-download me-1"></i> Guardar Usuario';
        }
      }
    }
  );
}

function wireUsuariosDelete() {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody || tbody.dataset.deleteWired === 'true') return;
  tbody.dataset.deleteWired = 'true';

  tbody.addEventListener('click', async (event) => {
    const button = event.target.closest('.btn-eliminar-usuario');
    if (!button) return;

    const id = button.dataset.id;
    if (!id) return;

    if (Number(id) === Number(currentUser?.id_usuario)) {
      showToast('No puedes eliminar el usuario de la sesión actual.', 'error');
      return;
    }

    if (!window.confirm('¿Deseas eliminar este usuario?')) return;

    button.disabled = true;
    try {
      const res = await apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || data.error || 'No se pudo eliminar el usuario.');
      showToast('Usuario eliminado correctamente.', 'success');
      await loadUsuariosData();
    } catch (error) {
      showToast(error.message || 'No se pudo eliminar el usuario.', 'error');
      button.disabled = false;
    }
  });
}

async function loadUsuariosData() {
  try {
    const res =
      await apiFetch(
        '/api/usuarios'
      );

    if (!res.ok) {
      return;
    }

    const usuarios =
      await res.json();

    renderTablaUsuarios(
      usuarios
    );

  } catch (error) {
    console.error(
      'Error al cargar usuarios:',
      error
    );
  }
}

function renderTablaUsuarios(usuarios) {
  const tbody =
    document.getElementById(
      'tabla-usuarios-body'
    );

  if (!tbody) {
    return;
  }

  if (
    !Array.isArray(usuarios) ||
    usuarios.length === 0
  ) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="text-center text-muted py-3">No hay usuarios registrados.</td></tr>`;

    return;
  }

  // Filtrar docentes (id_rol === 3)
  const usuariosPermisos =
    usuarios.filter(
      (u) =>
        u.id_rol === 1 ||
        u.id_rol === 2
    );

  tbody.innerHTML =
    usuariosPermisos
      .map((u) => {
        const esElMismo =
          currentUser?.id_usuario ===
          u.id_usuario;

        const esAdmin =
          u.id_rol === 1;

        return `
          <tr>
            <td>
              <strong>
                ${u.nombre || 'Usuario'}
                ${u.apellido1 || ''}
              </strong>
            </td>

            <td>
              ${u.correo || '—'}
            </td>

            <td>
              <span class="badge ${
                esAdmin
                  ? 'bg-dark'
                  : 'bg-info'
              } text-white px-2 py-1">
                ${
                  esAdmin
                    ? 'Administrador'
                    : 'Asistente'
                }
              </span>
            </td>

            <td class="text-end">
              ${
                esElMismo
                  ? `
                    <span class="badge bg-light text-dark border">
                      Sesión Actual
                    </span>
                  `
                  : `
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger btn-eliminar-usuario"
                      data-id="${u.id_usuario}"
                    >
                      <i class="bi bi-trash"></i>
                      Eliminar
                    </button>
                  `
              }
            </td>
          </tr>
        `;
      })
      .join('');
}

window.eliminarUsuario =
  async function(idUsuario) {
    if (!idUsuario) {
      return;
    }

    if (
      !confirm(
        '¿Deseas eliminar este usuario?'
      )
    ) {
      return;
    }

    try {
      const res =
        await apiFetch(
          `/api/usuarios/${idUsuario}`,
          {
            method: 'DELETE'
          }
        );

      if (!res.ok) {
        const data =
          await res
            .json()
            .catch(() => ({}));

        throw new Error(
          data.mensaje ||
          'Error al eliminar usuario.'
        );
      }

      showToast(
        'Usuario eliminado con éxito.',
        'success'
      );

      await loadUsuariosData();

    } catch (err) {
      showToast(
        err.message,
        'error'
      );
    }
  };

/* ==========================================
   4. UI Y NOTIFICACIONES COMPARTIDAS
   ========================================== */

function showResultModal(
  type,
  titulo,
  mensaje
) {
  const icono =
    document.getElementById(
      'resultado-icono'
    );

  const tituloEl =
    document.getElementById(
      'resultado-titulo'
    );

  const mensajeEl =
    document.getElementById(
      'resultado-mensaje'
    );

  if (icono) {
    icono.className =
      type === 'success'
        ? 'bi bi-check-circle-fill text-success'
        : 'bi bi-x-circle-fill text-danger';

    icono.style.fontSize =
      '42px';
  }

  if (tituloEl) {
    tituloEl.textContent =
      titulo;
  }

  if (mensajeEl) {
    mensajeEl.textContent =
      mensaje;
  }

  const modalEl =
    document.getElementById(
      'modalResultado'
    );

  if (modalEl) {
    const instance =
      bootstrap.Modal.getInstance(
        modalEl
      ) ||
      new bootstrap.Modal(
        modalEl
      );

    instance.show();
  }
}

function showToast(
  message,
  type = 'success',
  ms = 3500
) {
  const toastElement =
    document.getElementById(
      'toast'
    );

  if (!toastElement) {
    return;
  }

  toastElement.textContent =
    message;

  toastElement.className =
    `toast ${type}`;

  clearTimeout(
    showToast.timeoutId
  );

  showToast.timeoutId =
    setTimeout(() => {
      if (toastElement) {
        toastElement.className =
          'toast hidden';
      }
    }, ms);
}

function initAccessibilityWidget() {
  const toggleBtn =
    document.getElementById(
      'accessibility-toggle'
    );

  const menu =
    document.getElementById(
      'accessibility-menu'
    );

  const themeBtn =
    document.getElementById(
      'btn-toggle-theme'
    );

  const contrastBtn =
    document.getElementById(
      'btn-toggle-contrast'
    );

  const resetBtn =
    document.getElementById(
      'btn-reset-accessibility'
    );

  const fontRange =
    document.getElementById(
      'font-size-range'
    );

  const fontValue =
    document.getElementById(
      'font-size-value'
    );

  if (
    !toggleBtn ||
    !menu ||
    !themeBtn ||
    !contrastBtn ||
    !resetBtn ||
    !fontRange ||
    !fontValue
  ) {
    return;
  }

  if (
    toggleBtn.dataset.wired === 'true'
  ) {
    updateAccessibilityControls();
    return;
  }

  toggleBtn.dataset.wired = 'true';

  toggleBtn.addEventListener(
    'click',
    () => {
      const isHidden =
        menu.classList.toggle(
          'hidden'
        );

      toggleBtn.setAttribute(
        'aria-expanded',
        (!isHidden).toString()
      );
    }
  );

  themeBtn.addEventListener(
    'click',
    () => {
      accessibilitySettings.isDark =
        !accessibilitySettings.isDark;

      applyAccessibilitySettings();

      menu.classList.add(
        'hidden'
      );

      toggleBtn.setAttribute(
        'aria-expanded',
        'false'
      );
    }
  );

  contrastBtn.addEventListener(
    'click',
    () => {
      accessibilitySettings.highContrast =
        !accessibilitySettings.highContrast;

      applyAccessibilitySettings();

      menu.classList.add(
        'hidden'
      );

      toggleBtn.setAttribute(
        'aria-expanded',
        'false'
      );
    }
  );

  resetBtn.addEventListener(
    'click',
    () => {
      accessibilitySettings = {
        isDark: false,
        highContrast: false,
        fontSize: 100
      };

      applyAccessibilitySettings();

      menu.classList.add(
        'hidden'
      );

      toggleBtn.setAttribute(
        'aria-expanded',
        'false'
      );
    }
  );

  fontRange.addEventListener(
    'input',
    () => {
      accessibilitySettings.fontSize =
        parseInt(
          fontRange.value,
          10
        );

      fontValue.textContent =
        `${accessibilitySettings.fontSize}%`;

      applyAccessibilitySettings();
    }
  );

  document.addEventListener(
    'click',
    (event) => {
      if (
        !menu.classList.contains(
          'hidden'
        ) &&
        !toggleBtn.contains(
          event.target
        ) &&
        !menu.contains(
          event.target
        )
      ) {
        menu.classList.add(
          'hidden'
        );

        toggleBtn.setAttribute(
          'aria-expanded',
          'false'
        );
      }
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        menu.classList.add(
          'hidden'
        );

        toggleBtn.setAttribute(
          'aria-expanded',
          'false'
        );
      }
    }
  );

  updateAccessibilityControls();
}

function applyAccessibilitySettings() {
  document.body.classList.toggle(
    'theme-dark',
    accessibilitySettings.isDark
  );

  document.body.classList.toggle(
    'high-contrast',
    accessibilitySettings.highContrast
  );

  document.body.style.fontSize =
    `${accessibilitySettings.fontSize}%`;

  localStorage.setItem(
    ACCESSIBILITY_KEY,
    JSON.stringify(
      accessibilitySettings
    )
  );

  updateAccessibilityControls();
}

function restoreAccessibilitySettings() {
  try {
    const saved =
      JSON.parse(
        localStorage.getItem(
          ACCESSIBILITY_KEY
        )
      );

    if (saved) {
      accessibilitySettings = {
        ...accessibilitySettings,
        ...saved
      };
    }

  } catch (err) {
    console.warn(
      'No se pudo restaurar accesibilidad:',
      err
    );
  }

  applyAccessibilitySettings();
}

function updateAccessibilityControls() {
  const themeBtn =
    document.getElementById(
      'btn-toggle-theme'
    );

  const contrastBtn =
    document.getElementById(
      'btn-toggle-contrast'
    );

  const fontRange =
    document.getElementById(
      'font-size-range'
    );

  const fontValue =
    document.getElementById(
      'font-size-value'
    );

  if (
    !themeBtn ||
    !contrastBtn ||
    !fontRange ||
    !fontValue
  ) {
    return;
  }

  themeBtn.textContent =
    accessibilitySettings.isDark
      ? 'Modo claro'
      : 'Modo oscuro';

  contrastBtn.textContent =
    accessibilitySettings.highContrast
      ? 'Contraste normal'
      : 'Alto contraste';

  fontRange.value =
    accessibilitySettings.fontSize;

  fontValue.textContent =
    `${accessibilitySettings.fontSize}%`;

  themeBtn.classList.toggle(
    'accessibility-action-active',
    accessibilitySettings.isDark
  );

  contrastBtn.classList.toggle(
    'accessibility-action-active',
    accessibilitySettings.highContrast
  );
}

/* ==========================================
   5. API PÚBLICA
   ========================================== */

export {
  apiFetch,
  currentUser,
  initApp,
  renderUserInfo,
  setActiveView,
  showResultModal,
  showToast,
  initAccessibilityWidget,
  restoreAccessibilitySettings,
  applyAccessibilitySettings,
  updateAccessibilityControls
};

export function setCurrentUser(user) {
  currentUser = user ?? null;

  window.EduControlCurrentUser =
    currentUser;
}

export function clearCurrentUser() {
  currentUser = null;

  window.EduControlCurrentUser =
    null;
}