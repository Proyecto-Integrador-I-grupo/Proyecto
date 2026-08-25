import {
  apiFetch,
  showResultModal,
  currentUser
} from './ui.js';

(function () {
  const moduleName = 'consultas';

let estudiantes = [];
let estudiantesMatriculados = [];
let profesores = [];
let matriculas = [];
let asistencias = [];
let gruposAsignados = [];
let grupos = [];
let auditorias = [];

// Registro que se está mostrando en la vista previa
let documentoActual = null;
let tipoDocumentoActual = null;

const CONSULTAS_POR_ROL = {
  administrador: ['prematriculados', 'matriculados', 'profesores', 'matriculas', 'asistencia', 'grupos', 'auditoria'],
  asistente: ['prematriculados', 'matriculados', 'matriculas'],
  profesor: ['asistencia']
};

function rolActual() {
  return String(currentUser?.rol || '').toLowerCase().trim();
}

function tiposConsultaPermitidos() {
  return CONSULTAS_POR_ROL[rolActual()] || [];
}

function aplicarPermisosConsultaUI() {
  const permitidos = tiposConsultaPermitidos();
  const select = document.getElementById('consulta-tipo');

  if (select) {
    Array.from(select.options).forEach((option) => {
      option.hidden = !permitidos.includes(option.value);
      option.disabled = !permitidos.includes(option.value);
    });

    if (!permitidos.includes(select.value)) {
      select.value = permitidos[0] || 'asistencia';
    }
  }

  const statMap = {
    'consulta-total-estudiantes': 'prematriculados',
  'consulta-total-matriculados': 'matriculados',
  'consulta-total-profesores': 'profesores',
  'consulta-total-matriculas': 'matriculas',
  'consulta-total-asistencias': 'asistencia',
  'consulta-total-grupos': 'grupos',
  'consulta-total-auditorias': 'auditoria'
  };

  Object.entries(statMap).forEach(([id, tipo]) => {
    const el = document.getElementById(id);
    const col = el?.closest('.col-6');
    if (col) col.hidden = !permitidos.includes(tipo);
  });
}

  window.EduControlModules = window.EduControlModules || {};

  window.EduControlModules[moduleName] = {
    name: moduleName,

    init() {
      const section = document.getElementById('consultas-view');
      if (!section || section.dataset.wired === '1') return;

      section.dataset.wired = '1';

      aplicarPermisosConsultaUI();
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
    aplicarPermisosConsultaUI();

    try {
      const permitidos = tiposConsultaPermitidos();

      const pedir = async (tipo, url) => {
        if (!permitidos.includes(tipo)) return [];
        const response = await apiFetch(url);
        if (!response.ok) return [];
        return await response.json();
      };

      const pedirGrupos = async () => {
        const response = await apiFetch('/api/procesos/grupos');
        if (!response.ok) return [];
        const data = await response.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      };

      [estudiantes, estudiantesMatriculados, profesores, matriculas, asistencias, grupos, auditorias] = await Promise.all([
        pedir('prematriculados', '/api/estudiantes'),
        pedir('matriculados', '/api/estudiantes/matriculados'),
        pedir('profesores', '/api/profesores'),
        pedir('matriculas', '/api/procesos/matricula'),
        pedir('asistencia', '/api/procesos/asistencia'),
        pedirGrupos(),
        pedir('auditoria', '/api/auditorias')
      ]);

      gruposAsignados = grupos;

      actualizarResumen();
      cargarFiltroGrupos();
      cargarFiltrosMatriculados();
      actualizarContextoProfesor();
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

    const totalGrupos = document.getElementById(
      'consulta-total-grupos'
   );

    const totalAuditorias = document.getElementById(
      'consulta-total-auditorias'
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

    if (totalGrupos) {
      totalGrupos.textContent = grupos.length;
   }

    if (totalAuditorias) {
      totalAuditorias.textContent = auditorias.length;
    }
  }

  /* ==========================================
     CAMBIO DEL TIPO DE CONSULTA
     ========================================== */

  function actualizarConsulta() {
    let tipo =
      document.getElementById('consulta-tipo')?.value ||
      tiposConsultaPermitidos()[0] ||
      'asistencia';

    const permitidos = tiposConsultaPermitidos();
    if (!permitidos.includes(tipo)) {
      tipo = permitidos[0] || 'asistencia';
      const selector = document.getElementById('consulta-tipo');
      if (selector) selector.value = tipo;
    }

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

    if (tipo === 'auditoria' || tipo === 'grupos') {
      select.innerHTML = '<option value="">Todos</option>';
    } else if (tipo === 'asistencia') {
  mostrarAsistencias();
  return;
}

if (tipo === 'grupos') {
  mostrarGrupos();
  return;
}

if (tipo === 'auditoria') {
  mostrarAuditorias();
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

    const opcionExiste = Array.from(select.options).some(
      (opcion) => opcion.value === valorActual
    );

    select.value = opcionExiste ? valorActual : '';
  }

  function actualizarTextoBusqueda(tipo) {
    const input = document.getElementById(
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
    'Buscar por nombre de grupo, sección o nivel...',

  auditoria:
    'Buscar por módulo, acción, usuario o detalle...'
    };

    input.placeholder =
      textos[tipo] || 'Buscar...';
  }

  function actualizarFiltrosVisibles(tipo) {
    const filtroGrupo = document.querySelector(
      '.consulta-filtro-grupo'
    );

    const filtroFecha = document.querySelector(
      '.consulta-filtro-fecha'
    );

    const filtroSeccion = document.querySelector(
      '.consulta-filtro-seccion'
    );

    const filtroNivel = document.querySelector(
      '.consulta-filtro-nivel'
    );

    const usaGrupo =
  tipo === 'matriculados' ||
  tipo === 'matriculas' ||
  tipo === 'asistencia';

const usaFecha =
  tipo === 'matriculas' ||
  tipo === 'asistencia' ||
  tipo === 'auditoria';

const usaInformacionAcademica =
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
      !usaInformacionAcademica
    );

    filtroNivel?.classList.toggle(
      'hidden',
      !usaInformacionAcademica
    );

    const filtroEstado = document.querySelector('.consulta-filtro-estado');
    filtroEstado?.classList.toggle('hidden', tipo === 'auditoria' || tipo === 'grupos');
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
            class="btn btn-sm btn-outline-primary consulta-ver-profesor"
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
          `${registro.nombre_grupo ?? ''} ${registro.nombre_seccion ?? ''} ${registro.nivel ?? ''}`
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
          ${etiquetaGrupo(registro)}
        </td>

        <td>
          ${registro.periodo_lectivo ?? '-'} /
          ${registro.anio_lectivo ?? '-'}
        </td>

        <td>
          ${registro.tipo_matricula ?? '-'}
        </td>

        <td>
        <span
  class="badge ${
    String(estado).toLowerCase() === 'activa'
      ? 'bg-success'
      : String(estado).toLowerCase() === 'inactiva'
        ? 'bg-secondary'
        : String(estado).toLowerCase() === 'retirada'
          ? 'bg-danger'
          : 'bg-secondary'
  }">
  ${estado}
</span>
        </td>

        <td class="text-end">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary consulta-ver-matricula"
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
          `${registro.nombre_grupo ?? ''} ${registro.nombre_seccion ?? ''} ${registro.nivel ?? ''}`
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
          ${etiquetaGrupo(registro)}
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
            class="btn btn-sm btn-outline-primary consulta-ver-asistencia"
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

  function mostrarGrupos() {
  const busqueda = obtenerBusqueda();

  const resultados = [...grupos]
    .filter((grupo) => {
      const texto = `
        ${grupo.nombre_grupo ?? grupo.nombre ?? ''}
        ${grupo.nombre_seccion ?? grupo.seccion ?? ''}
        ${grupo.nivel ?? ''}
      `
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      return !busqueda || texto.includes(busqueda);
    })
    .sort((a, b) => {
      const nombreA = String(
        a.nombre_grupo ?? a.nombre ?? ''
      );

      const nombreB = String(
        b.nombre_grupo ?? b.nombre ?? ''
      );

      return nombreA.localeCompare(
        nombreB,
        'es',
        { sensitivity: 'base' }
      );
    });

  actualizarTitulo(
    'Lista de grupos',
    resultados.length
  );

  cambiarEncabezado(`
    <tr>
      <th>Grupo</th>
      <th>Sección</th>
      <th>Nivel</th>
      <th class="text-end">Acciones</th>
    </tr>
  `);

  if (!resultados.length) {
    mostrarSinResultados(4);
    return;
  }

  const body = document.getElementById(
    'consulta-tabla-body'
  );

  if (!body) return;

  body.innerHTML = '';

  resultados.forEach((grupo) => {
    const fila = document.createElement('tr');

    fila.innerHTML = `
      <td>
        <strong>
          ${grupo.nombre_grupo ?? grupo.nombre ?? '-'}
        </strong>
      </td>

      <td>
        ${grupo.nombre_seccion ?? grupo.seccion ?? '-'}
      </td>

      <td>
        ${grupo.nivel ?? '-'}
      </td>

      <td class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary consulta-ver-grupo"
          data-id="${grupo.id_grupo ?? grupo.id ?? ''}"
        >
          <i class="bi bi-file-earmark-text"></i>
          Vista previa
        </button>
      </td>
    `;

    body.appendChild(fila);
  });
}

  /* ==========================================
     CONSULTA DE AUDITORÍA
     ========================================== */

  function parseAuditData(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return value; }
  }

  function textoAuditoria(registro) {
    const detalle = parseAuditData(registro.datos_nuevos);
    if (detalle && typeof detalle === 'object') {
      const tipo = detalle.tipo ? ` · ${detalle.tipo}` : '';
      const accion = detalle.accion ? ` · ${detalle.accion}` : '';
      const id = detalle.id_registro ? ` · registro #${detalle.id_registro}` : '';
      return `${tipo}${accion}${id}`.replace(/^ · /, '');
    }
    return String(detalle || registro.datos_anteriores || '').slice(0, 140);
  }

  function mostrarAuditorias() {
    const busqueda = obtenerBusqueda();
    const fechaSeleccionada = document.getElementById('consulta-fecha')?.value || '';

    const resultados = [...auditorias]
      .filter((registro) => {
        const detalle = textoAuditoria(registro);
        const texto = `${registro.nombre_tabla || ''} ${registro.accion_usuario || ''} ${registro.id_usuario || ''} ${detalle}`.toLowerCase();
        const coincideBusqueda = !busqueda || texto.includes(busqueda);
        const fecha = limpiarFecha(registro.fecha_creacion || registro.fecha_modificacion);
        const coincideFecha = !fechaSeleccionada || fecha === fechaSeleccionada;
        return coincideBusqueda && coincideFecha;
      })
      .sort((a, b) => new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0));

    actualizarTitulo('Auditoría del sistema', resultados.length);
    cambiarEncabezado(`
      <tr>
        <th>Fecha</th>
        <th>Módulo / tabla</th>
        <th>Acción</th>
        <th>Usuario</th>
        <th>Detalle</th>
        <th class="text-end">Acciones</th>
      </tr>
    `);

    if (!resultados.length) {
      mostrarSinResultados(6);
      return;
    }

    const body = document.getElementById('consulta-tabla-body');
    if (!body) return;
    body.innerHTML = '';

    resultados.forEach((registro) => {
      const fila = document.createElement('tr');
      const detalle = textoAuditoria(registro) || 'Sin detalle adicional';
      fila.innerHTML = `
        <td><span class="consulta-date">${formatearFechaHora(registro.fecha_creacion)}</span></td>
        <td><span class="consulta-chip">${escapeHtml(registro.nombre_tabla || '-')}</span></td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(registro.accion_usuario || '-')}</span></td>
        <td>${escapeHtml(registro.usuario_nombre || registro.usuario_correo || (registro.id_usuario ? `Usuario #${registro.id_usuario}` : 'Sistema'))}</td>
        <td><span class="consulta-audit-detail">${escapeHtml(detalle)}</span></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary consulta-ver-auditoria" data-id="${registro.id_auditoria}">
            <i class="bi bi-eye"></i> Ver detalle
          </button>
        </td>
      `;
      body.appendChild(fila);
    });
  }

  function mostrarDetalleAuditoria(id) {
    const registro = auditorias.find((item) => String(item.id_auditoria) === String(id));
    const contenido = document.getElementById('consulta-detalle-contenido');
    const titulo = document.getElementById('consulta-detalle-titulo');
    if (!registro || !contenido || !titulo) return;

    documentoActual = registro;
    tipoDocumentoActual = 'auditoria';
    titulo.textContent = 'Detalle de auditoría';
    prepararEncabezadoDocumento('Registro de auditoría');

    const anteriores = parseAuditData(registro.datos_anteriores);
    const nuevos = parseAuditData(registro.datos_nuevos);
    contenido.innerHTML = `
      <div class="row g-3">
        ${crearCampoDetalle('ID de auditoría', registro.id_auditoria ?? '-')}
        ${crearCampoDetalle('Fecha', formatearFechaHora(registro.fecha_creacion))}
        ${crearCampoDetalle('Módulo / tabla', escapeHtml(registro.nombre_tabla || '-'))}
        ${crearCampoDetalle('Acción', escapeHtml(registro.accion_usuario || '-'))}
        ${crearCampoDetalle('Usuario', escapeHtml(registro.usuario_nombre || registro.usuario_correo || (registro.id_usuario ? `Usuario #${registro.id_usuario}` : 'Sistema')))}
        ${crearCampoDetalle('Datos anteriores', `<pre class="consulta-json">${escapeHtml(formatearJson(anteriores))}</pre>`, true)}
        ${crearCampoDetalle('Datos nuevos / detalle', `<pre class="consulta-json">${escapeHtml(formatearJson(nuevos))}</pre>`, true)}
      </div>
    `;
    abrirModalDetalle();
  }

  function formatearJson(value) {
    if (value === null || value === undefined || value === '') return 'Sin datos';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }

  function formatearFechaHora(value) {
    if (!value) return '-';
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) return limpiarFecha(value);
    return fecha.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

    const registrarGrupo = (registro) => {
      const id = registro?.id_grupo;
      const nombre = registro?.nombre_grupo;
      if (!id || !nombre) return;

      grupos.set(String(id), {
        id,
        nombre,
        seccion: registro.nombre_seccion ?? '',
        nivel: registro.nivel ?? ''
      });
    };

    gruposAsignados.forEach(registrarGrupo);
    estudiantesMatriculados.forEach(registrarGrupo);
    matriculas.forEach(registrarGrupo);
    asistencias.forEach(registrarGrupo);

    select.innerHTML =
      '<option value="">Todos los grupos</option>';

    Array.from(grupos.values())
      .sort((a, b) =>
        etiquetaGrupo(a).localeCompare(etiquetaGrupo(b), 'es')
      )
      .forEach((grupo) => {
        select.add(
          new Option(etiquetaGrupo(grupo), grupo.id)
        );
      });

    const opcionExiste = Array.from(select.options)
      .some((option) => option.value === valorActual);

    select.value = opcionExiste ? valorActual : '';
  }

  function etiquetaGrupo(registro) {
    const nombre = String(registro?.nombre_grupo || registro?.nombre || 'Grupo').trim();
    const seccion = String(registro?.nombre_seccion || registro?.seccion || '').trim();
    const nivel = String(registro?.nivel || '').trim();
    const idGrupo = registro?.id_grupo ?? registro?.id ?? '';

    const partes = [nombre];
    partes.push(seccion ? `Sección ${seccion}` : 'Sección sin definir');
    if (nivel) partes.push(`Nivel ${nivel}`);
    if (idGrupo !== '') partes.push(`Grupo #${idGrupo}`);

    return partes.join(' · ');
  }

  function actualizarContextoProfesor() {
    const box = document.getElementById('consulta-profesor-contexto');
    const gruposEl = document.getElementById('consulta-profesor-grupos');

    if (!box || !gruposEl) return;

    const esProfesor = rolActual() === 'profesor';
    box.classList.toggle('hidden', !esProfesor);

    if (!esProfesor) {
      gruposEl.textContent = '';
      return;
    }

    if (!gruposAsignados.length) {
      gruposEl.textContent = 'No tienes grupos activos asignados.';
      return;
    }

    gruposEl.innerHTML = '';

    const gruposUnicos = [];
    const idsVistos = new Set();

    gruposAsignados.forEach((grupo) => {
      const clave = String(grupo?.id_grupo ?? etiquetaGrupo(grupo));
      if (idsVistos.has(clave)) return;
      idsVistos.add(clave);
      gruposUnicos.push(grupo);
    });

    gruposUnicos.forEach((grupo) => {
      const chip = document.createElement('span');
      chip.className = 'consulta-profesor-grupo-chip';

      const nombre = document.createElement('strong');
      nombre.textContent = grupo?.nombre_grupo || grupo?.nombre || 'Grupo';
      chip.appendChild(nombre);

      const detalle = document.createElement('span');
      const seccion = String(grupo?.nombre_seccion || grupo?.seccion || '').trim();
      const nivel = String(grupo?.nivel || '').trim();
      detalle.textContent = `Sección: ${seccion || 'Sin definir'}${nivel ? ` · Nivel: ${nivel}` : ''}`;
      chip.appendChild(detalle);

      gruposEl.appendChild(chip);
    });
  }

    function cargarFiltrosMatriculados() {
    const selectSeccion = document.getElementById(
      'consulta-seccion'
    );

    const selectNivel = document.getElementById(
      'consulta-nivel'
    );

    const valorSeccionActual =
      selectSeccion?.value || '';

    const valorNivelActual =
      selectNivel?.value || '';

    const secciones = new Map();
    const niveles = new Set();

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

    if (selectSeccion) {
      selectSeccion.innerHTML =
        '<option value="">Todas las secciones</option>';

      Array.from(secciones.entries())
        .sort((a, b) =>
          a[1].localeCompare(b[1])
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

    if (selectNivel) {
      selectNivel.innerHTML =
        '<option value="">Todos los niveles</option>';

      Array.from(niveles)
        .sort((a, b) =>
          a.localeCompare(
            b,
            'es',
            { numeric: true }
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

    const verAuditoria =
      evento.target.closest('.consulta-ver-auditoria');

    if (verEstudiante) {
      await mostrarDetalleEstudiante(
        verEstudiante.dataset.id
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
    }

   if (verGrupo) {
     mostrarDetalleGrupo(
       verGrupo.dataset.id
      );
     return;
    }

    if (verAuditoria) {
      mostrarDetalleAuditoria(verAuditoria.dataset.id);
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

    if (
      !contenido ||
      !titulo
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

registrarAuditoriaConsulta(
  'estudiante',
  'vista_previa',
  {
    id_registro: estudiante.id_estudiante ?? estudiante.id ?? null
  }
);

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

  if (!contenido || !titulo) {
    return;
  }

  titulo.textContent =
    'Vista previa del estudiante matriculado';

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

  registrarAuditoriaConsulta(
    'matriculado',
    'vista_previa',
    {
      id_registro: registro.id_estudiante ?? null,
      id_matricula: registro.id_matricula ?? null
    }
  );

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

    if (
      !contenido ||
      !titulo
    ) {
      return;
    }

    titulo.textContent =
     'Vista previa del profesor';

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

registrarAuditoriaConsulta(
  'profesor',
  'vista_previa',
  {
    id_registro: profesor.id_profesor ?? profesor.id ?? null
  }
);

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

    if (
      !contenido ||
      !titulo
    ) {
      return;
    }

    titulo.textContent =
      'Vista previa de la matrícula';

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

registrarAuditoriaConsulta(
  'matricula',
  'vista_previa',
  {
    id_registro: registro.id_matricula ?? null
  }
);

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

   if (
  !contenido ||
  !titulo
) {
  return;
}

    titulo.textContent =
     'Vista previa de la asistencia';

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

registrarAuditoriaConsulta(
  'asistencia',
  'vista_previa',
  {
    id_registro: registro.id_asistencia ?? null
  }
);

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

  function mostrarDetalleGrupo(id) {
  const grupo = grupos.find((item) => {
    return String(item.id_grupo ?? item.id) === String(id);
  });

  const contenido = document.getElementById(
    'consulta-detalle-contenido'
  );

  const titulo = document.getElementById(
    'consulta-detalle-titulo'
  );

  if (!contenido || !titulo) return;

  titulo.textContent = 'Vista previa del grupo';

  if (!grupo) {
    contenido.innerHTML = `
      <div class="text-center py-5 text-danger">
        <i class="bi bi-exclamation-circle fs-2 d-block mb-2"></i>
        No se encontró la información del grupo.
      </div>
    `;

    abrirModalDetalle();
    return;
  }

  const estudiantesGrupo = estudiantesMatriculados
    .filter((estudiante) => {
      return String(estudiante.id_grupo) === String(id);
    })
    .sort((a, b) => {
      return formarNombre(a).localeCompare(
        formarNombre(b),
        'es',
        { sensitivity: 'base' }
      );
    });

  documentoActual = {
    ...grupo,
    estudiantes: estudiantesGrupo
  };

  tipoDocumentoActual = 'grupo';

  registrarAuditoriaConsulta(
    'grupo',
    'vista_previa',
    {
      id_registro:
        grupo.id_grupo ??
        grupo.id ??
        null
    }
  );

  prepararEncabezadoDocumento(
    `Grupo ${grupo.nombre_grupo ?? grupo.nombre ?? ''}`
  );

  const filasEstudiantes = estudiantesGrupo.length
    ? estudiantesGrupo
        .map((estudiante, indice) => `
          <tr>
            <td>${indice + 1}</td>
            <td>${formarNombre(estudiante) || '-'}</td>
            <td>${estudiante.nombre_seccion ?? '-'}</td>
            <td>${estudiante.nivel ?? '-'}</td>
          </tr>
        `)
        .join('')
    : `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">
            No hay estudiantes matriculados en este grupo.
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
          grupo.nombre_grupo ??
          grupo.nombre ??
          '-'
        )}

        ${crearCampoDetalleDocumento(
          'Sección',
          grupo.nombre_seccion ??
          grupo.seccion ??
          '-'
        )}

        ${crearCampoDetalleDocumento(
          'Nivel',
          grupo.nivel ??
          '-'
        )}

        ${crearCampoDetalleDocumento(
          'Cantidad de estudiantes',
          estudiantesGrupo.length
        )}

      </div>
    </div>

    <div class="consulta-documento-seccion">

      <h3 class="consulta-documento-seccion-titulo">
        Lista de estudiantes
      </h3>

      <div class="table-responsive">

        <table class="table table-sm consulta-lista-grupo">

          <thead>
            <tr>
              <th>#</th>
              <th>Estudiante</th>
              <th>Sección</th>
              <th>Nivel</th>
            </tr>
          </thead>

          <tbody>
            ${filasEstudiantes}
          </tbody>

        </table>

      </div>
    </div>
  `;

  abrirModalDetalle();
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

registrarAuditoriaConsulta(
  tipoDocumentoActual,
  'descargar_pdf',
  {
    nombre_archivo: nombreArchivo,
    id_registro:
      documentoActual.id_estudiante ??
      documentoActual.id_profesor ??
      documentoActual.id_matricula ??
      documentoActual.id_asistencia ??
      documentoActual.id_grupo ??
      documentoActual.id ??
      null
  }
);
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

    auditoria:
      'Registro de auditoría'
  };

  return (
    titulos[tipoDocumentoActual] ||
    'Documento académico'
  );
}

function obtenerCamposDocumentoPDF() {
  const registro =
    documentoActual || {};

  if (tipoDocumentoActual === 'auditoria') {
    return [
      { etiqueta: 'ID de auditoría', valor: registro.id_auditoria ?? '-' },
      { etiqueta: 'Fecha', valor: formatearFechaHora(registro.fecha_creacion) },
      { etiqueta: 'Módulo / tabla', valor: registro.nombre_tabla ?? '-' },
      { etiqueta: 'Acción', valor: registro.accion_usuario ?? '-' },
      { etiqueta: 'Usuario', valor: registro.id_usuario ? `#${registro.id_usuario}` : 'Sistema' },
      { etiqueta: 'Datos anteriores', valor: formatearJson(parseAuditData(registro.datos_anteriores)) },
      { etiqueta: 'Datos nuevos / detalle', valor: formatearJson(parseAuditData(registro.datos_nuevos)) }
    ];
  }

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
    ];if (tipoDocumentoActual === 'matriculado') {
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
        valor: etiquetaGrupo(registro)
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

  async function registrarAuditoriaConsulta(
  tipo,
  accion,
  detalle = {}
) {
  try {
    await apiFetch('/api/auditorias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nombre_tabla: 'consultas',
        accion_usuario: 'SELECT',
        datos_anteriores: null,
        datos_nuevos: JSON.stringify({
          tipo,
          accion,
          ...detalle
        })
      })
    });
  } catch (error) {
    console.warn(
      'No se pudo registrar la auditoría de consulta:',
      error
    );
  }
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