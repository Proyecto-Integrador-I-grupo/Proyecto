// frontend/ui.js
const baseUrl = import.meta.env.VITE_API_URL || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3000"
  : "https://proyecto-vcz6.onrender.com");

const SESSION_KEY = "educontrol_usuario";
const ACTIVE_VIEW_KEY = 'educontrol_active_view';
const SCHOOL_EMAIL_DOMAIN = String(import.meta.env.VITE_SCHOOL_EMAIL_DOMAIN || 'educontrol.com')
  .trim().toLowerCase().replace(/^@+/, '');
const isSchoolEmail = (email) => String(email || '').trim().toLowerCase().endsWith(`@${SCHOOL_EMAIL_DOMAIN}`);

let currentUser = null;
let views = [];
let appViewsReady = false;
let appInitialized = false;
let usuariosCargados = [];
let usuarioPendienteEliminar = null;

const ACCESSIBILITY_KEY = 'educontrol_accesibilidad';

let accessibilitySettings = {
  isDark: false,
  highContrast: false,
  reducedMotion: false,
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

  const correo = correoInput ? correoInput.value.trim().toLowerCase() : '';
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
  sessionStorage.removeItem(ACTIVE_VIEW_KEY);

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
  'pagos',
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

  const roleNotice = document.getElementById('role-context-notice');
  const roleNoticeText = document.getElementById('role-context-text');
  if (roleNotice) {
    const esAsistente = !esAdmin && !esProfesor;
    const visible = esAsistente || esProfesor;
    roleNotice.classList.toggle('hidden', !visible);
    roleNotice.classList.toggle('is-profesor', esProfesor);
    roleNotice.classList.toggle('is-asistente', esAsistente);
    if (roleNoticeText) {
      roleNoticeText.textContent = esProfesor
        ? 'Vista docente · asistencia, reportes y consultas'
        : 'Vista asistente · acceso administrativo limitado';
    }
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

      // SOLO el Administrador puede ver
      // el botón de Gestión de Permisos/Usuarios
      if (vista === 'usuarios') {
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

  if (currentUser?.token) {
    headers.Authorization = `Bearer ${currentUser.token}`;
  } else if (currentUser?.id_usuario) {
    headers['x-user-id'] = String(currentUser.id_usuario);
  }

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const timeoutMs = Number(options.timeout || 90000);
  const fetchOptions = { ...options };
  delete fetchOptions.timeout;

  const controller = options.signal ? null : new AbortController();
  const timeout = controller
    ? setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 90000)
    : null;

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: options.signal || controller?.signal
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
    if (timeout) clearTimeout(timeout);
  }
}

/* ==========================================
   2. INICIALIZACIÓN Y NAVEGACIÓN
   ========================================== */

