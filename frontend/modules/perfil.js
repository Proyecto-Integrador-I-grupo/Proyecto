(function () {
  const moduleName = 'perfil';
  window.EduControlModules = window.EduControlModules || {};

  let fotoPerfilTemporal = null;
  let perfilActual = null;
  let claveCamposModificados = false;

  window.EduControlModules[moduleName] = {
    name: moduleName,

    init() {
      const section =
        document.getElementById(
          `${moduleName}-view`
        );

      if (!section) {
        return;
      }

      const usuarioSesionId =
        typeof currentUser !== 'undefined'
          ? currentUser?.id_usuario
          : null;

      if (
        section.dataset.usuarioId !==
        String(usuarioSesionId)
      ) {
        section.dataset.wired = '';
      }

      if (
        section.dataset.wired === '1' &&
        section.dataset.usuarioId ===
          String(usuarioSesionId)
      ) {
        return;
      }

      section.dataset.wired = '1';
      section.dataset.usuarioId =
        usuarioSesionId
          ? String(usuarioSesionId)
          : '';
      section.dataset.module =
        moduleName;

      fotoPerfilTemporal = null;
      perfilActual = null;
      window.tempNuevaFoto = null;
      claveCamposModificados = false;

      conectarEventosPerfil();
      cargarMiPerfil();
    }
  };

  function cargarDatosPerfil() {
    const user =
      typeof currentUser !== 'undefined'
        ? currentUser
        : null;

    if (!user) {
      return;
    }

    const inputNombre =
      document.getElementById(
        'perfil-nombre'
      );

    const inputApellido1 =
      document.getElementById(
        'perfil-apellido1'
      );

    const inputApellido2 =
      document.getElementById(
        'perfil-apellido2'
      );

    const inputCorreo =
      document.getElementById(
        'perfil-correo'
      );

    if (inputNombre) {
      inputNombre.value =
        user.nombre || '';
    }

    if (inputApellido1) {
      inputApellido1.value =
        user.apellido1 || '';
    }

    if (inputApellido2) {
      inputApellido2.value =
        user.apellido2 || '';
    }

    if (inputCorreo) {
      inputCorreo.value =
        user.correo || '';
    }

    if (user.foto) {
      actualizarImagenPerfil(
        user.foto
      );
    } else {
      generarAvatarIniciales(
        user
      );
    }
  }

  function actualizarVistaFoto(
    fotoUrlOrBase64
  ) {
    actualizarImagenPerfil(
      fotoUrlOrBase64
    );
  }

  function configurarVisorContrasenas(
    inputId,
    toggleId
  ) {
    const input =
      document.getElementById(
        inputId
      );

    const toggleBtn =
      document.getElementById(
        toggleId
      );

    if (input && toggleBtn) {
      toggleBtn.onclick = () => {
        const esPassword =
          input.type === 'password';

        input.type = esPassword
          ? 'text'
          : 'password';

        const icono =
          toggleBtn.querySelector(
            'i'
          );

        if (icono) {
          icono.className =
            esPassword
              ? 'bi bi-eye-slash'
              : 'bi bi-eye';
        }
      };
    }
  }

  function conectarEventosPerfil() {
    const formulario =
      document.getElementById(
        'perfil-form'
      );

    const inputFoto =
      document.getElementById(
        'perfil-foto-input'
      );

    if (
      formulario &&
      !formulario.dataset.listenerWired
    ) {
      formulario.dataset.listenerWired =
        'true';
      formulario.addEventListener(
        'submit',
        guardarCambiosPerfil
      );
    }

    if (
      inputFoto &&
      !inputFoto.dataset.listenerWired
    ) {
      inputFoto.dataset.listenerWired =
        'true';
      inputFoto.addEventListener(
        'change',
        cambiarVistaPreviaFoto
      );
    }

    [
      'perfil-clave-actual',
      'perfil-clave-nueva',
      'perfil-clave-confirmar'
    ].forEach((id) => {
      const el =
        document.getElementById(
          id
        );
      if (
        el &&
        !el.dataset.listenerWired
      ) {
        el.dataset.listenerWired =
          'true';
        el.addEventListener(
          'input',
          () => {
            claveCamposModificados =
              true;
          }
        );
      }
    });

    configurarVisorContrasenas(
      'perfil-clave-actual',
      'toggle-clave-actual'
    );

    configurarVisorContrasenas(
      'perfil-clave-nueva',
      'toggle-clave-nueva'
    );

    configurarVisorContrasenas(
      'perfil-clave-confirmar',
      'toggle-clave-confirmar'
    );
  }

  async function cargarMiPerfil() {
    mostrarEstadoFormulario(true);

    try {
      const respuesta =
        await apiFetch(
          '/api/usuarios/perfil'
        );

      const datos =
        await obtenerRespuestaJson(
          respuesta
        );

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
            'No se pudo cargar la información del perfil.'
        );
      }

      perfilActual = datos;

      llenarFormularioPerfil(
        datos
      );

      actualizarResumenPerfil(
        datos
      );

      cargarFotoSegunUsuario(
        datos
      );
    } catch (error) {
      mostrarMensajePerfil(
        'error',
        'No se pudo cargar el perfil',
        error.message
      );
    } finally {
      mostrarEstadoFormulario(
        false
      );
    }
  }

  function llenarFormularioPerfil(
    perfil
  ) {
    asignarValor(
      'perfil-nombre',
      perfil.nombre
    );

    asignarValor(
      'perfil-apellido1',
      perfil.apellido1
    );

    asignarValor(
      'perfil-apellido2',
      perfil.apellido2
    );

    asignarValor(
      'perfil-correo',
      perfil.correo
    );
  }

  function actualizarResumenPerfil(
    perfil
  ) {
    const nombreCompleto =
      formarNombrePerfil(
        perfil
      ) || 'Usuario';

    const rol =
      perfil.rol ||
      perfil.nom_rol ||
      'Usuario';

    const correo =
      perfil.correo || '-';

    const nombreElemento =
      document.getElementById(
        'perfil-nombre-completo'
      );

    const rolElemento =
      document.getElementById(
        'perfil-rol'
      );

    const correoElemento =
      document.getElementById(
        'perfil-correo-info'
      );

    if (nombreElemento) {
      nombreElemento.textContent =
        nombreCompleto;
    }

    if (rolElemento) {
      rolElemento.textContent =
        rol;
    }

    if (correoElemento) {
      correoElemento.textContent =
        correo;
    }
  }

  async function guardarCambiosPerfil(
    evento
  ) {
    if (
      evento &&
      evento.preventDefault
    ) {
      evento.preventDefault();
    }

    const datosPerfil =
      obtenerDatosFormularioPerfil();

    if (
      !validarDatosPerfil(
        datosPerfil
      )
    ) {
      return;
    }

    const datosClave =
      obtenerDatosSeguridad();

    const deseaCambiarClave =
      claveCamposModificados &&
      Boolean(
        datosClave.claveActual ||
          datosClave.claveNueva ||
          datosClave.claveConfirmar
      );

    mostrarEstadoFormulario(
      true
    );

    try {
      if (
        fotoPerfilTemporal
      ) {
        datosPerfil.foto =
          fotoPerfilTemporal;
      } else if (
        window.tempNuevaFoto
      ) {
        datosPerfil.foto =
          window.tempNuevaFoto;
      }

      const resultadoPerfil =
        await actualizarDatosPersonales(
          datosPerfil
        );

      perfilActual =
        resultadoPerfil.perfil || {
          ...perfilActual,
          ...datosPerfil
        };

      actualizarResumenPerfil(
        perfilActual
      );

      if (deseaCambiarClave) {
        await actualizarClave(
          datosClave
        );

        limpiarCamposClave();
      }

      guardarFotoPerfil();

      if (
        fotoPerfilTemporal
      ) {
        actualizarImagenPerfil(
          fotoPerfilTemporal
        );
      }

      actualizarUsuarioGlobal(
        perfilActual
      );

      mostrarMensajePerfil(
        'success',
        'Perfil actualizado',
        deseaCambiarClave
          ? 'Tus datos y tu clave se actualizaron correctamente.'
          : 'Tus datos se actualizaron correctamente.'
      );
    } catch (error) {
      mostrarMensajePerfil(
        'error',
        'No se pudieron guardar los cambios',
        error.message
      );
    } finally {
      mostrarEstadoFormulario(
        false
      );
    }
  }

  async function actualizarDatosPersonales(
    datosPerfil
  ) {
    const respuesta =
      await apiFetch(
        '/api/usuarios/perfil',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(
            datosPerfil
          )
        }
      );

    const datos =
      await obtenerRespuestaJson(
        respuesta
      );

    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje ||
          'No se pudo actualizar el perfil.'
      );
    }

    return datos;
  }

  async function actualizarClave(
    datosClave
  ) {
    validarDatosClave(
      datosClave
    );

    const respuesta =
      await apiFetch(
        '/api/usuarios/perfil/clave',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(
            datosClave
          )
        }
      );

    const datos =
      await obtenerRespuestaJson(
        respuesta
      );

    if (!respuesta.ok) {
      throw new Error(
        datos.mensaje ||
          'No se pudo actualizar la clave.'
      );
    }

    return datos;
  }

  function obtenerDatosFormularioPerfil() {
    return {
      nombre: obtenerValor(
        'perfil-nombre'
      ).trim(),

      apellido1: obtenerValor(
        'perfil-apellido1'
      ).trim(),

      apellido2: obtenerValor(
        'perfil-apellido2'
      ).trim(),

      correo: obtenerValor(
        'perfil-correo'
      ).trim()
    };
  }

  function obtenerDatosSeguridad() {
    return {
      claveActual: obtenerValor(
        'perfil-clave-actual'
      ),

      claveNueva: obtenerValor(
        'perfil-clave-nueva'
      ),

      claveConfirmar:
        obtenerValor(
          'perfil-clave-confirmar'
        )
    };
  }

  function validarDatosPerfil(
    datos
  ) {
    if (
      !datos.nombre ||
      !datos.apellido1 ||
      !datos.correo
    ) {
      mostrarMensajePerfil(
        'warning',
        'Campos incompletos',
        'Completa el nombre, el primer apellido y el correo.'
      );

      return false;
    }

    const correoValido =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !correoValido.test(
        datos.correo
      )
    ) {
      mostrarMensajePerfil(
        'warning',
        'Correo no válido',
        'Escribe una dirección de correo válida.'
      );

      return false;
    }

    return true;
  }

  function validarDatosClave(
    datos
  ) {
    if (
      !datos.claveActual ||
      !datos.claveNueva ||
      !datos.claveConfirmar
    ) {
      throw new Error(
        'Para cambiar la clave debes completar los tres campos de seguridad.'
      );
    }

    if (
      datos.claveNueva !==
      datos.claveConfirmar
    ) {
      throw new Error(
        'La nueva clave y la confirmación no coinciden.'
      );
    }

    if (
      datos.claveNueva.length <
      8
    ) {
      throw new Error(
        'La nueva clave debe tener al menos 8 caracteres.'
      );
    }
  }

  function cambiarVistaPreviaFoto(
    evento
  ) {
    const archivo =
      evento.target.files?.[0];

    if (!archivo) return;

    if (
      !archivo.type.startsWith(
        'image/'
      )
    ) {
      mostrarMensajePerfil(
        'warning',
        'Archivo no válido',
        'Selecciona una imagen válida.'
      );

      evento.target.value = '';
      return;
    }

    const limiteBytes =
      2 * 1024 * 1024;

    if (
      archivo.size > limiteBytes
    ) {
      mostrarMensajePerfil(
        'warning',
        'Imagen demasiado grande',
        'La fotografía no puede superar 2 MB.'
      );

      evento.target.value = '';
      return;
    }

    const lector =
      new FileReader();

    lector.onload = () => {
      fotoPerfilTemporal =
        lector.result;

      const preview =
        document.getElementById(
          'perfil-foto-preview'
        );

      if (preview) {
        preview.src =
          fotoPerfilTemporal;
      }
    };

    lector.readAsDataURL(
      archivo
    );
  }

  function guardarFotoPerfil() {
    if (
      !fotoPerfilTemporal ||
      !perfilActual?.id_usuario
    ) {
      return;
    }

    try {
      localStorage.setItem(
        obtenerClaveFoto(
          perfilActual.id_usuario
        ),
        fotoPerfilTemporal
      );
    } catch (error) {
      console.warn(
        'No se pudo guardar la fotografía del perfil:',
        error
      );
    }
  }

  function cargarFotoSegunUsuario(
    perfil
  ) {
    if (!perfil?.id_usuario) {
      return;
    }

    if (perfil.foto) {
      fotoPerfilTemporal =
        perfil.foto;

      actualizarImagenPerfil(
        perfil.foto
      );

      return;
    }

    try {
      const fotoGuardada =
        localStorage.getItem(
          obtenerClaveFoto(
            perfil.id_usuario
          )
        );

      if (fotoGuardada) {
        fotoPerfilTemporal =
          fotoGuardada;

        actualizarImagenPerfil(
          fotoGuardada
        );

        return;
      }
    } catch (error) {
      console.warn(
        'No se pudo cargar la fotografía del perfil:',
        error
      );
    }

    generarAvatarIniciales(
      perfil
    );
  }

  function generarAvatarIniciales(
    perfil
  ) {
    fotoPerfilTemporal = null;
    window.tempNuevaFoto = null;

    const inicialNombre =
      perfil?.nombre?.charAt(
        0
      ) || 'U';

    const inicialApellido =
      perfil?.apellido1?.charAt(
        0
      ) || '';

    const iniciales =
      `${inicialNombre}${inicialApellido}`.toUpperCase();

    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="200"
        height="200">

        <rect
          width="100%"
          height="100%"
          fill="#0f3d6e">
        </rect>

        <text
          x="50%"
          y="53%"
          dominant-baseline="middle"
          text-anchor="middle"
          fill="#ffffff"
          font-family="Arial, sans-serif"
          font-size="72"
          font-weight="700">
          ${iniciales}
        </text>
      </svg>
    `;

    const avatar = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      svg
    )}`;

    const avatarContenedores =
      document.querySelectorAll(
        '#topbar-avatar, #sidebar-avatar, .user-avatar'
      );

    avatarContenedores.forEach(
      (el) => {
        if (
          el.tagName !== 'IMG'
        ) {
          el.style.backgroundImage =
            '';
        }
      }
    );

    actualizarImagenPerfil(
      avatar
    );
  }

  function actualizarImagenPerfil(
    imagen
  ) {
    const preview =
      document.getElementById(
        'perfil-foto-preview'
      );

    if (preview) {
      preview.src = imagen;
    }

    const avatarContenedores =
      document.querySelectorAll(
        '#topbar-avatar, #sidebar-avatar, .user-avatar'
      );

    avatarContenedores.forEach(
      (el) => {
        if (
          el.tagName === 'IMG'
        ) {
          el.src = imagen;
        } else if (el) {
          el.style.backgroundImage = `url(${imagen})`;
          el.style.backgroundSize =
            'cover';
          el.style.backgroundPosition =
            'center';
          el.textContent = '';
        }
      }
    );
  }

  function actualizarUsuarioGlobal(
    perfil
  ) {
    if (
      typeof currentUser ===
        'undefined' ||
      !currentUser
    ) {
      return;
    }

    currentUser.nombre =
      perfil.nombre;

    currentUser.apellido1 =
      perfil.apellido1;

    currentUser.apellido2 =
      perfil.apellido2;

    currentUser.correo =
      perfil.correo;

    if (fotoPerfilTemporal) {
      currentUser.foto =
        fotoPerfilTemporal;
    }

    try {
      localStorage.setItem(
        'currentUser',
        JSON.stringify(
          currentUser
        )
      );

      sessionStorage.setItem(
        'educontrol_usuario',
        JSON.stringify(
          currentUser
        )
      );
    } catch (error) {
      console.warn(
        'No se pudo actualizar el usuario local:',
        error
      );
    }

    actualizarNombreEnInterfaz(
      perfil
    );

    if (
      typeof renderUserInfo ===
      'function'
    ) {
      renderUserInfo();
    }
  }

  function actualizarNombreEnInterfaz(
    perfil
  ) {
    const nombreCompleto =
      formarNombrePerfil(
        perfil
      );

    const selectores = [
      '#user-name',
      '#usuario-nombre',
      '#sidebar-user-name',
      '[data-user-name]'
    ];

    selectores.forEach(
      (selector) => {
        document
          .querySelectorAll(
            selector
          )
          .forEach((elemento) => {
            elemento.textContent =
              nombreCompleto;
          });
      }
    );
  }

  function limpiarCamposClave() {
    claveCamposModificados =
      false;

    asignarValor(
      'perfil-clave-actual',
      ''
    );

    asignarValor(
      'perfil-clave-nueva',
      ''
    );

    asignarValor(
      'perfil-clave-confirmar',
      ''
    );
  }

  function mostrarEstadoFormulario(
    cargando
  ) {
    const formulario =
      document.getElementById(
        'perfil-form'
      );

    const boton =
      formulario?.querySelector(
        'button[type="submit"]'
      );

    formulario
      ?.querySelectorAll(
        'input, button'
      )
      .forEach((elemento) => {
        elemento.disabled =
          cargando;
      });

    if (!boton) return;

    boton.innerHTML = cargando
      ? `
          <span
            class="spinner-border spinner-border-sm me-2">
          </span>
          Guardando...
        `
      : `
          <i class="bi bi-check2-circle"></i>
          Guardar cambios
        `;
  }

  function formarNombrePerfil(
    perfil
  ) {
    return `${
      perfil?.nombre ?? ''
    } ${
      perfil?.apellido1 ?? ''
    } ${
      perfil?.apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
  }

  function obtenerValor(id) {
    return (
      document.getElementById(id)
        ?.value || ''
    );
  }

  function asignarValor(
    id,
    valor
  ) {
    const elemento =
      document.getElementById(
        id
      );

    if (elemento) {
      elemento.value =
        valor ?? '';
    }
  }

  function obtenerClaveFoto(
    idUsuario
  ) {
    return `educontrol-perfil-foto-${idUsuario}`;
  }

  async function obtenerRespuestaJson(
    respuesta
  ) {
    try {
      return (
        await respuesta.json()
      );
    } catch {
      return {};
    }
  }

  function mostrarMensajePerfil(
    tipo,
    titulo,
    mensaje
  ) {
    if (
      typeof showResultModal ===
      'function'
    ) {
      showResultModal(
        tipo,
        titulo,
        mensaje
      );

      return;
    }

    if (
      typeof showToast ===
      'function'
    ) {
      showToast(
        mensaje,
        tipo === 'success'
          ? 'success'
          : 'error'
      );

      return;
    }

    alert(mensaje);
  }

  if (
    document.readyState !==
    'loading'
  ) {
    window.dispatchEvent(
      new CustomEvent(
        'app:module-ready',
        {
          detail: {
            module: moduleName
          }
        }
      )
    );
  }
})();