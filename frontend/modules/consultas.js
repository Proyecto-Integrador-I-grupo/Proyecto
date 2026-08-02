(function () {
  const moduleName = 'consultas';

  let estudiantes = [];
  let profesores = [];

  window.EduControlModules = window.EduControlModules || {};

  window.EduControlModules[moduleName] = {
    name: moduleName,

    init() {
      const section = document.getElementById('consultas-view');
      if (!section || section.dataset.wired === '1') return;

      section.dataset.wired = '1';

      conectarEventos();
      cargarConsultas();
    }
  };

  function conectarEventos() {
    const tipo = document.getElementById('consulta-tipo');
    const busqueda = document.getElementById('consulta-busqueda');
    const estado = document.getElementById('consulta-estado');
    const limpiar = document.getElementById('consulta-limpiar');
    const refrescar = document.getElementById('consulta-refrescar');
    const tablaBody = document.getElementById('consulta-tabla-body');
const modificarDetalle = document.getElementById('consulta-detalle-modificar');

    tipo?.addEventListener('change', actualizarConsulta);
    busqueda?.addEventListener('input', actualizarConsulta);
    estado?.addEventListener('change', actualizarConsulta);
    refrescar?.addEventListener('click', cargarConsultas);

    limpiar?.addEventListener('click', () => {
      if (busqueda) busqueda.value = '';
      if (estado) estado.value = '';
      actualizarConsulta();

      tablaBody?.addEventListener('click', manejarAccionesTabla);
modificarDetalle?.addEventListener('click', modificarDesdeDetalle);
    });
  }

  async function cargarConsultas() {
    mostrarCargando();

    try {
      const [resEstudiantes, resProfesores] = await Promise.all([
        apiFetch('/api/estudiantes'),
        apiFetch('/api/profesores')
      ]);

      if (!resEstudiantes.ok) {
        throw new Error('No se pudieron cargar los estudiantes.');
      }

      if (!resProfesores.ok) {
        throw new Error('No se pudieron cargar los profesores.');
      }

      estudiantes = await resEstudiantes.json();
      profesores = await resProfesores.json();

      actualizarResumen();
      actualizarConsulta();
    } catch (error) {
      mostrarError(error.message || 'No se pudo cargar la información.');
    }
  }

  function actualizarResumen() {
    const totalEstudiantes = document.getElementById('consulta-total-estudiantes');
    const totalProfesores = document.getElementById('consulta-total-profesores');

    if (totalEstudiantes) {
      totalEstudiantes.textContent = estudiantes.length;
    }

    if (totalProfesores) {
      totalProfesores.textContent = profesores.length;
    }
  }

  function actualizarConsulta() {
    const tipo = document.getElementById('consulta-tipo')?.value || 'estudiantes';

    if (tipo === 'estudiantes') {
      mostrarEstudiantes();
      return;
    }

    if (tipo === 'profesores') {
      mostrarProfesores();
      return;
    }

    mostrarPendiente(tipo);
  }

  function mostrarEstudiantes() {
    const busqueda = obtenerBusqueda();
    const estado = obtenerEstado();

    const resultados = estudiantes.filter((estudiante) => {
      const nombreCompleto = formarNombre(estudiante).toLowerCase();
      const activo = estudiante.estado == 1 || estudiante.estado === true || estudiante.estado === undefined;

      const coincideNombre = !busqueda || nombreCompleto.includes(busqueda);
      const coincideEstado =
        !estado ||
        (estado === 'activo' && activo) ||
        (estado === 'inactivo' && !activo);

      return coincideNombre && coincideEstado;
    });

    actualizarTitulo('Estudiantes registrados', resultados.length);

    cambiarEncabezado(`
      <tr>
        <th>ID</th>
        <th>Nombre completo</th>
        <th>Nacimiento</th>
        <th>Ingreso</th>
        <th>Estado</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(6);
      return;
    }

    const body = document.getElementById('consulta-tabla-body');
    body.innerHTML = '';

    resultados.forEach((estudiante) => {
      const id = estudiante.id_estudiante ?? estudiante.id ?? '';
      const nombre = formarNombre(estudiante);
      const nacimiento = limpiarFecha(estudiante.fecha_nacimiento);
      const ingreso = limpiarFecha(estudiante.fecha_ingreso);
      const activo = estudiante.estado == 1 || estudiante.estado === true || estudiante.estado === undefined;

      const fila = document.createElement('tr');

      fila.innerHTML = `
        <td>${id}</td>
        <td>${nombre || '-'}</td>
        <td>${nacimiento}</td>
        <td>${ingreso}</td>
        <td>
          <span class="badge ${activo ? 'bg-success' : 'bg-secondary'}">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="text-end">
  <div class="d-inline-flex gap-1">
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary consulta-ver-estudiante"
      data-id="${id}">
      <i class="bi bi-eye"></i>
      Ver
    </button>

    <button
      type="button"
      class="btn btn-sm btn-outline-primary consulta-editar-estudiante"
      data-id="${id}">
      <i class="bi bi-pencil"></i>
      Modificar
    </button>
  </div>
</td>
      `;

      body.appendChild(fila);
    });
  }

  function mostrarProfesores() {
    const busqueda = obtenerBusqueda();
    const estado = obtenerEstado();

    const resultados = profesores.filter((profesor) => {
      const texto = `${formarNombre(profesor)} ${profesor.materia ?? ''}`.toLowerCase();
      const activo = profesor.estado == 1 || profesor.estado === true;

      const coincideBusqueda = !busqueda || texto.includes(busqueda);
      const coincideEstado =
        !estado ||
        (estado === 'activo' && activo) ||
        (estado === 'inactivo' && !activo);

      return coincideBusqueda && coincideEstado;
    });

    actualizarTitulo('Profesores registrados', resultados.length);

    cambiarEncabezado(`
      <tr>
        <th>ID</th>
        <th>Nombre completo</th>
        <th>Materia</th>
        <th>Ingreso</th>
        <th>Estado</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(6);
      return;
    }

    const body = document.getElementById('consulta-tabla-body');
    body.innerHTML = '';

    resultados.forEach((profesor) => {
      const id = profesor.id_profesor ?? profesor.id ?? '';
      const nombre = formarNombre(profesor);
      const materia = profesor.materia ?? 'Sin asignar';
      const ingreso = limpiarFecha(profesor.fecha_ingreso);
      const activo = profesor.estado == 1 || profesor.estado === true;

      const fila = document.createElement('tr');

      fila.innerHTML = `
        <td>${id}</td>
        <td>${nombre || '-'}</td>
        <td>${materia}</td>
        <td>${ingreso}</td>
        <td>
          <span class="badge ${activo ? 'bg-success' : 'bg-danger'}">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="text-end">
          <button
  type="button"
  class="btn btn-sm btn-outline-secondary consulta-ver-profesor"
  data-id="${id}">
  <i class="bi bi-eye"></i>
  Ver
</button>
        </td>
      `;

      body.appendChild(fila);
    });
  }

  function mostrarPendiente(tipo) {
    const nombres = {
      matriculas: 'Matrículas',
      asistencia: 'Asistencia'
    };

    actualizarTitulo(nombres[tipo] || 'Consulta', 0);

    cambiarEncabezado(`
      <tr>
        <th>Información</th>
      </tr>
    `);

    const body = document.getElementById('consulta-tabla-body');

    body.innerHTML = `
      <tr>
        <td class="text-center py-5 text-muted">
          <i class="bi bi-tools fs-2 d-block mb-2"></i>
          Esta consulta se conectará en el siguiente avance.
        </td>
      </tr>
    `;
  }

  async function manejarAccionesTabla(evento) {
  const verEstudiante = evento.target.closest('.consulta-ver-estudiante');
  const editarEstudiante = evento.target.closest('.consulta-editar-estudiante');
  const verProfesor = evento.target.closest('.consulta-ver-profesor');

  if (verEstudiante) {
    await mostrarDetalleEstudiante(verEstudiante.dataset.id);
    return;
  }

  if (editarEstudiante) {
    await abrirEdicionEstudiante(editarEstudiante.dataset.id);
    return;
  }

  if (verProfesor) {
    mostrarDetalleProfesor(verProfesor.dataset.id);
  }
}

async function mostrarDetalleEstudiante(id) {
  const contenido = document.getElementById('consulta-detalle-contenido');
  const titulo = document.getElementById('consulta-detalle-titulo');
  const modificar = document.getElementById('consulta-detalle-modificar');

  if (!contenido || !titulo || !modificar) return;

  titulo.textContent = 'Información del estudiante';
  contenido.innerHTML = `
    <div class="text-center py-4 text-muted">
      <span class="spinner-border spinner-border-sm me-2"></span>
      Cargando información...
    </div>
  `;

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  abrirModalDetalle();

  try {
    const respuesta = await apiFetch(`/api/estudiantes/${id}`);

    if (!respuesta.ok) {
      throw new Error('No se pudo obtener la información del estudiante.');
    }

    const estudiante = await respuesta.json();
    const activo =
      estudiante.estado == 1 ||
      estudiante.estado === true ||
      estudiante.estado === undefined;

    contenido.innerHTML = `
      <div class="row g-3">
        ${crearCampoDetalle('Identificación', estudiante.id_estudiante ?? estudiante.id ?? '-')}
        ${crearCampoDetalle('Nombre completo', formarNombre(estudiante) || '-')}
        ${crearCampoDetalle('Fecha de nacimiento', limpiarFecha(estudiante.fecha_nacimiento))}
        ${crearCampoDetalle('Fecha de ingreso', limpiarFecha(estudiante.fecha_ingreso))}
        ${crearCampoDetalle('Género', mostrarGenero(estudiante.genero))}
        ${crearCampoDetalle(
          'Estado',
          activo
            ? '<span class="badge bg-success">Activo</span>'
            : '<span class="badge bg-secondary">Inactivo</span>'
        )}
      </div>
    `;

    modificar.dataset.id = id;

modificar.classList.remove('hidden');
  } catch (error) {
    contenido.innerHTML = `
      <div class="text-center py-4 text-danger">
        <i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>
        ${error.message}
      </div>
    `;
  }
}

function mostrarDetalleProfesor(id) {
  const profesor = profesores.find((item) => {
    return String(item.id_profesor ?? item.id) === String(id);
  });

  const contenido = document.getElementById('consulta-detalle-contenido');
  const titulo = document.getElementById('consulta-detalle-titulo');
  const modificar = document.getElementById('consulta-detalle-modificar');

  if (!contenido || !titulo || !modificar) return;

  titulo.textContent = 'Información del profesor';
  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  if (!profesor) {
    contenido.innerHTML = `
      <div class="text-center py-4 text-danger">
        No se encontró la información del profesor.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  const activo = profesor.estado == 1 || profesor.estado === true;

  contenido.innerHTML = `
    <div class="row g-3">
      ${crearCampoDetalle('Identificación', profesor.id_profesor ?? profesor.id ?? '-')}
      ${crearCampoDetalle('Nombre completo', formarNombre(profesor) || '-')}
      ${crearCampoDetalle('Materia', profesor.materia ?? 'Sin asignar')}
      ${crearCampoDetalle('Fecha de ingreso', limpiarFecha(profesor.fecha_ingreso))}
      ${crearCampoDetalle(
        'Estado',
        activo
          ? '<span class="badge bg-success">Activo</span>'
          : '<span class="badge bg-danger">Inactivo</span>'
      )}
    </div>

    <div class="alert alert-light border mt-4 mb-0 small">
      <i class="bi bi-info-circle me-1"></i>
      La gestión del profesor se realiza desde el módulo de Profesores.
    </div>
  `;

  abrirModalDetalle();
}

async function abrirEdicionEstudiante(id) {
  try {
    const respuesta = await apiFetch(`/api/estudiantes/${id}`);

    if (!respuesta.ok) {
      throw new Error('No se pudo obtener la información del estudiante.');
    }

    const estudiante = await respuesta.json();

    document.getElementById('persona-id').value =
      estudiante.id_estudiante ?? estudiante.id ?? '';

    document.getElementById('nombre').value =
      estudiante.nombre ?? '';

    document.getElementById('apellido1').value =
      estudiante.apellido1 ?? '';

    document.getElementById('apellido2').value =
      estudiante.apellido2 ?? '';

    document.getElementById('fecha_nacimiento').value =
      estudiante.fecha_nacimiento
        ? String(estudiante.fecha_nacimiento).split('T')[0]
        : '';

    document.getElementById('genero').value =
      estudiante.genero ?? '';

    const ingreso = document.getElementById('persona-fecha-ingreso');

    if (ingreso) {
      ingreso.value = estudiante.fecha_ingreso
        ? String(estudiante.fecha_ingreso).split('T')[0]
        : '';
    }

    const titulo = document.getElementById('persona-form-title');

    if (titulo) {
      titulo.textContent = 'Editar Estudiante';
    }

    const botonGuardar = document.getElementById('persona-submit');

    if (botonGuardar) {
      botonGuardar.innerHTML =
        '<i class="bi bi-check2-circle"></i> Guardar Cambios';
    }

    bootstrap.Modal
      .getInstance(document.getElementById('modalDetalleConsulta'))
      ?.hide();

    const modalEstudiante = document.getElementById('modalEstudiante');

    if (modalEstudiante) {
      new bootstrap.Modal(modalEstudiante).show();
    }
  } catch (error) {
    mostrarMensajeConsulta(error.message);
  }
}

function modificarDesdeDetalle() {
  const boton = document.getElementById('consulta-detalle-modificar');
  const id = boton?.dataset.id;

  if (id) {
    abrirEdicionEstudiante(id);
  }
}

function abrirModalDetalle() {
  const modal = document.getElementById('modalDetalleConsulta');

  if (!modal) return;

  const instancia =
    bootstrap.Modal.getInstance(modal) ||
    new bootstrap.Modal(modal);

  instancia.show();
}

function crearCampoDetalle(etiqueta, valor) {
  return `
    <div class="col-md-6">
      <div class="bg-white border rounded p-3 h-100">
        <span class="text-muted small d-block mb-1">${etiqueta}</span>
        <div class="fw-semibold">${valor}</div>
      </div>
    </div>
  `;
}

function mostrarGenero(genero) {
  const generos = {
    M: 'Masculino',
    F: 'Femenino',
    O: 'Otro'
  };

  return generos[genero] || genero || '-';
}

function mostrarMensajeConsulta(mensaje) {
  if (typeof showResultModal === 'function') {
    showResultModal('error', 'No se pudo realizar la acción', mensaje);
    return;
  }

  alert(mensaje);
}

  function mostrarCargando() {
    const body = document.getElementById('consulta-tabla-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <span class="spinner-border spinner-border-sm me-2"></span>
          Cargando información...
        </td>
      </tr>
    `;
  }

  function mostrarError(mensaje) {
    const body = document.getElementById('consulta-tabla-body');
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>
          ${mensaje}
        </td>
      </tr>
    `;
  }

  function mostrarSinResultados(columnas) {
    const body = document.getElementById('consulta-tabla-body');

    body.innerHTML = `
      <tr>
        <td colspan="${columnas}" class="text-center py-5 text-muted">
          <i class="bi bi-search fs-2 d-block mb-2"></i>
          No se encontraron resultados.
        </td>
      </tr>
    `;
  }

  function actualizarTitulo(titulo, cantidad) {
    const tituloTabla = document.getElementById('consulta-titulo-tabla');
    const cantidadTexto = document.getElementById('consulta-cantidad');

    if (tituloTabla) tituloTabla.textContent = titulo;

    if (cantidadTexto) {
      cantidadTexto.textContent = `${cantidad} resultado${cantidad === 1 ? '' : 's'} encontrado${cantidad === 1 ? '' : 's'}`;
    }
  }

  function cambiarEncabezado(contenido) {
    const head = document.getElementById('consulta-tabla-head');
    if (head) head.innerHTML = contenido;
  }

  function obtenerBusqueda() {
    return document.getElementById('consulta-busqueda')?.value.trim().toLowerCase() || '';
  }

  function obtenerEstado() {
    return document.getElementById('consulta-estado')?.value || '';
  }

  function formarNombre(persona) {
    return `${persona.nombre ?? ''} ${persona.apellido1 ?? ''} ${persona.apellido2 ?? ''}`.trim();
  }

  function limpiarFecha(fecha) {
    return fecha ? String(fecha).split('T')[0] : '-';
  }

  if (document.readyState !== 'loading') {
    window.dispatchEvent(
      new CustomEvent('app:module-ready', {
        detail: { module: moduleName }
      })
    );
  }
})();