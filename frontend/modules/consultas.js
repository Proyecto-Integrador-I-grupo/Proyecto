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

    tipo?.addEventListener('change', actualizarConsulta);
    busqueda?.addEventListener('input', actualizarConsulta);
    estado?.addEventListener('change', actualizarConsulta);
    refrescar?.addEventListener('click', cargarConsultas);

    limpiar?.addEventListener('click', () => {
      if (busqueda) busqueda.value = '';
      if (estado) estado.value = '';
      actualizarConsulta();
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
          <button
            type="button"
            class="btn btn-sm btn-outline-primary consulta-editar-estudiante"
            data-id="${id}"
          >
            <i class="bi bi-pencil"></i>
            Modificar
          </button>
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
            class="btn btn-sm btn-outline-primary consulta-ver-profesor"
            data-id="${id}"
          >
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