function initApp() {
  views = document.querySelectorAll(
    '.sidebar button[data-view]'
  );

  if (!views.length) {
    return false;
  }

  views.forEach((button) => {
    if (button.dataset.viewWired === 'true') {
      return;
    }

    button.dataset.viewWired = 'true';
    button.addEventListener('click', () => {
      setActiveView(button.dataset.view);
    });
  });

  if (!appInitialized) {
    wireUsuariosForm();
    wireUsuariosDelete();
    wireUsuariosEdit();
    wireUsuariosRefresh();
    wireSidebarToggle();
    initAccessibilityWidget();
    appInitialized = true;
  } else {
    wireSidebarToggle();
  }

  const vistaGuardada =
    sessionStorage.getItem(ACTIVE_VIEW_KEY) ||
    document.querySelector('.sidebar button[data-view].active')?.dataset.view ||
    'dashboard';

  setActiveView(vistaGuardada);
  return true;
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

  // Si intentan entrar a Usuarios sin ser Admin,
  // los devolvemos al Dashboard
  if (
    viewName === 'usuarios' &&
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

  sessionStorage.setItem(ACTIVE_VIEW_KEY, viewName);

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
    // React puede volver a montar esta vista; revalidamos listeners de forma
    // idempotente para que Guardar/Modificar/Eliminar respondan siempre.
    wireUsuariosForm();
    wireUsuariosDelete();
    wireUsuariosEdit();
    wireUsuariosRefresh();
    wireValidacionCorreosUsuarios();
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

function actualizarValidacionCorreoInstitucional(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (!input) return true;
  const correo = String(input.value || '').trim().toLowerCase();
  const invalido = Boolean(correo) && !isSchoolEmail(correo);
  input.classList.toggle('is-invalid', invalido);
  input.setAttribute('aria-invalid', invalido ? 'true' : 'false');
  if (error) error.classList.toggle('d-block', invalido);
  return !invalido;
}

function wireValidacionCorreosUsuarios() {
  [
    ['usuario-correo', 'usuario-correo-error'],
    ['usuario-editar-correo', 'usuario-editar-correo-error']
  ].forEach(([inputId, errorId]) => {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.domainValidationWired === 'true') return;
    input.dataset.domainValidationWired = 'true';
    const validar = () => actualizarValidacionCorreoInstitucional(inputId, errorId);
    input.addEventListener('input', validar);
    input.addEventListener('blur', validar);
  });
}

function normalizarNombreUsuario(valor) {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

function wireUsuariosForm() {
  const form = document.getElementById('usuario-form');
  if (!form || form.dataset.wired === 'true') return;

  form.dataset.wired = 'true';
  wireValidacionCorreosUsuarios();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.saving === '1') return;
    form.dataset.saving = '1';

    const submitBtn = document.getElementById('btn-guardar-usuario');
    const nombre = normalizarNombreUsuario(document.getElementById('usuario-nombre')?.value);
    const apellido1 = normalizarNombreUsuario(document.getElementById('usuario-apellido1')?.value);
    const correo = document.getElementById('usuario-correo')?.value.trim().toLowerCase() || '';
    const rolTexto = document.getElementById('usuario-rol')?.value || 'Asistente';
    const contrasena = document.getElementById('usuario-clave')?.value || '';

    if (!nombre || !apellido1 || !correo || !contrasena) {
      showToast('Por favor completa todos los campos.', 'error');
      return;
    }

    if (!isSchoolEmail(correo)) {
      actualizarValidacionCorreoInstitucional('usuario-correo', 'usuario-correo-error');
      showToast('No se acepta ese correo. Utiliza el correo institucional indicado.', 'error', 4500);
      document.getElementById('usuario-correo')?.focus();
      return;
    }

    if (contrasena.length < 6) {
      showToast('La contraseña temporal debe tener al menos 6 caracteres.', 'error');
      return;
    }

    const payload = {
      nombre,
      primer_apellido: apellido1,
      correo,
      contrasena,
      id_rol: rolTexto === 'Administrador' ? 1 : 2
    };

    const textoOriginal = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
    }

    try {
      const res = await apiFetch('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.mensaje || data.error || 'Error al guardar el usuario.');
      }

      const usuarioNuevo = data.usuario || {
        id_usuario: Number(data.id || 0),
        id_persona: null,
        id_rol: Number(payload.id_rol),
        nom_rol: Number(payload.id_rol) === 1 ? 'Administrador' : 'Asistente',
        nombre: payload.nombre,
        apellido1: payload.primer_apellido,
        apellido2: '',
        correo: payload.correo,
        estado: 1
      };

      // La respuesta del POST es la fuente inmediata de verdad para la UI.
      // Así el usuario aparece una sola vez, sin depender de una segunda
      // lectura que podría tardar unos milisegundos en reflejar el INSERT.
      // Inserción optimista: el usuario aparece inmediatamente aun si la BD tarda
      // unos milisegundos en devolverlo en un GET posterior. Se identifica también
      // por correo para evitar que el administrador crea que debe registrarlo otra vez.
      usuariosCargados = [
        ...usuariosCargados.filter((u) => {
          const mismoId = Number(usuarioNuevo.id_usuario) && Number(u.id_usuario) === Number(usuarioNuevo.id_usuario);
          const mismoCorreo = String(u.correo || '').toLowerCase() === String(usuarioNuevo.correo || '').toLowerCase();
          return !mismoId && !mismoCorreo;
        }),
        usuarioNuevo
      ].sort((a, b) => Number(a.id_usuario || 999999) - Number(b.id_usuario || 999999));
      renderTablaUsuarios(usuariosCargados);

      form.reset();
      const rolSelect = document.getElementById('usuario-rol');
      if (rolSelect) rolSelect.value = 'Asistente';

      showToast('Usuario guardado correctamente.', 'success');

      // Sincroniza en segundo plano. Si la primera lectura todavía no refleja
      // el INSERT, conserva la fila recién pintada y reintenta sin molestar al usuario.
      confirmarUsuarioEnLista(Number(usuarioNuevo.id_usuario), usuarioNuevo.correo);
    } catch (error) {
      showToast(error.message || 'No se pudo registrar el usuario.', 'error');
    } finally {
      form.dataset.saving = '0';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = textoOriginal || '<i class="bi bi-person-check me-1"></i> Guardar Usuario';
      }
    }
  });
}

