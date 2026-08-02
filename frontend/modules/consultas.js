(function () {
  const moduleName = 'consultas';

let estudiantes = [];
let profesores = [];
let matriculas = [];
let asistencias = [];

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
  const grupo = document.getElementById('consulta-grupo');
  const fecha = document.getElementById('consulta-fecha');
  const limpiar = document.getElementById('consulta-limpiar');
  const refrescar = document.getElementById('consulta-refrescar');
  const tablaBody = document.getElementById('consulta-tabla-body');
  const modificarDetalle = document.getElementById(
    'consulta-detalle-modificar'
  );

  tipo?.addEventListener('change', actualizarConsulta);
  busqueda?.addEventListener('input', actualizarConsulta);
  estado?.addEventListener('change', actualizarConsulta);
  grupo?.addEventListener('change', actualizarConsulta);
  fecha?.addEventListener('change', actualizarConsulta);
  refrescar?.addEventListener('click', cargarConsultas);

  tablaBody?.addEventListener(
    'click',
    manejarAccionesTabla
  );

  modificarDetalle?.addEventListener(
    'click',
    modificarDesdeDetalle
  );

  limpiar?.addEventListener('click', () => {
    if (busqueda) busqueda.value = '';
    if (estado) estado.value = '';
    if (grupo) grupo.value = '';
    if (fecha) fecha.value = '';

    actualizarConsulta();
  });
}

 async function cargarConsultas() {
  mostrarCargando();

  try {
    const [
      resEstudiantes,
      resProfesores,
      resMatriculas,
      resAsistencias
    ] = await Promise.all([
      apiFetch('/api/estudiantes'),
      apiFetch('/api/profesores'),
      apiFetch('/api/procesos/matricula'),
      apiFetch('/api/procesos/asistencia')
    ]);

    estudiantes = resEstudiantes.ok
      ? await resEstudiantes.json()
      : [];

    profesores = resProfesores.ok
      ? await resProfesores.json()
      : [];

    matriculas = resMatriculas.ok
      ? await resMatriculas.json()
      : [];

    asistencias = resAsistencias.ok
      ? await resAsistencias.json()
      : [];

    if (!resMatriculas.ok) {
      console.warn(
        'La consulta de matrículas todavía no está disponible en el servidor.'
      );
    }

    if (!resAsistencias.ok) {
      console.warn(
        'No se pudieron cargar los registros de asistencia.'
      );
    }

    actualizarResumen();
    cargarFiltroGrupos();
    actualizarConsulta();
  } catch (error) {
    console.error('Error cargando consultas:', error);

    mostrarError(
      error.message ||
      'No se pudo cargar la información.'
    );
  }
}

  /* ==========================================
   RESUMEN GENERAL DE CONSULTAS
   ========================================== */

  function actualizarResumen() {
    const totalEstudiantes = document.getElementById('consulta-total-estudiantes');
    const totalProfesores = document.getElementById('consulta-total-profesores');
    const totalMatriculas = document.getElementById('consulta-total-matriculas');
    const totalAsistencias = document.getElementById('consulta-total-asistencias');

    if (totalEstudiantes) {
      totalEstudiantes.textContent = estudiantes.length;
    }

    if (totalProfesores) {
      totalProfesores.textContent = profesores.length;
    }
    if (totalMatriculas) {
    totalMatriculas.textContent = matriculas.length;
  }
  if (totalAsistencias) {
    totalAsistencias.textContent = asistencias.length;
  }
  }

/* ==========================================
   CAMBIO DEL TIPO DE CONSULTA
   ========================================== */
  /* ==========================================
   CAMBIO DEL TIPO DE CONSULTA
   ========================================== */

function actualizarConsulta() {
  const tipo =
    document.getElementById('consulta-tipo')?.value ||
    'estudiantes';

  actualizarFiltroEstado(tipo);
  actualizarTextoBusqueda(tipo);
  actualizarFiltrosVisibles(tipo);

  if (tipo === 'estudiantes') {
    mostrarEstudiantes();
    return;
  }

  if (tipo === 'profesores') {
    mostrarProfesores();
    return;
  }

  if (tipo === 'matriculas') {
    mostrarMatriculas();
    return;
  }

  if (tipo === 'asistencia') {
    mostrarAsistencias();
  }
}

/* ==========================================
   FILTROS DINÁMICOS
   ========================================== */

function actualizarFiltroEstado(tipo) {
  const select = document.getElementById('consulta-estado');

  if (!select) return;

  const valorActual = select.value;

  if (tipo === 'asistencia') {
    select.innerHTML = `
      <option value="">Todos</option>
      <option value="presente">Presente</option>
      <option value="ausente">Ausente</option>
      <option value="tardia">Tardía</option>
      <option value="justificada">Justificada</option>
    `;
  } else if (tipo === 'matriculas') {
    select.innerHTML = `
      <option value="">Todos</option>
      <option value="activa">Activa</option>
      <option value="inactiva">Inactiva</option>
      <option value="retirada">Retirada</option>
      <option value="finalizada">Finalizada</option>
    `;
  } else {
    select.innerHTML = `
      <option value="">Todos</option>
      <option value="activo">Activo</option>
      <option value="inactivo">Inactivo</option>
    `;
  }

  const opcionExiste = Array.from(select.options).some(
    (opcion) => opcion.value === valorActual
  );

  select.value = opcionExiste ? valorActual : '';
}

function actualizarTextoBusqueda(tipo) {
  const input = document.getElementById('consulta-busqueda');

  if (!input) return;

  const textos = {
    estudiantes: 'Buscar por nombre...',
    profesores: 'Buscar por nombre o materia...',
    matriculas: 'Buscar por estudiante o grupo...',
    asistencia: 'Buscar por estudiante, grupo o profesor...'
  };

  input.placeholder = textos[tipo] || 'Buscar...';
}

function actualizarFiltrosVisibles(tipo) {
  const filtroGrupo = document.querySelector(
    '.consulta-filtro-grupo'
  );

  const filtroFecha = document.querySelector(
    '.consulta-filtro-fecha'
  );

  const mostrarFiltrosDeProceso =
    tipo === 'matriculas' ||
    tipo === 'asistencia';

  filtroGrupo?.classList.toggle(
    'hidden',
    !mostrarFiltrosDeProceso
  );

  filtroFecha?.classList.toggle(
    'hidden',
    !mostrarFiltrosDeProceso
  );
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
  const estadoSeleccionado = obtenerEstado();

  const resultados = profesores.filter((profesor) => {
    const texto = `${formarNombre(profesor)} ${profesor.materia ?? ''}`
      .toLowerCase();

    const activo =
      profesor.estado == 1 ||
      profesor.estado === true;

    const coincideBusqueda =
      !busqueda ||
      texto.includes(busqueda);

    const coincideEstado =
      !estadoSeleccionado ||
      (estadoSeleccionado === 'activo' && activo) ||
      (estadoSeleccionado === 'inactivo' && !activo);

    return coincideBusqueda && coincideEstado;
  });

  actualizarTitulo(
    'Profesores registrados',
    resultados.length
  );

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

  const body = document.getElementById(
    'consulta-tabla-body'
  );

  if (!body) return;

  body.innerHTML = '';

  resultados.forEach((profesor) => {
    const id =
      profesor.id_profesor ??
      profesor.id ??
      '';

    const nombre =
      formarNombre(profesor);

    const materia =
      profesor.materia ??
      'Sin asignar';

    const ingreso =
      limpiarFecha(profesor.fecha_ingreso);

    const activo =
      profesor.estado == 1 ||
      profesor.estado === true;

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


  /* ==========================================
   CONSULTA DE MATRÍCULAS
   ========================================== */

   function mostrarMatriculas() {
  const busqueda = obtenerBusqueda();
  const estadoSeleccionado = obtenerEstado();

  const grupoSeleccionado =
    document.getElementById('consulta-grupo')?.value || '';

  const fechaSeleccionada =
    document.getElementById('consulta-fecha')?.value || '';

  const resultados = matriculas.filter((registro) => {
    const estudiante = `${registro.estudiante_nombre ?? ''} ${
      registro.estudiante_apellido1 ?? ''
    } ${registro.estudiante_apellido2 ?? ''}`
      .trim()
      .toLowerCase();

    const grupo = String(
      registro.nombre_grupo ?? ''
    ).toLowerCase();

    const estado = String(
      registro.estado_matricula ?? ''
    ).toLowerCase();

    const fecha = limpiarFecha(registro.fecha);

    const coincideBusqueda =
      !busqueda ||
      `${estudiante} ${grupo}`.includes(busqueda);

    const coincideEstado =
      !estadoSeleccionado ||
      estado === estadoSeleccionado;

    const coincideGrupo =
      !grupoSeleccionado ||
      String(registro.id_grupo) ===
        String(grupoSeleccionado);

    const coincideFecha =
      !fechaSeleccionada ||
      fecha === fechaSeleccionada;

    return (
      coincideBusqueda &&
      coincideEstado &&
      coincideGrupo &&
      coincideFecha
    );
  });

  actualizarTitulo(
    'Matrículas registradas',
    resultados.length
  );

  cambiarEncabezado(`
    <tr>
      <th>ID</th>
      <th>Fecha</th>
      <th>Estudiante</th>
      <th>Grupo</th>
      <th>Período</th>
      <th>Tipo</th>
      <th>Estado</th>
      <th class="text-end">Acciones</th>
    </tr>
  `);

  if (!resultados.length) {
    mostrarSinResultados(8);
    return;
  }

  const body = document.getElementById(
    'consulta-tabla-body'
  );

  if (!body) return;

  body.innerHTML = '';

  resultados.forEach((registro) => {
    const estudiante = `${registro.estudiante_nombre ?? ''} ${
      registro.estudiante_apellido1 ?? ''
    } ${registro.estudiante_apellido2 ?? ''}`.trim();

    const estado =
      registro.estado_matricula || 'Sin estado';

    const fila = document.createElement('tr');

    fila.innerHTML = `
      <td>${registro.id_matricula ?? '-'}</td>

      <td>${limpiarFecha(registro.fecha)}</td>

      <td>${estudiante || '-'}</td>

      <td>${registro.nombre_grupo ?? '-'}</td>

      <td>
        ${registro.periodo_lectivo ?? '-'} /
        ${registro.anio_lectivo ?? '-'}
      </td>

      <td>${registro.tipo_matricula ?? '-'}</td>

      <td>
        <span class="badge bg-primary">
          ${estado}
        </span>
      </td>

      <td class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary consulta-ver-matricula"
          data-id="${registro.id_matricula}">
          <i class="bi bi-eye"></i>
          Ver
        </button>
      </td>
    `;

    body.appendChild(fila);
  });
}

/* ==========================================
   CONSULTA DE ASISTENCIA
   ========================================== */

function mostrarAsistencias() {
  const busqueda = obtenerBusqueda();
  const estadoSeleccionado = obtenerEstado();

  const grupoSeleccionado =
    document.getElementById('consulta-grupo')?.value || '';

  const fechaSeleccionada =
    document.getElementById('consulta-fecha')?.value || '';

  const resultados = asistencias.filter((registro) => {
    const estudiante = `${registro.estudiante_nombre ?? ''} ${
      registro.estudiante_apellido1 ?? ''
    } ${registro.estudiante_apellido2 ?? ''}`
      .trim()
      .toLowerCase();

    const profesor = `${registro.profesor_nombre ?? ''} ${
      registro.profesor_apellido1 ?? ''
    }`
      .trim()
      .toLowerCase();

    const grupo = String(
      registro.nombre_grupo ?? ''
    ).toLowerCase();

    const estado = String(
      registro.estado_asistencia ?? ''
    ).toLowerCase();

    const fecha = limpiarFecha(registro.fecha);

    const textoCompleto =
      `${estudiante} ${profesor} ${grupo}`;

    const coincideBusqueda =
      !busqueda ||
      textoCompleto.includes(busqueda);

    const coincideEstado =
      !estadoSeleccionado ||
      estado === estadoSeleccionado;

    const coincideGrupo =
      !grupoSeleccionado ||
      String(registro.id_grupo) ===
        String(grupoSeleccionado);

    const coincideFecha =
      !fechaSeleccionada ||
      fecha === fechaSeleccionada;

    return (
      coincideBusqueda &&
      coincideEstado &&
      coincideGrupo &&
      coincideFecha
    );
  });

  actualizarTitulo(
    'Registros de asistencia',
    resultados.length
  );

  cambiarEncabezado(`
    <tr>
      <th>Fecha</th>
      <th>Estudiante</th>
      <th>Grupo</th>
      <th>Profesor</th>
      <th>Estado</th>
      <th>Observaciones</th>
      <th class="text-end">Acciones</th>
    </tr>
  `);

  if (!resultados.length) {
    mostrarSinResultados(7);
    return;
  }

  const body = document.getElementById(
    'consulta-tabla-body'
  );

  if (!body) return;

  body.innerHTML = '';

  resultados.forEach((registro) => {
    const estudiante = `${registro.estudiante_nombre ?? ''} ${
      registro.estudiante_apellido1 ?? ''
    } ${registro.estudiante_apellido2 ?? ''}`.trim();

    const profesor = `${registro.profesor_nombre ?? ''} ${
      registro.profesor_apellido1 ?? ''
    }`.trim();

    const estado = String(
      registro.estado_asistencia ?? ''
    ).toLowerCase();

    const fila = document.createElement('tr');

    fila.innerHTML = `
      <td>${limpiarFecha(registro.fecha)}</td>

      <td>${estudiante || '-'}</td>

      <td>${registro.nombre_grupo ?? '-'}</td>

      <td>${profesor || '-'}</td>

      <td>${crearBadgeAsistencia(estado)}</td>

      <td>${registro.observaciones || '—'}</td>

      <td class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary consulta-ver-asistencia"
          data-id="${registro.id_asistencia}">
          <i class="bi bi-eye"></i>
          Ver
        </button>
      </td>
    `;

    body.appendChild(fila);
  });
}

function crearBadgeAsistencia(estado) {
  const configuracion = {
    presente: {
      texto: 'Presente',
      clase: 'bg-success'
    },

    ausente: {
      texto: 'Ausente',
      clase: 'bg-danger'
    },

    tardia: {
      texto: 'Tardía',
      clase: 'bg-warning text-dark'
    },

    justificada: {
      texto: 'Justificada',
      clase: 'bg-primary'
    }
  };

  const opcion = configuracion[estado] || {
    texto: estado || 'Sin estado',
    clase: 'bg-secondary'
  };

  return `
    <span class="badge ${opcion.clase}">
      ${opcion.texto}
    </span>
  `;
}

/* ==========================================
   FILTRO DE GRUPOS
   ========================================== */

function cargarFiltroGrupos() {
  const select = document.getElementById(
    'consulta-grupo'
  );

  if (!select) return;

  const valorActual = select.value;
  const grupos = new Map();

  matriculas.forEach((registro) => {
    if (
      registro.id_grupo &&
      registro.nombre_grupo
    ) {
      grupos.set(
        String(registro.id_grupo),
        registro.nombre_grupo
      );
    }
  });

  asistencias.forEach((registro) => {
    if (
      registro.id_grupo &&
      registro.nombre_grupo
    ) {
      grupos.set(
        String(registro.id_grupo),
        registro.nombre_grupo
      );
    }
  });

  select.innerHTML =
    '<option value="">Todos los grupos</option>';

  grupos.forEach((nombre, id) => {
    select.add(new Option(nombre, id));
  });

  if (grupos.has(String(valorActual))) {
    select.value = valorActual;
  }
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
  const verEstudiante = evento.target.closest(
    '.consulta-ver-estudiante'
  );

  const editarEstudiante = evento.target.closest(
    '.consulta-editar-estudiante'
  );

  const verProfesor = evento.target.closest(
    '.consulta-ver-profesor'
  );

  const verMatricula = evento.target.closest(
    '.consulta-ver-matricula'
  );

  const verAsistencia = evento.target.closest(
    '.consulta-ver-asistencia'
  );

  if (verEstudiante) {
    await mostrarDetalleEstudiante(
      verEstudiante.dataset.id
    );
    return;
  }

  if (editarEstudiante) {
    await abrirEdicionEstudiante(
      editarEstudiante.dataset.id
    );
    return;
  }

  if (verProfesor) {
    mostrarDetalleProfesor(
      verProfesor.dataset.id
    );
    return;
  }

  if (verMatricula) {
    mostrarDetalleMatricula(
      verMatricula.dataset.id
    );
    return;
  }

  if (verAsistencia) {
    mostrarDetalleAsistencia(
      verAsistencia.dataset.id
    );
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

function mostrarDetalleMatricula(id) {
  const registro = matriculas.find((item) => {
    return String(item.id_matricula) === String(id);
  });

  const contenido = document.getElementById(
    'consulta-detalle-contenido'
  );

  const titulo = document.getElementById(
    'consulta-detalle-titulo'
  );

  const modificar = document.getElementById(
    'consulta-detalle-modificar'
  );

  if (!contenido || !titulo || !modificar) return;

  titulo.textContent = 'Detalle de matrícula';

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  if (!registro) {
    contenido.innerHTML = `
      <div class="text-center py-4 text-danger">
        No se encontró la matrícula.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  const estudiante = `${registro.estudiante_nombre ?? ''} ${
    registro.estudiante_apellido1 ?? ''
  } ${registro.estudiante_apellido2 ?? ''}`.trim();

  contenido.innerHTML = `
    <div class="row g-3">
      ${crearCampoDetalle(
        'Identificación',
        registro.id_matricula ?? '-'
      )}

      ${crearCampoDetalle(
        'Fecha',
        limpiarFecha(registro.fecha)
      )}

      ${crearCampoDetalle(
        'Estudiante',
        estudiante || '-'
      )}

      ${crearCampoDetalle(
        'Grupo',
        registro.nombre_grupo ?? '-'
      )}

      ${crearCampoDetalle(
        'Período',
        `${registro.periodo_lectivo ?? '-'} / ${
          registro.anio_lectivo ?? '-'
        }`
      )}

      ${crearCampoDetalle(
        'Tipo',
        registro.tipo_matricula ?? '-'
      )}

      ${crearCampoDetalle(
        'Estado',
        registro.estado_matricula ?? '-'
      )}

      <div class="col-12">
        <div class="bg-white border rounded p-3">
          <span class="text-muted small d-block mb-1">
            Observaciones
          </span>

          <div class="fw-semibold">
            ${registro.observaciones || 'Sin observaciones'}
          </div>
        </div>
      </div>
    </div>
  `;

  abrirModalDetalle();
}

function mostrarDetalleAsistencia(id) {
  const registro = asistencias.find((item) => {
    return String(item.id_asistencia) === String(id);
  });

  const contenido = document.getElementById(
    'consulta-detalle-contenido'
  );

  const titulo = document.getElementById(
    'consulta-detalle-titulo'
  );

  const modificar = document.getElementById(
    'consulta-detalle-modificar'
  );

  if (!contenido || !titulo || !modificar) return;

  titulo.textContent = 'Detalle de asistencia';

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  if (!registro) {
    contenido.innerHTML = `
      <div class="text-center py-4 text-danger">
        No se encontró el registro de asistencia.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  const estudiante = `${registro.estudiante_nombre ?? ''} ${
    registro.estudiante_apellido1 ?? ''
  } ${registro.estudiante_apellido2 ?? ''}`.trim();

  const profesor = `${registro.profesor_nombre ?? ''} ${
    registro.profesor_apellido1 ?? ''
  }`.trim();

  const estado = String(
    registro.estado_asistencia ?? ''
  ).toLowerCase();

  contenido.innerHTML = `
    <div class="row g-3">
      ${crearCampoDetalle(
        'Identificación',
        registro.id_asistencia ?? '-'
      )}

      ${crearCampoDetalle(
        'Fecha',
        limpiarFecha(registro.fecha)
      )}

      ${crearCampoDetalle(
        'Estudiante',
        estudiante || '-'
      )}

      ${crearCampoDetalle(
        'Grupo',
        registro.nombre_grupo ?? '-'
      )}

      ${crearCampoDetalle(
        'Profesor',
        profesor || '-'
      )}

      ${crearCampoDetalle(
        'Estado',
        crearBadgeAsistencia(estado)
      )}

      <div class="col-12">
        <div class="bg-white border rounded p-3">
          <span class="text-muted small d-block mb-1">
            Observaciones
          </span>

          <div class="fw-semibold">
            ${registro.observaciones || 'Sin observaciones'}
          </div>
        </div>
      </div>
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