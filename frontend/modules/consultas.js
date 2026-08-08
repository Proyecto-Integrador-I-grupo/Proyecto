(function () {
  const moduleName = 'consultas';

let estudiantes = [];
let estudiantesMatriculados = [];
let profesores = [];
let matriculas = [];
let asistencias = [];
let grupos = [];

// Registro que se está mostrando en la vista previa
let documentoActual = null;
let tipoDocumentoActual = null;
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
    const seccion = document.getElementById('consulta-seccion');
    const nivel = document.getElementById('consulta-nivel');
    const fecha = document.getElementById('consulta-fecha');
    const limpiar = document.getElementById('consulta-limpiar');
    const refrescar = document.getElementById('consulta-refrescar');
    const tablaBody = document.getElementById('consulta-tabla-body');
    const modificarDetalle = document.getElementById('consulta-detalle-modificar');
    const descargarPdf = document.getElementById('consulta-descargar-pdf');

    tipo?.addEventListener('change', actualizarConsulta);
    busqueda?.addEventListener('input', actualizarConsulta);
    estado?.addEventListener('change', actualizarConsulta);
    grupo?.addEventListener('change', actualizarConsulta);
    seccion?.addEventListener('change', actualizarConsulta);
    nivel?.addEventListener('change', actualizarConsulta);
    fecha?.addEventListener('change', actualizarConsulta);
    refrescar?.addEventListener('click', cargarConsultas);

    tablaBody?.addEventListener('click', manejarAccionesTabla);

    modificarDetalle?.addEventListener(
      'click',
      modificarDesdeDetalle
    );
    descargarPdf?.addEventListener(
  'click',
  descargarDocumentoPDF
);

    limpiar?.addEventListener('click', () => {
      if (busqueda) busqueda.value = '';
      if (estado) estado.value = '';
      if (grupo) grupo.value = '';
      if (seccion) seccion.value = '';
      if (nivel) nivel.value = '';
      if (fecha) fecha.value = '';

      actualizarConsulta();
    });
  }

  async function cargarConsultas() {
  mostrarCargando();

  try {
    const [
      resEstudiantes,
      resEstudiantesMatriculados,
      resProfesores,
      resMatriculas,
      resAsistencias,
      resGrupos
    ] = await Promise.all([
      apiFetch('/api/estudiantes'),
      apiFetch('/api/estudiantes/matriculados'),
      apiFetch('/api/profesores'),
      apiFetch('/api/procesos/matricula'),
      apiFetch('/api/procesos/asistencia'),
      apiFetch('/api/procesos/grupos')
    ]);

    estudiantes = resEstudiantes.ok
      ? await resEstudiantes.json()
      : [];

    estudiantesMatriculados =
      resEstudiantesMatriculados.ok
        ? await resEstudiantesMatriculados.json()
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

    grupos = resGrupos.ok
      ? await resGrupos.json()
      : [];

    if (!resEstudiantesMatriculados.ok) {
      console.warn(
        'No se pudieron cargar los estudiantes matriculados.'
      );
    }

    if (!resMatriculas.ok) {
      console.warn(
        'No se pudieron cargar las matrículas.'
      );
    }

    if (!resAsistencias.ok) {
      console.warn(
        'No se pudieron cargar los registros de asistencia.'
      );
    }

    if (!resGrupos.ok) {
      console.warn(
        'No se pudieron cargar los grupos.'
      );
    }

    actualizarResumen();
    cargarFiltroGrupos();
    cargarFiltrosMatriculados();
    actualizarConsulta();
  } catch (error) {
    console.error(
      'Error cargando consultas:',
      error
    );

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
    const totalEstudiantes = document.getElementById(
      'consulta-total-estudiantes'
    );

    const totalMatriculados = document.getElementById(
      'consulta-total-matriculados'
    );

    const totalProfesores = document.getElementById(
      'consulta-total-profesores'
    );

    const totalMatriculas = document.getElementById(
      'consulta-total-matriculas'
    );

    const totalAsistencias = document.getElementById(
      'consulta-total-asistencias'
    );

    if (totalEstudiantes) {
      totalEstudiantes.textContent = estudiantes.length;
    }

    if (totalMatriculados) {
      totalMatriculados.textContent =
        estudiantesMatriculados.length;
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

  function actualizarConsulta() {
  const tipo =
    document.getElementById('consulta-tipo')?.value ||
    'prematriculados';

  actualizarFiltroEstado(tipo);
  actualizarTextoBusqueda(tipo);
  actualizarFiltrosVisibles(tipo);

  if (tipo === 'prematriculados') {
    mostrarEstudiantesPrematriculados();
    return;
  }

  if (tipo === 'matriculados') {
    mostrarEstudiantesMatriculados();
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
    return;
  }

  if (tipo === 'grupos') {
    mostrarGrupos();
  }
}

  /* ==========================================
     FILTROS DINÁMICOS
     ========================================== */

  function actualizarFiltroEstado(tipo) {
  const select =
    document.getElementById('consulta-estado');

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
  } else if (
    tipo === 'matriculas' ||
    tipo === 'matriculados'
  ) {
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

  const opcionExiste =
    Array.from(select.options).some(
      (opcion) =>
        opcion.value === valorActual
    );

  select.value =
    opcionExiste
      ? valorActual
      : '';
}

  function actualizarTextoBusqueda(tipo) {
  const input =
    document.getElementById(
      'consulta-busqueda'
    );

  if (!input) return;

  const textos = {
    prematriculados:
      'Buscar estudiante pendiente...',

    matriculados:
      'Buscar por estudiante, grupo, sección o nivel...',

    profesores:
      'Buscar por nombre o materia...',

    matriculas:
      'Buscar por estudiante o grupo...',

    asistencia:
      'Buscar por estudiante, grupo o profesor...',

    grupos:
      'Buscar por grupo, sección, nivel o aula...'
  };

  input.placeholder =
    textos[tipo] ||
    'Buscar...';
}

  function actualizarFiltrosVisibles(tipo) {
  const filtroGrupo =
    document.querySelector(
      '.consulta-filtro-grupo'
    );

  const filtroFecha =
    document.querySelector(
      '.consulta-filtro-fecha'
    );

  const filtroSeccion =
    document.querySelector(
      '.consulta-filtro-seccion'
    );

  const filtroNivel =
    document.querySelector(
      '.consulta-filtro-nivel'
    );

  const usaGrupo =
    tipo === 'matriculados' ||
    tipo === 'matriculas' ||
    tipo === 'asistencia';

  const usaFecha =
    tipo === 'matriculas' ||
    tipo === 'asistencia';

  const usaSeccion =
    tipo === 'matriculados' ||
    tipo === 'grupos';

  const usaNivel =
    tipo === 'matriculados' ||
    tipo === 'grupos';

  filtroGrupo?.classList.toggle(
    'hidden',
    !usaGrupo
  );

  filtroFecha?.classList.toggle(
    'hidden',
    !usaFecha
  );

  filtroSeccion?.classList.toggle(
    'hidden',
    !usaSeccion
  );

  filtroNivel?.classList.toggle(
    'hidden',
    !usaNivel
  );
} 
  /* ==========================================
     ESTUDIANTES EN PRE-MATRÍCULA
     ========================================== */

  function mostrarEstudiantesPrematriculados() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const resultados = estudiantes.filter(
      (estudiante) => {
        const texto =
          formarNombre(estudiante).toLowerCase();

        const activo =
          estudiante.estado == 1 ||
          estudiante.estado === true ||
          estudiante.estado === undefined;

        const coincideBusqueda =
          !busqueda ||
          texto.includes(busqueda);

        const coincideEstado =
          !estadoSeleccionado ||
          (
            estadoSeleccionado === 'activo' &&
            activo
          ) ||
          (
            estadoSeleccionado === 'inactivo' &&
            !activo
          );

        return (
          coincideBusqueda &&
          coincideEstado
        );
      }
    );

    actualizarTitulo(
      'Estudiantes pendientes de matrícula',
      resultados.length
    );

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

    const body = document.getElementById(
      'consulta-tabla-body'
    );

    if (!body) return;

    body.innerHTML = '';

    resultados.forEach((estudiante) => {
      const id =
        estudiante.id_estudiante ??
        estudiante.id ??
        '';

      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true ||
        estudiante.estado === undefined;

      const fila = document.createElement('tr');

      fila.innerHTML = `
  <td>${id}</td>

  <td>
    <div class="fw-semibold">
      ${formarNombre(estudiante) || '-'}
    </div>

    <small class="text-muted">
      Matrícula #${estudiante.id_matricula ?? '-'}
    </small>
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_nacimiento
    )}
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_ingreso
    )}
  </td>

  <td>
    <span
      class="badge ${
        activo
          ? 'bg-success'
          : 'bg-secondary'
      }">
      ${activo ? 'Activo' : 'Inactivo'}
    </span>
  </td>

    
<td class="text-end">
  <button
    type="button"
    class="btn btn-sm btn-outline-primary consulta-ver-estudiante"
    data-id="${id}">
    <i class="bi bi-file-earmark-text"></i>
    Vista previa
  </button>

  <button
    type="button"
    class="btn btn-sm btn-outline-secondary consulta-editar-estudiante"
    data-id="${id}">
    <i class="bi bi-pencil"></i>
    Modificar
  </button>
</td>
`;

      body.appendChild(fila);
    });
  }

  /* ==========================================
     ESTUDIANTES MATRICULADOS
     ========================================== */

  function mostrarEstudiantesMatriculados() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const grupoSeleccionado =
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const seccionSeleccionada =
      document.getElementById(
        'consulta-seccion'
      )?.value || '';

    const nivelSeleccionado =
      document.getElementById(
        'consulta-nivel'
      )?.value || '';

    const resultados =
      estudiantesMatriculados.filter(
        (estudiante) => {
          const nombre =
            formarNombre(estudiante)
              .toLowerCase();

          const grupo = String(
            estudiante.nombre_grupo ?? ''
          ).toLowerCase();

          const seccion = String(
            estudiante.nombre_seccion ?? ''
          );

          const nivel = String(
            estudiante.nivel ?? ''
          );
                    const estado = String(
            estudiante.estado_matricula ?? 'activa'
          ).toLowerCase();

          const textoCompleto =
            `${nombre} ${grupo} ${seccion} ${nivel}`;

          const coincideBusqueda =
            !busqueda ||
            textoCompleto.includes(busqueda);

          const coincideGrupo =
            !grupoSeleccionado ||
            String(estudiante.id_grupo) ===
              String(grupoSeleccionado);

          const coincideSeccion =
            !seccionSeleccionada ||
            String(estudiante.id_seccion) ===
              String(seccionSeleccionada);

          const coincideNivel =
            !nivelSeleccionado ||
            nivel === nivelSeleccionado;

          const coincideEstado =
            !estadoSeleccionado ||
            estado === estadoSeleccionado;

          return (
            coincideBusqueda &&
            coincideGrupo &&
            coincideSeccion &&
            coincideNivel &&
            coincideEstado
          );
        }
      );

    actualizarTitulo(
      'Estudiantes matriculados',
      resultados.length
    );

    cambiarEncabezado(`
  <tr>
    <th>ID</th>
    <th>Estudiante</th>
    <th>Grupo</th>
    <th>Sección</th>
    <th>Nivel</th>
    <th>Fecha de matrícula</th>
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

    resultados.forEach((estudiante) => {
      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true;

      const fila = document.createElement('tr');

      fila.innerHTML = `
  <td>
    ${estudiante.id_estudiante ?? '-'}
  </td>

  <td>
    <div class="fw-semibold">
      ${formarNombre(estudiante) || '-'}
    </div>

    <small class="text-muted">
      Matrícula #${estudiante.id_matricula ?? '-'}
    </small>
  </td>

  <td>
    ${estudiante.nombre_grupo ?? '-'}
  </td>

  <td>
    ${estudiante.nombre_seccion ?? '-'}
  </td>

  <td>
    ${estudiante.nivel ?? '-'}
  </td>

  <td>
    ${limpiarFecha(
      estudiante.fecha_matricula ||
      estudiante.fecha_asignacion
    )}
  </td>

  <td>
    <span
      class="badge ${
        activo
          ? 'bg-success'
          : 'bg-secondary'
      }">
      ${activo ? 'Activo' : 'Inactivo'}
    </span>
  </td>

  <td class="text-end">
    <button
      type="button"
      class="btn btn-sm btn-outline-primary consulta-ver-matriculado"
      data-estudiante="${estudiante.id_estudiante}"
      data-matricula="${estudiante.id_matricula ?? ''}">
      <i class="bi bi-file-earmark-text"></i>
      Vista previa
    </button>
  </td>
`;

      body.appendChild(fila);
    });
  }

  function mostrarGrupos() {
  const busqueda = obtenerBusqueda();
  const estadoSeleccionado = obtenerEstado();

  const seccionSeleccionada =
    document.getElementById(
      'consulta-seccion'
    )?.value || '';

  const nivelSeleccionado =
    document.getElementById(
      'consulta-nivel'
    )?.value || '';

  const resultados = grupos
    .filter((grupo) => {
      const nombreGrupo = String(
        grupo.nombre_grupo ?? ''
      ).toLowerCase();

      const seccion = String(
        grupo.nombre_seccion ?? ''
      ).toLowerCase();

      const nivel = String(
        grupo.nivel ?? ''
      ).toLowerCase();

      const aula = String(
        grupo.aula ?? ''
      ).toLowerCase();

      const textoCompleto =
        `${nombreGrupo} ${seccion} ${nivel} ${aula}`;

      const coincideBusqueda =
        !busqueda ||
        textoCompleto.includes(busqueda);

      const coincideSeccion =
        !seccionSeleccionada ||
        String(grupo.id_seccion) ===
          String(seccionSeleccionada);

      const coincideNivel =
        !nivelSeleccionado ||
        String(grupo.nivel) ===
          String(nivelSeleccionado);

      /*
       * El endpoint actual solo devuelve
       * grupos activos.
       */
      const coincideEstado =
        !estadoSeleccionado ||
        estadoSeleccionado === 'activo';

      return (
        coincideBusqueda &&
        coincideSeccion &&
        coincideNivel &&
        coincideEstado
      );
    })
    .sort((a, b) =>
      String(a.nombre_grupo ?? '')
        .localeCompare(
          String(b.nombre_grupo ?? ''),
          'es',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    );

  actualizarTitulo(
    'Grupos registrados',
    resultados.length
  );

  cambiarEncabezado(`
    <tr>
      <th>Grupo</th>
      <th>Nivel</th>
      <th>Sección</th>
      <th>Aula</th>
      <th>Estudiantes</th>
      <th>Capacidad</th>
      <th>Período</th>
      <th class="text-end">Acciones</th>
    </tr>
  `);

  if (!resultados.length) {
    mostrarSinResultados(8);
    return;
  }

  const body =
    document.getElementById(
      'consulta-tabla-body'
    );

  if (!body) return;

  body.innerHTML = '';

  resultados.forEach((grupo) => {
    const ocupados =
      Number(grupo.ocupados ?? 0);

    const capacidad =
      Number(grupo.capacidad ?? 0);

    const disponible =
      Math.max(
        capacidad - ocupados,
        0
      );

    const porcentaje =
      capacidad > 0
        ? Math.min(
            Math.round(
              (ocupados / capacidad) * 100
            ),
            100
          )
        : 0;

    const fila =
      document.createElement('tr');

    fila.innerHTML = `
      <td>
        <div class="fw-semibold">
          ${grupo.nombre_grupo ?? '-'}
        </div>

        <small class="text-muted">
          ID #${grupo.id_grupo ?? '-'}
        </small>
      </td>

      <td>
        ${grupo.nivel ?? '-'}
      </td>

      <td>
        ${grupo.nombre_seccion ?? '-'}
      </td>

      <td>
        ${grupo.aula ?? '-'}
      </td>

      <td>
        <div class="d-flex align-items-center gap-2">
          <span class="fw-semibold">
            ${ocupados}
          </span>

          <small class="text-muted">
            matriculados
          </small>
        </div>

        <div
          class="progress mt-1"
          style="height: 5px;">

          <div
            class="progress-bar"
            role="progressbar"
            style="width: ${porcentaje}%"
            aria-valuenow="${porcentaje}"
            aria-valuemin="0"
            aria-valuemax="100">
          </div>

        </div>
      </td>

      <td>
        <div>
          ${ocupados} / ${capacidad}
        </div>

        <small class="text-muted">
          ${disponible} cupos disponibles
        </small>
      </td>

      <td>
        ${grupo.periodo_lectivo ?? '-'}
      </td>

      <td class="text-end">

        <button
          type="button"
          class="btn btn-sm btn-outline-primary consulta-ver-grupo"
          data-id="${grupo.id_grupo}">

          <i class="bi bi-file-earmark-text"></i>
          Vista previa

        </button>

      </td>
    `;

    body.appendChild(fila);
  });
}

  /* ==========================================
     CONSULTA DE PROFESORES
     ========================================== */

  function mostrarProfesores() {
    const busqueda = obtenerBusqueda();
    const estadoSeleccionado = obtenerEstado();

    const resultados = profesores.filter(
      (profesor) => {
        const texto =
          `${formarNombre(profesor)} ${
            profesor.materia ?? ''
          }`.toLowerCase();

        const activo =
          profesor.estado == 1 ||
          profesor.estado === true;

        const coincideBusqueda =
          !busqueda ||
          texto.includes(busqueda);

        const coincideEstado =
          !estadoSeleccionado ||
          (
            estadoSeleccionado === 'activo' &&
            activo
          ) ||
          (
            estadoSeleccionado === 'inactivo' &&
            !activo
          );

        return (
          coincideBusqueda &&
          coincideEstado
        );
      }
    );

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
        limpiarFecha(
          profesor.fecha_ingreso
        );

      const activo =
        profesor.estado == 1 ||
        profesor.estado === true;

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>${id}</td>

        <td>${nombre || '-'}</td>

        <td>${materia}</td>

        <td>${ingreso}</td>

        <td>
          <span
            class="badge ${
              activo
                ? 'bg-success'
                : 'bg-danger'
            }">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary consulta-ver-profesor"
            data-id="${id}">
           <i class="bi bi-file-earmark-text"></i>
             Vista previa
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
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const fechaSeleccionada =
      document.getElementById(
        'consulta-fecha'
      )?.value || '';

    const resultados = matriculas.filter(
      (registro) => {
        const estudiante = `${
          registro.estudiante_nombre ?? ''
        } ${
          registro.estudiante_apellido1 ?? ''
        } ${
          registro.estudiante_apellido2 ?? ''
        }`
          .trim()
          .toLowerCase();

        const grupo = String(
          registro.nombre_grupo ?? ''
        ).toLowerCase();

        const estado = String(
          registro.estado_matricula ?? ''
        ).toLowerCase();
                const fecha = limpiarFecha(
          registro.fecha
        );

        const coincideBusqueda =
          !busqueda ||
          `${estudiante} ${grupo}`.includes(
            busqueda
          );

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
      }
    );

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
      const estudiante = `${
        registro.estudiante_nombre ?? ''
      } ${
        registro.estudiante_apellido1 ?? ''
      } ${
        registro.estudiante_apellido2 ?? ''
      }`.trim();

      const estado =
        registro.estado_matricula ||
        'Sin estado';

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>
          ${registro.id_matricula ?? '-'}
        </td>

        <td>
          ${limpiarFecha(registro.fecha)}
        </td>

        <td>
          ${estudiante || '-'}
        </td>

        <td>
          ${registro.nombre_grupo ?? '-'}
        </td>

        <td>
          ${registro.periodo_lectivo ?? '-'} /
          ${registro.anio_lectivo ?? '-'}
        </td>

        <td>
          ${registro.tipo_matricula ?? '-'}
        </td>

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
            <i class="bi bi-file-earmark-text"></i>
              Vista previa
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
      document.getElementById(
        'consulta-grupo'
      )?.value || '';

    const fechaSeleccionada =
      document.getElementById(
        'consulta-fecha'
      )?.value || '';

    const resultados = asistencias.filter(
      (registro) => {
        const estudiante = `${
          registro.estudiante_nombre ?? ''
        } ${
          registro.estudiante_apellido1 ?? ''
        } ${
          registro.estudiante_apellido2 ?? ''
        }`
          .trim()
          .toLowerCase();

        const profesor = `${
          registro.profesor_nombre ?? ''
        } ${
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

        const fecha = limpiarFecha(
          registro.fecha
        );

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
      }
    );

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
      const estudiante = `${
        registro.estudiante_nombre ?? ''
      } ${
        registro.estudiante_apellido1 ?? ''
      } ${
        registro.estudiante_apellido2 ?? ''
      }`.trim();

      const profesor = `${
        registro.profesor_nombre ?? ''
      } ${
        registro.profesor_apellido1 ?? ''
      }`.trim();

      const estado = String(
        registro.estado_asistencia ?? ''
      ).toLowerCase();

      const fila =
        document.createElement('tr');

      fila.innerHTML = `
        <td>
          ${limpiarFecha(registro.fecha)}
        </td>

        <td>
          ${estudiante || '-'}
        </td>

        <td>
          ${registro.nombre_grupo ?? '-'}
        </td>

        <td>
          ${profesor || '-'}
        </td>

        <td>
          ${crearBadgeAsistencia(estado)}
        </td>

        <td>
          ${registro.observaciones || '—'}
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary consulta-ver-asistencia"
            data-id="${registro.id_asistencia}">
            <i class="bi bi-file-earmark-text"></i>
              Vista previa
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

    const opcion =
      configuracion[estado] || {
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
     FILTROS DE GRUPO, SECCIÓN Y NIVEL
     ========================================== */

  function cargarFiltroGrupos() {
    const select = document.getElementById(
      'consulta-grupo'
    );

    if (!select) return;

    const valorActual = select.value;
    const grupos = new Map();

    estudiantesMatriculados.forEach(
      (registro) => {
        if (
          registro.id_grupo &&
          registro.nombre_grupo
        ) {
          grupos.set(
            String(registro.id_grupo),
            registro.nombre_grupo
          );
        }
      }
    );

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
      select.add(
        new Option(nombre, id)
      );
    });

    if (
      grupos.has(String(valorActual))
    ) {
      select.value = valorActual;
    }
  }
    function cargarFiltrosMatriculados() {
  const selectSeccion =
    document.getElementById(
      'consulta-seccion'
    );

  const selectNivel =
    document.getElementById(
      'consulta-nivel'
    );

  const valorSeccionActual =
    selectSeccion?.value || '';

  const valorNivelActual =
    selectNivel?.value || '';

  const secciones = new Map();
  const niveles = new Set();

  // Datos provenientes de estudiantes matriculados
  estudiantesMatriculados.forEach(
    (estudiante) => {
      if (
        estudiante.id_seccion &&
        estudiante.nombre_seccion
      ) {
        secciones.set(
          String(estudiante.id_seccion),
          estudiante.nombre_seccion
        );
      }

      if (estudiante.nivel) {
        niveles.add(
          String(estudiante.nivel)
        );
      }
    }
  );

  // Datos provenientes de grupos
  grupos.forEach((grupo) => {
    if (
      grupo.id_seccion &&
      grupo.nombre_seccion
    ) {
      secciones.set(
        String(grupo.id_seccion),
        grupo.nombre_seccion
      );
    }

    if (grupo.nivel) {
      niveles.add(
        String(grupo.nivel)
      );
    }
  });

  // Llenar filtro de sección
  if (selectSeccion) {
    selectSeccion.innerHTML =
      '<option value="">Todas las secciones</option>';

    Array.from(secciones.entries())
      .sort((a, b) =>
        String(a[1]).localeCompare(
          String(b[1]),
          'es',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
      )
      .forEach(([id, nombre]) => {
        selectSeccion.add(
          new Option(nombre, id)
        );
      });

    if (
      secciones.has(
        String(valorSeccionActual)
      )
    ) {
      selectSeccion.value =
        valorSeccionActual;
    }
  }

  // Llenar filtro de nivel
  if (selectNivel) {
    selectNivel.innerHTML =
      '<option value="">Todos los niveles</option>';

    Array.from(niveles)
      .sort((a, b) =>
        a.localeCompare(
          b,
          'es',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
      )
      .forEach((nivel) => {
        selectNivel.add(
          new Option(nivel, nivel)
        );
      });

    if (
      niveles.has(
        String(valorNivelActual)
      )
    ) {
      selectNivel.value =
        valorNivelActual;
    }
  }
}

  /* ==========================================
     ACCIONES DE LAS TABLAS
     ========================================== */

  async function manejarAccionesTabla(evento) {
  const verEstudiante =
    evento.target.closest(
      '.consulta-ver-estudiante'
    );

  const verMatriculado =
    evento.target.closest(
      '.consulta-ver-matriculado'
    );

  const editarEstudiante =
    evento.target.closest(
      '.consulta-editar-estudiante'
    );

  const verProfesor =
    evento.target.closest(
      '.consulta-ver-profesor'
    );

  const verMatricula =
    evento.target.closest(
      '.consulta-ver-matricula'
    );

  const verAsistencia =
    evento.target.closest(
      '.consulta-ver-asistencia'
    );

  const verGrupo =
    evento.target.closest(
      '.consulta-ver-grupo'
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

  if (verMatriculado) {
    mostrarDetalleMatriculado(
      verMatriculado.dataset.estudiante,
      verMatriculado.dataset.matricula
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
    return;
  }

  if (verGrupo) {
    await mostrarDetalleGrupo(
      verGrupo.dataset.id
    );
  }
}

  async function mostrarDetalleEstudiante(id) {
    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
      'Vista previa del estudiante';

    contenido.innerHTML = `
      <div class="text-center py-4 text-muted">
        <span
          class="spinner-border spinner-border-sm me-2">
        </span>
        Cargando información...
      </div>
    `;

    modificar.classList.add('hidden');
    modificar.dataset.id = '';

    abrirModalDetalle();

    try {
      const respuesta = await apiFetch(
        `/api/estudiantes/${id}`
      );

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo obtener la información del estudiante.'
        );
      }

      const estudiante =
        await respuesta.json();
       
      documentoActual = estudiante;
tipoDocumentoActual = 'estudiante';

prepararEncabezadoDocumento(
  'Ficha del estudiante'
);

      const activo =
        estudiante.estado == 1 ||
        estudiante.estado === true ||
        estudiante.estado === undefined;

      contenido.innerHTML = `
        <div class="row g-3">


          ${crearCampoDetalle(
            'Identificación',
            estudiante.id_estudiante ??
            estudiante.id ??
            '-'
          )}

          ${crearCampoDetalle(
            'Nombre completo',
            formarNombre(estudiante) || '-'
          )}

          ${crearCampoDetalle(
            'Fecha de nacimiento',
            limpiarFecha(
              estudiante.fecha_nacimiento
            )
          )}

          ${crearCampoDetalle(
            'Fecha de ingreso',
            limpiarFecha(
              estudiante.fecha_ingreso
            )
          )}

          ${crearCampoDetalle(
            'Género',
            mostrarGenero(
              estudiante.genero
            )
          )}

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
          <i
            class="bi bi-exclamation-circle fs-2 d-block mb-2">
          </i>
          ${error.message}
        </div>
      `;
    }
  }

  function mostrarDetalleMatriculado(
  idEstudiante,
  idMatricula,
) {
  const registro =
    estudiantesMatriculados.find(
      (item) => {
        const coincideEstudiante =
          String(item.id_estudiante) ===
          String(idEstudiante);

        const coincideMatricula =
          !idMatricula ||
          String(item.id_matricula) ===
          String(idMatricula);

        return (
          coincideEstudiante &&
          coincideMatricula
        );
      }
    );

  const contenido = document.getElementById(
    'consulta-detalle-contenido'
  );

  const titulo = document.getElementById(
    'consulta-detalle-titulo'
  );

  const modificar = document.getElementById(
    'consulta-detalle-modificar'
  );

  if (!contenido || !titulo || !modificar) {
    return;
  }

  titulo.textContent =
    'Vista previa del estudiante matriculado';

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  if (!registro) {
    contenido.innerHTML = `
      <div class="text-center py-5 text-danger">
        <i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>
        No se encontró la información del estudiante matriculado.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  documentoActual = registro;
  tipoDocumentoActual = 'matriculado';

  prepararEncabezadoDocumento(
    'Constancia de estudiante matriculado'
  );

  const activo =
    registro.estado == 1 ||
    registro.estado === true;

  contenido.innerHTML = `
    <div class="consulta-documento-seccion">

      <h3 class="consulta-documento-seccion-titulo">
        Información del estudiante
      </h3>

      <div class="consulta-documento-grid">

        ${crearCampoDetalleDocumento(
          'Identificación',
          registro.id_estudiante ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Nombre completo',
          formarNombre(registro) || '-'
        )}

        ${crearCampoDetalleDocumento(
          'Número de matrícula',
          registro.id_matricula ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Fecha de matrícula',
          limpiarFecha(
            registro.fecha_matricula ||
            registro.fecha_asignacion
          )
        )}

      </div>
    </div>

    <div class="consulta-documento-seccion">

      <h3 class="consulta-documento-seccion-titulo">
        Información académica
      </h3>

      <div class="consulta-documento-grid">

        ${crearCampoDetalleDocumento(
          'Grupo',
          registro.nombre_grupo ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Sección',
          registro.nombre_seccion ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Nivel',
          registro.nivel ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Período lectivo',
          registro.periodo_lectivo ?? '-'
        )}

        ${crearCampoDetalleDocumento(
          'Estado',
          activo ? 'Activo' : 'Inactivo'
        )}

      </div>
    </div>
  `;

  abrirModalDetalle();
}

  function mostrarDetalleProfesor(id) {
    const profesor = profesores.find(
      (item) => {
        return String(
          item.id_profesor ?? item.id
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
     'Vista previa del profesor';

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

    documentoActual = profesor;
tipoDocumentoActual = 'profesor';

prepararEncabezadoDocumento(
  'Ficha del profesor'
);

    const activo =
      profesor.estado == 1 ||
      profesor.estado === true;

    contenido.innerHTML = `
      <div class="row g-3">

        ${crearCampoDetalle(
          'Identificación',
          profesor.id_profesor ??
          profesor.id ??
          '-'
        )}

        ${crearCampoDetalle(
          'Nombre completo',
          formarNombre(profesor) || '-'
        )}

        ${crearCampoDetalle(
          'Materia',
          profesor.materia ??
          'Sin asignar'
        )}

        ${crearCampoDetalle(
          'Fecha de ingreso',
          limpiarFecha(
            profesor.fecha_ingreso
          )
        )}

        ${crearCampoDetalle(
          'Estado',
          activo
            ? '<span class="badge bg-success">Activo</span>'
            : '<span class="badge bg-danger">Inactivo</span>'
        )}

      </div>

      <div class="alert alert-light border mt-4 mb-0 small">
        <i class="bi bi-info-circle me-1"></i>
        La gestión del profesor se realiza desde
        el módulo de Profesores.
      </div>
    `;

    abrirModalDetalle();
  }

  async function mostrarDetalleGrupo(idGrupo) {
  const contenido =
    document.getElementById(
      'consulta-detalle-contenido'
    );

  const titulo =
    document.getElementById(
      'consulta-detalle-titulo'
    );

  const modificar =
    document.getElementById(
      'consulta-detalle-modificar'
    );

  if (
    !contenido ||
    !titulo ||
    !modificar
  ) {
    return;
  }

  titulo.textContent =
    'Vista previa del grupo';

  modificar.classList.add('hidden');
  modificar.dataset.id = '';

  contenido.innerHTML = `
    <div class="text-center py-5 text-muted">
      <span
        class="spinner-border spinner-border-sm me-2">
      </span>
      Preparando información del grupo...
    </div>
  `;

  abrirModalDetalle();

  try {
    const grupo = grupos.find(
      (item) =>
        String(item.id_grupo) ===
        String(idGrupo)
    );

    if (!grupo) {
      throw new Error(
        'No se encontró la información general del grupo.'
      );
    }

    const respuesta = await apiFetch(
      `/api/procesos/grupos/${idGrupo}/detalle`
    );

    if (!respuesta.ok) {
      throw new Error(
        'No se pudo obtener la lista del grupo.'
      );
    }

    const detalle =
      await respuesta.json();

    const estudiantesGrupo =
      Array.isArray(detalle.estudiantes)
        ? [...detalle.estudiantes]
        : [];

    const profesoresGrupo =
      Array.isArray(detalle.profesores)
        ? detalle.profesores
        : [];

    /*
     * El backend ya entrega los estudiantes
     * ordenados por apellido y nombre.
     * Dejamos también esta ordenación en frontend
     * como respaldo.
     */
    estudiantesGrupo.sort((a, b) => {
      const nombreA =
        `${a.apellido1 ?? ''} ${
          a.apellido2 ?? ''
        } ${a.nombre ?? ''}`;

      const nombreB =
        `${b.apellido1 ?? ''} ${
          b.apellido2 ?? ''
        } ${b.nombre ?? ''}`;

      return nombreA.localeCompare(
        nombreB,
        'es',
        {
          sensitivity: 'base'
        }
      );
    });

    const ocupados =
      estudiantesGrupo.length;

    const capacidad =
      Number(grupo.capacidad ?? 0);

    const disponibles =
      Math.max(
        capacidad - ocupados,
        0
      );

    documentoActual = {
      ...grupo,
      estudiantes: estudiantesGrupo,
      profesores: profesoresGrupo,
      ocupados
    };

    tipoDocumentoActual = 'grupo';

    prepararEncabezadoDocumento(
      `Lista del grupo ${grupo.nombre_grupo ?? ''}`
    );

    const profesoresHtml =
      profesoresGrupo.length
        ? profesoresGrupo
            .map((profesor) => {
              const nombreProfesor =
                `${profesor.nombre ?? ''} ${
                  profesor.apellido1 ?? ''
                } ${
                  profesor.apellido2 ?? ''
                }`
                  .replace(/\s+/g, ' ')
                  .trim();

              return `
                <div class="consulta-profesor-grupo">
                  <div>
                    <strong>
                      ${nombreProfesor || '-'}
                    </strong>

                    <span class="d-block text-muted small">
                      ${profesor.materia || 'General'}
                    </span>
                  </div>
                </div>
              `;
            })
            .join('')
        : `
            <p class="text-muted mb-0">
              No hay profesores activos asignados a este grupo.
            </p>
          `;

    const estudiantesHtml =
      estudiantesGrupo.length
        ? estudiantesGrupo
            .map(
              (estudiante, indice) => {
                const nombreEstudiante =
                  `${estudiante.apellido1 ?? ''} ${
                    estudiante.apellido2 ?? ''
                  }, ${
                    estudiante.nombre ?? ''
                  }`
                    .replace(/\s+/g, ' ')
                    .trim();

                return `
                  <tr>
                    <td class="text-muted">
                      ${indice + 1}
                    </td>

                    <td>
                      ${estudiante.id_estudiante ?? '-'}
                    </td>

                    <td class="fw-semibold">
                      ${nombreEstudiante}
                    </td>
                  </tr>
                `;
              }
            )
            .join('')
        : `
            <tr>
              <td
                colspan="3"
                class="text-center py-4 text-muted">
                Este grupo no tiene estudiantes matriculados.
              </td>
            </tr>
          `;

    contenido.innerHTML = `
      <div class="consulta-documento-seccion">

        <h3 class="consulta-documento-seccion-titulo">
          Información del grupo
        </h3>

        <div class="consulta-documento-grid">

          ${crearCampoDetalleDocumento(
            'Grupo',
            grupo.nombre_grupo ?? '-'
          )}

          ${crearCampoDetalleDocumento(
            'Nivel',
            grupo.nivel ?? '-'
          )}

          ${crearCampoDetalleDocumento(
            'Sección',
            grupo.nombre_seccion ?? '-'
          )}

          ${crearCampoDetalleDocumento(
            'Aula',
            grupo.aula ?? '-'
          )}

          ${crearCampoDetalleDocumento(
            'Período lectivo',
            grupo.periodo_lectivo ?? '-'
          )}

          ${crearCampoDetalleDocumento(
            'Capacidad',
            capacidad
          )}

          ${crearCampoDetalleDocumento(
            'Estudiantes matriculados',
            ocupados
          )}

          ${crearCampoDetalleDocumento(
            'Cupos disponibles',
            disponibles
          )}

        </div>
      </div>

      <div class="consulta-documento-seccion">

        <h3 class="consulta-documento-seccion-titulo">
          Profesorado asignado
        </h3>

        <div class="consulta-profesores-grupo">
          ${profesoresHtml}
        </div>

      </div>

      <div class="consulta-documento-seccion">

        <div
          class="d-flex justify-content-between align-items-center mb-3">

          <h3 class="consulta-documento-seccion-titulo mb-0">
            Lista de estudiantes
          </h3>

          <span class="badge bg-primary">
            ${ocupados}
            ${
              ocupados === 1
                ? 'estudiante'
                : 'estudiantes'
            }
          </span>

        </div>

        <div class="table-responsive">

          <table
            class="table table-sm consulta-lista-grupo align-middle">

            <thead>
              <tr>
                <th style="width: 60px;">
                  #
                </th>

                <th style="width: 120px;">
                  ID
                </th>

                <th>
                  Estudiante
                </th>
              </tr>
            </thead>

            <tbody>
              ${estudiantesHtml}
            </tbody>

          </table>

        </div>

      </div>
    `;
  } catch (error) {
    console.error(
      'Error mostrando detalle del grupo:',
      error
    );

    documentoActual = null;
    tipoDocumentoActual = null;

    contenido.innerHTML = `
      <div class="text-center py-5 text-danger">

        <i
          class="bi bi-exclamation-circle fs-2 d-block mb-2">
        </i>

        ${error.message}

      </div>
    `;
  }
}

  function mostrarDetalleMatricula(id) {
    const registro = matriculas.find(
      (item) => {
        return String(
          item.id_matricula
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
      'Vista previa de la matrícula';

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

    documentoActual = registro;
tipoDocumentoActual = 'matricula';

prepararEncabezadoDocumento(
  'Comprobante de matrícula'
);

    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`.trim();

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
    const registro = asistencias.find(
      (item) => {
        return String(
          item.id_asistencia
        ) === String(id);
      }
    );

    const contenido =
      document.getElementById(
        'consulta-detalle-contenido'
      );

    const titulo =
      document.getElementById(
        'consulta-detalle-titulo'
      );

    const modificar =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    if (
      !contenido ||
      !titulo ||
      !modificar
    ) {
      return;
    }

    titulo.textContent =
     'Vista previa de la asistencia';

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

    documentoActual = registro;
tipoDocumentoActual = 'asistencia';

prepararEncabezadoDocumento(
  'Registro de asistencia'
);

    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`.trim();

    const profesor = `${
      registro.profesor_nombre ?? ''
    } ${
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
      const respuesta = await apiFetch(
        `/api/estudiantes/${id}`
      );

      if (!respuesta.ok) {
        throw new Error(
          'No se pudo obtener la información del estudiante.'
        );
      }

      const estudiante =
        await respuesta.json();

      const campoId =
        document.getElementById(
          'persona-id'
        );

      if (campoId) {
        campoId.value =
          estudiante.id_estudiante ??
          estudiante.id ??
          '';
      }

      const campoNombre =
        document.getElementById(
          'nombre'
        );

      if (campoNombre) {
        campoNombre.value =
          estudiante.nombre ?? '';
      }

      const campoApellido1 =
        document.getElementById(
          'apellido1'
        );

      if (campoApellido1) {
        campoApellido1.value =
          estudiante.apellido1 ?? '';
      }

      const campoApellido2 =
        document.getElementById(
          'apellido2'
        );

      if (campoApellido2) {
        campoApellido2.value =
          estudiante.apellido2 ?? '';
      }

      const campoNacimiento =
        document.getElementById(
          'fecha_nacimiento'
        );

      if (campoNacimiento) {
        campoNacimiento.value =
          estudiante.fecha_nacimiento
            ? String(
                estudiante.fecha_nacimiento
              ).split('T')[0]
            : '';
      }

      const campoGenero =
        document.getElementById(
          'genero'
        );

      if (campoGenero) {
        campoGenero.value =
          estudiante.genero ?? '';
      }

      const ingreso =
        document.getElementById(
          'persona-fecha-ingreso'
        );

      if (ingreso) {
        ingreso.value =
          estudiante.fecha_ingreso
            ? String(
                estudiante.fecha_ingreso
              ).split('T')[0]
            : '';
      }

      const titulo =
        document.getElementById(
          'persona-form-title'
        );

      if (titulo) {
        titulo.textContent =
          'Editar Estudiante';
      }

      const botonGuardar =
        document.getElementById(
          'persona-submit'
        );

      if (botonGuardar) {
        botonGuardar.innerHTML =
          '<i class="bi bi-check2-circle"></i> Guardar Cambios';
      }

      const modalDetalle =
        document.getElementById(
          'modalDetalleConsulta'
        );

      if (modalDetalle) {
        bootstrap.Modal
          .getInstance(modalDetalle)
          ?.hide();
      }

      const modalEstudiante =
        document.getElementById(
          'modalEstudiante'
        );

      if (modalEstudiante) {
        const instancia =
          bootstrap.Modal.getInstance(
            modalEstudiante
          ) ||
          new bootstrap.Modal(
            modalEstudiante
          );

        instancia.show();
      }
    } catch (error) {
      mostrarMensajeConsulta(
        error.message
      );
    }
  }

  function modificarDesdeDetalle() {
    const boton =
      document.getElementById(
        'consulta-detalle-modificar'
      );

    const id = boton?.dataset.id;

    if (id) {
      abrirEdicionEstudiante(id);
    }
  }

  function abrirModalDetalle() {
    const modal =
      document.getElementById(
        'modalDetalleConsulta'
      );

    if (!modal) return;

    const instancia =
      bootstrap.Modal.getInstance(modal) ||
      new bootstrap.Modal(modal);

    instancia.show();
  }

  function descargarDocumentoPDF() {
  if (!documentoActual || !tipoDocumentoActual) {
    mostrarMensajeConsulta(
      'No hay un documento preparado para descargar.'
    );
    return;
  }

  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {
    mostrarMensajeConsulta(
      'La herramienta para generar PDF no está disponible.'
    );
    return;
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const margenIzquierdo = 20;
  const anchoPagina = 210;
  const anchoContenido =
    anchoPagina - margenIzquierdo * 2;

  let posicionY = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(
    'EDUCONTROL',
    margenIzquierdo,
    posicionY
  );

  posicionY += 8;

  pdf.setFontSize(12);
  pdf.text(
    obtenerTituloDocumento(),
    margenIzquierdo,
    posicionY
  );

  posicionY += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(
    `Fecha de emisión: ${obtenerFechaActual()}`,
    margenIzquierdo,
    posicionY
  );

  posicionY += 5;

  pdf.line(
    margenIzquierdo,
    posicionY,
    anchoPagina - margenIzquierdo,
    posicionY
  );

  posicionY += 10;

  const campos =
    obtenerCamposDocumentoPDF();

  campos.forEach((campo) => {
    const etiqueta = String(
      campo.etiqueta ?? ''
    );

    const valor = String(
      campo.valor ?? '-'
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(
      `${etiqueta}:`,
      margenIzquierdo,
      posicionY
    );

    posicionY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const lineas = pdf.splitTextToSize(
      limpiarTextoPDF(valor),
      anchoContenido
    );

    pdf.text(
      lineas,
      margenIzquierdo,
      posicionY
    );

    posicionY +=
      lineas.length * 5 + 5;

    if (posicionY > 270) {
      pdf.addPage();
      posicionY = 20;
    }
  });

  pdf.setFontSize(8);
  pdf.setTextColor(100);

  pdf.text(
    'Documento generado digitalmente por EduControl.',
    margenIzquierdo,
    287
  );

  const nombreArchivo =
    obtenerNombreArchivoPDF();

  pdf.save(nombreArchivo);
}

function obtenerTituloDocumento() {
  const titulos = {
    estudiante:
      'Ficha del estudiante',

    matriculado:
      'Constancia de estudiante matriculado',

    profesor:
      'Ficha del profesor',

    matricula:
      'Comprobante de matrícula',

    asistencia:
      'Registro de asistencia',

    grupo:
      'Lista oficial del grupo'
  };

  return (
    titulos[tipoDocumentoActual] ||
    'Documento académico'
  );
}
function obtenerCamposDocumentoPDF() {
  const registro =
    documentoActual || {};

  if (tipoDocumentoActual === 'estudiante') {
    const activo =
      registro.estado == 1 ||
      registro.estado === true ||
      registro.estado === undefined;

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_estudiante ??
          registro.id ??
          '-'
      },
      {
        etiqueta: 'Nombre completo',
        valor:
          formarNombre(registro) ||
          '-'
      },
      {
        etiqueta: 'Fecha de nacimiento',
        valor:
          limpiarFecha(
            registro.fecha_nacimiento
          )
      },
      {
        etiqueta: 'Fecha de ingreso',
        valor:
          limpiarFecha(
            registro.fecha_ingreso
          )
      },
      {
        etiqueta: 'Género',
        valor:
          mostrarGenero(
            registro.genero
          )
      },
      {
        etiqueta: 'Estado',
        valor:
          activo
            ? 'Activo'
            : 'Inactivo'
      }
    ];
  }

  if (tipoDocumentoActual === 'matriculado') {
    const activo =
      registro.estado == 1 ||
      registro.estado === true;

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_estudiante ??
          '-'
      },
      {
        etiqueta: 'Nombre completo',
        valor:
          formarNombre(registro) ||
          '-'
      },
      {
        etiqueta: 'Número de matrícula',
        valor:
          registro.id_matricula ??
          '-'
      },
      {
        etiqueta: 'Fecha de matrícula',
        valor:
          limpiarFecha(
            registro.fecha_matricula ||
            registro.fecha_asignacion
          )
      },
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Sección',
        valor:
          registro.nombre_seccion ??
          '-'
      },
      {
        etiqueta: 'Nivel',
        valor:
          registro.nivel ??
          '-'
      },
      {
        etiqueta: 'Período lectivo',
        valor:
          registro.periodo_lectivo ??
          '-'
      },
      {
        etiqueta: 'Estado',
        valor:
          activo
            ? 'Activo'
            : 'Inactivo'
      }
    ];
  }

  if (tipoDocumentoActual === 'profesor') {
    const activo =
      registro.estado == 1 ||
      registro.estado === true;

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_profesor ??
          registro.id ??
          '-'
      },
      {
        etiqueta: 'Nombre completo',
        valor:
          formarNombre(registro) ||
          '-'
      },
      {
        etiqueta: 'Materia',
        valor:
          registro.materia ??
          'Sin asignar'
      },
      {
        etiqueta: 'Fecha de ingreso',
        valor:
          limpiarFecha(
            registro.fecha_ingreso
          )
      },
      {
        etiqueta: 'Estado',
        valor:
          activo
            ? 'Activo'
            : 'Inactivo'
      }
    ];
  }

  if (tipoDocumentoActual === 'matricula') {
    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_matricula ??
          '-'
      },
      {
        etiqueta: 'Fecha',
        valor:
          limpiarFecha(
            registro.fecha
          )
      },
      {
        etiqueta: 'Estudiante',
        valor:
          estudiante || '-'
      },
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Período',
        valor:
          `${registro.periodo_lectivo ?? '-'} / ${
            registro.anio_lectivo ?? '-'
          }`
      },
      {
        etiqueta: 'Tipo',
        valor:
          registro.tipo_matricula ??
          '-'
      },
      {
        etiqueta: 'Estado',
        valor:
          registro.estado_matricula ??
          '-'
      },
      {
        etiqueta: 'Observaciones',
        valor:
          registro.observaciones ||
          'Sin observaciones'
      }
    ];
  }

  if (tipoDocumentoActual === 'asistencia') {
    const estudiante = `${
      registro.estudiante_nombre ?? ''
    } ${
      registro.estudiante_apellido1 ?? ''
    } ${
      registro.estudiante_apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    const profesor = `${
      registro.profesor_nombre ?? ''
    } ${
      registro.profesor_apellido1 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();

    return [
      {
        etiqueta: 'Identificación',
        valor:
          registro.id_asistencia ??
          '-'
      },
      {
        etiqueta: 'Fecha',
        valor:
          limpiarFecha(
            registro.fecha
          )
      },
      {
        etiqueta: 'Estudiante',
        valor:
          estudiante || '-'
      },
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Profesor',
        valor:
          profesor || '-'
      },
      {
        etiqueta: 'Estado',
        valor:
          registro.estado_asistencia ??
          '-'
      },
      {
        etiqueta: 'Observaciones',
        valor:
          registro.observaciones ||
          'Sin observaciones'
      }
    ];
  }

  if (tipoDocumentoActual === 'grupo') {
    const estudiantesGrupo =
      Array.isArray(registro.estudiantes)
        ? registro.estudiantes
        : [];

    const profesoresGrupo =
      Array.isArray(registro.profesores)
        ? registro.profesores
        : [];

    const capacidad =
      Number(registro.capacidad ?? 0);

    const ocupados =
      estudiantesGrupo.length;

    const disponibles =
      Math.max(
        capacidad - ocupados,
        0
      );

    const profesoresTexto =
      profesoresGrupo.length
        ? profesoresGrupo
            .map((profesor) => {
              const nombre = `${
                profesor.nombre ?? ''
              } ${
                profesor.apellido1 ?? ''
              } ${
                profesor.apellido2 ?? ''
              }`
                .replace(/\s+/g, ' ')
                .trim();

              return `${nombre}${
                profesor.materia
                  ? ` - ${profesor.materia}`
                  : ''
              }`;
            })
            .join('\n')
        : 'Sin profesor asignado';

    const estudiantesTexto =
      estudiantesGrupo.length
        ? estudiantesGrupo
            .map(
              (estudiante, indice) => {
                const nombre = `${
                  estudiante.apellido1 ?? ''
                } ${
                  estudiante.apellido2 ?? ''
                }, ${
                  estudiante.nombre ?? ''
                }`
                  .replace(/\s+/g, ' ')
                  .trim();

                return `${
                  indice + 1
                }. ${nombre}`;
              }
            )
            .join('\n')
        : 'No hay estudiantes matriculados.';

    return [
      {
        etiqueta: 'Grupo',
        valor:
          registro.nombre_grupo ??
          '-'
      },
      {
        etiqueta: 'Nivel',
        valor:
          registro.nivel ??
          '-'
      },
      {
        etiqueta: 'Sección',
        valor:
          registro.nombre_seccion ??
          '-'
      },
      {
        etiqueta: 'Aula',
        valor:
          registro.aula ??
          '-'
      },
      {
        etiqueta: 'Período lectivo',
        valor:
          registro.periodo_lectivo ??
          '-'
      },
      {
        etiqueta: 'Capacidad',
        valor:
          capacidad
      },
      {
        etiqueta: 'Estudiantes matriculados',
        valor:
          ocupados
      },
      {
        etiqueta: 'Cupos disponibles',
        valor:
          disponibles
      },
      {
        etiqueta: 'Profesorado asignado',
        valor:
          profesoresTexto
      },
      {
        etiqueta: 'Lista de estudiantes en orden alfabético',
        valor:
          estudiantesTexto
      }
    ];
  }

  return [];
}

function obtenerNombreArchivoPDF() {
  const registro =
    documentoActual || {};

  const nombres = {
    estudiante:
      `estudiante-${
        registro.id_estudiante ??
        registro.id ??
        'documento'
      }.pdf`,

    matriculado:
      `estudiante-matriculado-${
        registro.id_estudiante ??
        'documento'
      }.pdf`,

    profesor:
      `profesor-${
        registro.id_profesor ??
        registro.id ??
        'documento'
      }.pdf`,

    matricula:
      `matricula-${
        registro.id_matricula ??
        'documento'
      }.pdf`,

    asistencia:
      `asistencia-${
        registro.id_asistencia ??
        'documento'
      }.pdf`,

    grupo:
      `lista-grupo-${
        String(
          registro.nombre_grupo ??
          registro.id_grupo ??
          'documento'
        )
          .trim()
          .replace(/\s+/g, '-')
          .toLowerCase()
      }.pdf`
  };

  return (
    nombres[tipoDocumentoActual] ||
    'documento-academico.pdf'
  );
} 

function limpiarTextoPDF(valor) {
  const contenedor =
    document.createElement('div');

  contenedor.innerHTML =
    String(valor ?? '');

  return (
    contenedor.textContent ||
    contenedor.innerText ||
    '-'
  );
}

function obtenerFechaActual() {
  return new Date().toLocaleDateString(
    'es-CR'
  );
}

function prepararEncabezadoDocumento(titulo) {
  const tituloDocumento = document.getElementById(
    'consulta-documento-titulo'
  );

  const subtituloDocumento = document.getElementById(
    'consulta-documento-subtitulo'
  );

  const fechaDocumento = document.getElementById(
    'consulta-documento-fecha'
  );

  if (tituloDocumento) {
    tituloDocumento.textContent =
      titulo || 'Documento académico';
  }

  if (subtituloDocumento) {
    subtituloDocumento.textContent =
      'Sistema de Gestión Escolar';
  }

  if (fechaDocumento) {
    fechaDocumento.textContent =
      obtenerFechaActual();
  }
}

    function crearCampoDetalle(etiqueta, valor) {
    return `
      <div class="col-md-6">
        <div class="bg-white border rounded p-3 h-100">
          <span class="text-muted small d-block mb-1">
            ${etiqueta}
          </span>

          <div class="fw-semibold">
            ${valor}
          </div>
        </div>
      </div>
    `;
  }

  function crearCampoDetalleDocumento(
  etiqueta,
  valor,
  completo = false
) {
  return `
    <div
      class="consulta-documento-campo ${
        completo ? 'completo' : ''
      }">

      <span class="consulta-documento-etiqueta">
        ${etiqueta}
      </span>

      <div class="consulta-documento-valor">
        ${valor ?? '-'}
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

    return (
      generos[genero] ||
      genero ||
      '-'
    );
  }

  function mostrarMensajeConsulta(mensaje) {
    if (
      typeof showResultModal ===
      'function'
    ) {
      showResultModal(
        'error',
        'No se pudo realizar la acción',
        mensaje
      );

      return;
    }

    alert(mensaje);
  }

  /* ==========================================
     ESTADOS DE LA TABLA
     ========================================== */

  function mostrarCargando() {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="text-center py-5 text-muted">

          <span
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true">
          </span>

          Cargando información...
        </td>
      </tr>
    `;
  }

  function mostrarError(mensaje) {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="8"
          class="text-center py-5 text-danger">

          <i
            class="bi bi-exclamation-circle fs-2 d-block mb-2">
          </i>

          ${mensaje}
        </td>
      </tr>
    `;
  }

  function mostrarSinResultados(columnas) {
    const body =
      document.getElementById(
        'consulta-tabla-body'
      );

    if (!body) return;

    body.innerHTML = `
      <tr>
        <td
          colspan="${columnas}"
          class="text-center py-5 text-muted">

          <i
            class="bi bi-search fs-2 d-block mb-2">
          </i>

          No se encontraron resultados.
        </td>
      </tr>
    `;
  }

  /* ==========================================
     FUNCIONES AUXILIARES
     ========================================== */

  function actualizarTitulo(
    titulo,
    cantidad
  ) {
    const tituloTabla =
      document.getElementById(
        'consulta-titulo-tabla'
      );

    const cantidadTexto =
      document.getElementById(
        'consulta-cantidad'
      );

    if (tituloTabla) {
      tituloTabla.textContent = titulo;
    }

    if (cantidadTexto) {
      const plural =
        cantidad === 1
          ? ''
          : 's';

      cantidadTexto.textContent =
        `${cantidad} resultado${plural} ` +
        `encontrado${plural}`;
    }
  }

  function cambiarEncabezado(contenido) {
    const head =
      document.getElementById(
        'consulta-tabla-head'
      );

    if (head) {
      head.innerHTML = contenido;
    }
  }

  function obtenerBusqueda() {
    return (
      document.getElementById(
        'consulta-busqueda'
      )?.value
        .trim()
        .toLowerCase() ||
      ''
    );
  }

  function obtenerEstado() {
    return (
      document.getElementById(
        'consulta-estado'
      )?.value ||
      ''
    );
  }

  function formarNombre(persona) {
    if (!persona) return '';

    return `${
      persona.nombre ?? ''
    } ${
      persona.apellido1 ?? ''
    } ${
      persona.apellido2 ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
  }

  function limpiarFecha(fecha) {
    if (!fecha) return '-';

    return String(fecha).split('T')[0];
  }

  /* ==========================================
     NOTIFICAR QUE EL MÓDULO ESTÁ LISTO
     ========================================== */

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