function wireUsuariosRefresh() {
  const button = document.getElementById('btn-refrescar-usuarios');
  if (!button || button.dataset.wired === 'true') return;

  button.dataset.wired = 'true';
  button.addEventListener('click', async () => {
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Actualizando';
    try {
      await loadUsuariosData();
      showToast('Lista de usuarios actualizada.', 'success', 2000);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

function wireUsuariosDelete() {
  const tbody = document.getElementById('tabla-usuarios-body');
  const confirmar = document.getElementById('btn-confirmar-eliminar-usuario');

  if (tbody && tbody.dataset.deleteWired !== 'true') {
    tbody.dataset.deleteWired = 'true';
    tbody.addEventListener('click', (event) => {
      const button = event.target.closest('.btn-eliminar-usuario');
      if (!button) return;

      const id = Number(button.dataset.id);
      if (!id) return;
      if (id === Number(currentUser?.id_usuario)) {
        showToast('No puedes eliminar el usuario de la sesión actual.', 'error');
        return;
      }

      const fila = button.closest('tr');
      const nombre = fila?.querySelector('td strong')?.textContent?.trim() || 'este usuario';
      usuarioPendienteEliminar = { id, button, nombre };
      const nombreEl = document.getElementById('usuario-eliminar-nombre');
      if (nombreEl) nombreEl.textContent = nombre;

      const modalEl = document.getElementById('modalEliminarUsuario');
      if (modalEl && window.bootstrap?.Modal) {
        (window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).show();
      }
    });
  }

  if (confirmar && confirmar.dataset.wired !== 'true') {
    confirmar.dataset.wired = 'true';
    confirmar.addEventListener('click', async () => {
      const pendiente = usuarioPendienteEliminar;
      if (!pendiente?.id) return;
      confirmar.disabled = true;
      confirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Eliminando...';
      try {
        const res = await apiFetch(`/api/usuarios/${pendiente.id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.mensaje || data.error || 'No se pudo eliminar el usuario.');

        const modalEl = document.getElementById('modalEliminarUsuario');
        window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        usuariosCargados = usuariosCargados.filter((u) => Number(u.id_usuario) !== Number(pendiente.id));
        renderTablaUsuarios(usuariosCargados);
        showToast('Usuario eliminado correctamente.', 'success');
        usuarioPendienteEliminar = null;
        void loadUsuariosData();
      } catch (error) {
        showToast(error.message || 'No se pudo eliminar el usuario.', 'error');
      } finally {
        confirmar.disabled = false;
        confirmar.innerHTML = '<i class="bi bi-trash me-1"></i> Sí, eliminar';
      }
    });
  }
}

function wireUsuariosEdit() {
  wireValidacionCorreosUsuarios();
  const tbody = document.getElementById('tabla-usuarios-body');
  const form = document.getElementById('usuario-editar-form');

  if (tbody && tbody.dataset.editWired !== 'true') {
    tbody.dataset.editWired = 'true';
    tbody.addEventListener('click', async (event) => {
      const button = event.target.closest('.btn-editar-usuario');
      if (!button) return;

      const id = Number(button.dataset.id);
      if (!id) return;

      button.disabled = true;
      try {
        const res = await apiFetch(`/api/usuarios/${id}`, { cache: 'no-store' });
        const usuario = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(usuario.mensaje || 'No se pudo cargar el usuario.');

        document.getElementById('usuario-editar-id').value = usuario.id_usuario || id;
        document.getElementById('usuario-editar-id-persona').value = usuario.id_persona || '';
        document.getElementById('usuario-editar-nombre').value = usuario.nombre || '';
        document.getElementById('usuario-editar-apellido1').value = usuario.apellido1 || '';
        document.getElementById('usuario-editar-correo').value = usuario.correo || '';
        document.getElementById('usuario-editar-clave').value = '';

        const rolSelect = document.getElementById('usuario-editar-rol');
        const esSesionActual = Number(usuario.id_usuario) === Number(currentUser?.id_usuario);
        if (rolSelect) {
          rolSelect.value = String(Number(usuario.id_rol) || 2);
          rolSelect.disabled = esSesionActual;
        }
        document.getElementById('usuario-editar-rol-ayuda')?.classList.toggle('d-none', !esSesionActual);

        const modalEl = document.getElementById('modalEditarUsuario');
        if (modalEl && window.bootstrap?.Modal) {
          (window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl)).show();
        }
      } catch (error) {
        showToast(error.message || 'No se pudo cargar el usuario.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  if (!form || form.dataset.wired === 'true') return;
  form.dataset.wired = 'true';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = Number(document.getElementById('usuario-editar-id')?.value);
    const idPersona = Number(document.getElementById('usuario-editar-id-persona')?.value);
    const nombre = normalizarNombreUsuario(document.getElementById('usuario-editar-nombre')?.value);
    const apellido1 = normalizarNombreUsuario(document.getElementById('usuario-editar-apellido1')?.value);
    const correo = document.getElementById('usuario-editar-correo')?.value.trim().toLowerCase() || '';
    const rolSelect = document.getElementById('usuario-editar-rol');
    const contrasena = document.getElementById('usuario-editar-clave')?.value || '';
    const button = document.getElementById('btn-actualizar-usuario');

    if (!id || !nombre || !apellido1 || !correo) {
      showToast('Completa nombre, apellido y correo.', 'error');
      return;
    }

    if (!isSchoolEmail(correo)) {
      actualizarValidacionCorreoInstitucional('usuario-editar-correo', 'usuario-editar-correo-error');
      showToast('No se acepta ese correo. Utiliza el correo institucional indicado.', 'error', 4500);
      document.getElementById('usuario-editar-correo')?.focus();
      return;
    }

    if (contrasena && contrasena.length < 6) {
      showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    const payload = {
      nombre,
      primer_apellido: apellido1,
      correo,
      id_persona: idPersona
    };

    if (!rolSelect?.disabled) payload.id_rol = Number(rolSelect?.value || 2);
    if (contrasena) payload.contrasena = contrasena;

    const original = button?.innerHTML;
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
    }

    try {
      const res = await apiFetch(`/api/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || data.error || 'No se pudo actualizar el usuario.');

      if (Number(currentUser?.id_usuario) === id && data.usuario) {
        currentUser = {
          ...currentUser,
          nombre: data.usuario.nombre,
          apellido1: data.usuario.apellido1,
          correo: data.usuario.correo,
          rol: data.usuario.nom_rol || currentUser.rol
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
        window.EduControlCurrentUser = currentUser;
        renderUserInfo();
      }

      window.bootstrap?.Modal.getInstance(document.getElementById('modalEditarUsuario'))?.hide();
      await loadUsuariosData();
      showToast('Datos del usuario actualizados correctamente.', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar el usuario.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = original || '<i class="bi bi-save me-1"></i> Guardar cambios';
      }
    }
  });
}

async function loadUsuariosData() {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando usuarios...</td></tr>';
  }

  try {
    const res = await apiFetch(`/api/usuarios?_=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ([]));

    if (!res.ok) {
      throw new Error(data.mensaje || data.error || 'No se pudo cargar la lista de usuarios.');
    }

    usuariosCargados = Array.isArray(data) ? data : [];
    renderTablaUsuarios(usuariosCargados);
    return usuariosCargados;
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">${error.message || 'No se pudieron cargar los usuarios.'}</td></tr>`;
    }
    throw error;
  }
}


async function confirmarUsuarioEnLista(idUsuario, correoUsuario = '') {
  if (!idUsuario && !correoUsuario) return;

  const correoClave = String(correoUsuario || '').toLowerCase();
  const optimista = usuariosCargados.find((u) =>
    (idUsuario && Number(u.id_usuario) === Number(idUsuario)) ||
    (correoClave && String(u.correo || '').toLowerCase() === correoClave)
  );

  for (let intento = 0; intento < 6; intento += 1) {
    try {
      if (intento > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1200, 220 * (intento + 1))));
      }

      // El endpoint individual confirma primero que el INSERT fue persistido.
      if (idUsuario) {
        const detailRes = await apiFetch(`/api/usuarios/${idUsuario}?_=${Date.now()}-${intento}`, { cache: 'no-store' });
        if (detailRes.ok) {
          const detalle = await detailRes.json().catch(() => null);
          if (detalle?.id_usuario) {
            usuariosCargados = [
              ...usuariosCargados.filter((u) => Number(u.id_usuario) !== Number(detalle.id_usuario) && String(u.correo || '').toLowerCase() !== String(detalle.correo || '').toLowerCase()),
              detalle
            ];
            renderTablaUsuarios(usuariosCargados);
          }
        }
      }

      const res = await apiFetch(`/api/usuarios?_=${Date.now()}-${intento}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ([]));
      if (!res.ok || !Array.isArray(data)) continue;

      const yaVisible = data.some((u) =>
        (idUsuario && Number(u.id_usuario) === Number(idUsuario)) ||
        (correoClave && String(u.correo || '').toLowerCase() === correoClave)
      );
      if (!yaVisible) continue;

      usuariosCargados = data;
      renderTablaUsuarios(usuariosCargados);
      return;
    } catch (error) {
      console.warn('EduControl: sincronización diferida de usuarios:', error);
    }
  }

  // Nunca borrar de la UI la fila optimista si el servidor demoró en reflejar
  // la consulta. El usuario ya fue creado por el POST exitoso.
  if (optimista) {
    const existe = usuariosCargados.some((u) =>
      (idUsuario && Number(u.id_usuario) === Number(idUsuario)) ||
      (correoClave && String(u.correo || '').toLowerCase() === correoClave)
    );
    if (!existe) usuariosCargados.push(optimista);
    renderTablaUsuarios(usuariosCargados);
  }
}

function renderTablaUsuarios(usuarios) {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody) return;

  const usuariosPermisos = Array.isArray(usuarios)
    ? usuarios.filter((u) => [1, 2].includes(Number(u.id_rol)))
    : [];

  if (!usuariosPermisos.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay administradores o asistentes registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = usuariosPermisos.map((u) => {
    const idUsuario = Number(u.id_usuario);
    const esElMismo = idUsuario === Number(currentUser?.id_usuario);
    const esAdmin = Number(u.id_rol) === 1;
    const nombre = `${u.nombre || 'Usuario'} ${u.apellido1 || ''}`.trim();

    return `
      <tr data-usuario-id="${idUsuario}">
        <td><strong>${escapeHtml(nombre)}</strong>${esElMismo ? '<div class="small text-muted">Sesión actual</div>' : ''}</td>
        <td>${escapeHtml(u.correo || '—')}</td>
        <td>
          <span class="badge ${esAdmin ? 'bg-dark' : 'bg-info'} text-white px-2 py-1">
            ${esAdmin ? 'Administrador' : 'Asistente'}
          </span>
        </td>
        <td class="text-end">
          <div class="d-inline-flex gap-2 flex-wrap justify-content-end">
            <button type="button" class="btn btn-sm btn-outline-primary btn-editar-usuario" data-id="${idUsuario}">
              <i class="bi bi-pencil-square"></i> Modificar
            </button>
            ${esElMismo ? `
              <span class="badge bg-light text-dark border align-self-center">Sesión Actual</span>
            ` : `
              <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-usuario" data-id="${idUsuario}">
                <i class="bi bi-trash"></i> Eliminar
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

  const reducedMotionBtn =
    document.getElementById(
      'btn-toggle-reduced-motion'
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
    !reducedMotionBtn ||
    !resetBtn ||
    !fontRange ||
    !fontValue
  ) {
    return;
  }

  // Sincroniza el estado interno con lo guardado antes de conectar controles.
  // main.jsx aplica el tema muy temprano para evitar destellos, pero este módulo
  // también necesita conocer exactamente esos mismos valores.
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}');
    accessibilitySettings = {
      isDark: Boolean(saved.isDark),
      highContrast: Boolean(saved.highContrast),
      reducedMotion: Boolean(saved.reducedMotion),
      fontSize: Math.min(160, Math.max(90, Number(saved.fontSize) || 100))
    };
  } catch {
    accessibilitySettings = {
      isDark: document.body.classList.contains('theme-dark'),
      highContrast: document.body.classList.contains('high-contrast'),
      reducedMotion: document.body.classList.contains('reduced-motion'),
      fontSize: 100
    };
  }

  applyAccessibilitySettings();

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

  reducedMotionBtn.addEventListener(
    'click',
    () => {
      accessibilitySettings.reducedMotion =
        !accessibilitySettings.reducedMotion;

      applyAccessibilitySettings();

      menu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  );

  resetBtn.addEventListener(
    'click',
    () => {
      accessibilitySettings = {
        isDark: false,
        highContrast: false,
        reducedMotion: false,
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

  if (document.documentElement.dataset.eduAccessibilityStorage !== '1') {
    document.documentElement.dataset.eduAccessibilityStorage = '1';
    window.addEventListener('storage', (event) => {
      if (event.key !== ACCESSIBILITY_KEY) return;
      restoreAccessibilitySettings();
    });
  }

  updateAccessibilityControls();
}

function applyAccessibilitySettings() {
  document.body.classList.toggle(
    'theme-dark',
    accessibilitySettings.isDark
  );

  document.documentElement.classList.toggle(
    'theme-dark',
    accessibilitySettings.isDark
  );

  document.documentElement.setAttribute(
    'data-bs-theme',
    accessibilitySettings.isDark ? 'dark' : 'light'
  );

  document.documentElement.style.colorScheme =
    accessibilitySettings.isDark ? 'dark' : 'light';

  document.body.classList.toggle(
    'high-contrast',
    accessibilitySettings.highContrast
  );

  document.body.classList.toggle(
    'reduced-motion',
    accessibilitySettings.reducedMotion
  );

  document.documentElement.classList.toggle(
    'reduced-motion',
    accessibilitySettings.reducedMotion
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

    if (saved && typeof saved === 'object') {
      accessibilitySettings = {
        isDark: Boolean(saved.isDark),
        highContrast: Boolean(saved.highContrast),
        reducedMotion: Boolean(saved.reducedMotion),
        fontSize: Math.min(160, Math.max(90, Number(saved.fontSize) || 100))
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

  const reducedMotionBtn =
    document.getElementById(
      'btn-toggle-reduced-motion'
    );

  const themeLabel = document.getElementById('accessibility-theme-label');
  const contrastLabel = document.getElementById('accessibility-contrast-label');
  const motionLabel = document.getElementById('accessibility-motion-label');

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
    !reducedMotionBtn ||
    !fontRange ||
    !fontValue
  ) {
    return;
  }

  if (themeLabel) {
    themeLabel.textContent = accessibilitySettings.isDark ? 'Modo claro' : 'Modo oscuro';
  }
  if (contrastLabel) {
    contrastLabel.textContent = accessibilitySettings.highContrast ? 'Contraste normal' : 'Alto contraste';
  }
  if (motionLabel) {
    motionLabel.textContent = accessibilitySettings.reducedMotion ? 'Movimiento reducido' : 'Reducir movimiento';
  }

  themeBtn.setAttribute('aria-pressed', String(accessibilitySettings.isDark));
  contrastBtn.setAttribute('aria-pressed', String(accessibilitySettings.highContrast));
  reducedMotionBtn.setAttribute('aria-pressed', String(accessibilitySettings.reducedMotion));

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

  reducedMotionBtn.classList.toggle(
    'accessibility-action-active',
    accessibilitySettings.reducedMotion
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