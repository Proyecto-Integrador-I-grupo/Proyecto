(function () {
  const moduleName = 'perfil';
  window.EduControlModules = window.EduControlModules || {};
  
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;

      cargarDatosPerfil();
      configurarEventosPerfil();
    }
  };

  function cargarDatosPerfil() {
    const user = currentUser; // Objeto global de sesión en ui.js
    if (!user) return;

    // Rellenar campos de texto con la información real del usuario logueado
    const inputNombre = document.getElementById('perfil-nombre');
    const inputApellido1 = document.getElementById('perfil-apellido1');
    const inputApellido2 = document.getElementById('perfil-apellido2');
    const inputCorreo = document.getElementById('perfil-correo');

    if (inputNombre) inputNombre.value = user.nombre || '';
    if (inputApellido1) inputApellido1.value = user.apellido1 || '';
    if (inputApellido2) inputApellido2.value = user.apellido2 || '';
    if (inputCorreo) inputCorreo.value = user.correo || '';

    // Cargar imagen de perfil si existe
    if (user.foto) {
      actualizarVistaFoto(user.foto);
    }
  }

  function actualizarVistaFoto(fotoUrlOrBase64) {
    const imgPreview = document.getElementById('perfil-foto-preview');
    if (imgPreview) {
      imgPreview.src = fotoUrlOrBase64;
    }

    const avatarContenedores = document.querySelectorAll('#topbar-avatar, #sidebar-avatar');
    avatarContenedores.forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = fotoUrlOrBase64;
      } else {
        el.style.backgroundImage = `url(${fotoUrlOrBase64})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = ''; // Limpia las iniciales (como "SA") si hay foto
      }
    });
  }

  function configurarEventosPerfil() {
    // 1. Manejo de selección de archivo de foto (Previsualización local antes de guardar)
    const inputFoto = document.getElementById('perfil-foto-input');
    if (inputFoto) {
      inputFoto.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const base64Image = uploadEvent.target.result;
            actualizarVistaFoto(base64Image);
            window.tempNuevaFoto = base64Image; // Guardamos temporalmente para enviar al backend
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // 2. Formulario de guardar cambios del perfil (usa id="perfil-form" según tu HTML)
    const form = document.getElementById('perfil-form');
    if (form && !form.dataset.listenerWired) {
      form.dataset.listenerWired = 'true';
      form.onsubmit = async (e) => {
        e.preventDefault();
        await guardarCambiosPerfil();
      };
    }
  }

  async function guardarCambiosPerfil() {
    const nombre = document.getElementById('perfil-nombre')?.value || '';
    const apellido1 = document.getElementById('perfil-apellido1')?.value || '';
    const apellido2 = document.getElementById('perfil-apellido2')?.value || '';
    const correo = document.getElementById('perfil-correo')?.value || '';
    
    const pwdActual = document.getElementById('perfil-clave-actual')?.value || '';
    const pwdNueva = document.getElementById('perfil-clave-nueva')?.value || '';
    const pwdConfirmar = document.getElementById('perfil-clave-confirmar')?.value || '';

    // Validar coincidencia de nuevas contraseñas solo si se intenta cambiar
    if (pwdNueva || pwdConfirmar) {
      if (pwdNueva !== pwdConfirmar) {
        showToast('Las nuevas contraseñas no coinciden.', 'error');
        return;
      }
      if (!pwdActual) {
        showToast('Debes ingresar tu clave actual para establecer una nueva.', 'error');
        return;
      }
    }

    try {
      // Actualizar datos personales y foto (la contraseña ya NO es obligatoria aquí)
      const payloadPersona = {
        nombre,
        apellido1,
        apellido2,
        fecha_nacimiento: currentUser.fecha_nacimiento || '2000-01-01',
        genero: currentUser.genero || 'O'
      };

      if (window.tempNuevaFoto) {
        payloadPersona.foto = window.tempNuevaFoto;
      }

      const resPersona = await apiFetch(`/api/personas/${currentUser.id_persona}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadPersona)
      });

      if (!resPersona.ok) throw new Error('Error al actualizar los datos personales.');

      // Si el usuario decidió cambiar la contraseña, la actualizamos en el endpoint de usuarios
      if (pwdNueva) {
        const resUsuario = await apiFetch(`/api/usuarios/${currentUser.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correo,
            contrasena: pwdNueva,
            id_persona: currentUser.id_persona,
            id_rol: currentUser.id_rol,
            estado: 1
          })
        });
        if (!resUsuario.ok) throw new Error('Error al actualizar la contraseña.');
      } else if (correo && correo !== currentUser.correo) {
        // Si solo cambió el correo sin tocar la contraseña
        const resUsuario = await apiFetch(`/api/usuarios/${currentUser.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correo,
            contrasena: currentUser.contrasena,
            id_persona: currentUser.id_persona,
            id_rol: currentUser.id_rol,
            estado: 1
          })
        });
        if (!resUsuario.ok) throw new Error('Error al actualizar el correo.');
      }

      showToast('Perfil actualizado correctamente.', 'success');
      
      // Actualizar sesión local con los nuevos cambios
      currentUser.nombre = nombre;
      currentUser.apellido1 = apellido1;
      currentUser.apellido2 = apellido2;
      currentUser.correo = correo;
      if (window.tempNuevaFoto) {
        currentUser.foto = window.tempNuevaFoto;
      }
      
      sessionStorage.setItem('educontrol_usuario', JSON.stringify(currentUser));
      
      // Limpiar campos de contraseña por seguridad
      const inputActual = document.getElementById('perfil-clave-actual');
      const inputNueva = document.getElementById('perfil-clave-nueva');
      const inputConfirmar = document.getElementById('perfil-clave-confirmar');
      if (inputActual) inputActual.value = '';
      if (inputNueva) inputNueva.value = '';
      if (inputConfirmar) inputConfirmar.value = '';

      window.tempNuevaFoto = null;
      renderUserInfo(); // Refresca barra superior y menú lateral
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();