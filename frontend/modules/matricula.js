(function () {
  const moduleName = 'matricula';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
      wireMatriculaEvents();
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE MATRÍCULA
   Matrícula de estudiantes, grupos y secciones académicas.
   ========================================== */

let allGrupos = [];

function wireMatriculaEvents() {
  const matForm = document.getElementById('matricula-form');
  if (matForm && !matForm.dataset.wired) {
    matForm.dataset.wired = '1';
    matForm.addEventListener('submit', handleMatriculaSubmit);
  }

  const grupoForm = document.getElementById('grupo-form');
  if (grupoForm && !grupoForm.dataset.wired) {
    grupoForm.dataset.wired = '1';
    grupoForm.addEventListener('submit', handleGrupoSubmit);
  }

  const gestionGrupoForm = document.getElementById('gestion-grupo-form');
  if (gestionGrupoForm && !gestionGrupoForm.dataset.wired) {
    gestionGrupoForm.dataset.wired = '1';
    gestionGrupoForm.addEventListener('submit', handleGestionGrupoSubmit);
  }

  const btnBorrarGrupo = document.getElementById('btn-borrar-grupo');
  if (btnBorrarGrupo && !btnBorrarGrupo.dataset.wired) {
    btnBorrarGrupo.dataset.wired = '1';
    btnBorrarGrupo.addEventListener('click', async () => {
      const idGrupo = document.getElementById('gestion-grupo-select')?.value;
      if (!idGrupo) {
        showToast('Selecciona un grupo para borrar.', 'error');
        return;
      }
      await borrarGrupo(idGrupo);
    });
  }

  const gestionGrupoBtn = document.querySelector('[data-bs-target="#modalGestionGrupo"]');
  if (gestionGrupoBtn && !gestionGrupoBtn.dataset.wired) {
    gestionGrupoBtn.dataset.wired = '1';
    gestionGrupoBtn.addEventListener('click', async () => {
      await populateGestionGrupoModal();
      await populateProfesoresSelects(true);
    });
  }

  const grupoProfSearch = document.getElementById('grupo-profesor-search');
  if (grupoProfSearch && !grupoProfSearch.dataset.wired) {
    grupoProfSearch.dataset.wired = '1';
    grupoProfSearch.addEventListener('input', () => {
      filtrarProfesoresGrupo(grupoProfSearch.value);
    });
  }

  const gestionProfSearch = document.getElementById('gestion-profesor-search');
  if (gestionProfSearch && !gestionProfSearch.dataset.wired) {
    gestionProfSearch.dataset.wired = '1';
    gestionProfSearch.addEventListener('input', () => {
      filtrarProfesoresGestion(gestionProfSearch.value);
    });
  }

  const gestionGrupoSelect = document.getElementById('gestion-grupo-select');
  if (gestionGrupoSelect && !gestionGrupoSelect.dataset.wired) {
    gestionGrupoSelect.dataset.wired = '1';
    gestionGrupoSelect.addEventListener('change', async () => {
      await cargarDetalleGestionGrupo(Number(gestionGrupoSelect.value));
    });
  }

  const grupoSeccionSearch = document.getElementById('grupo-seccion-search');
  if (grupoSeccionSearch && !grupoSeccionSearch.dataset.wired) {
    grupoSeccionSearch.dataset.wired = '1';
    grupoSeccionSearch.addEventListener('input', () => {
      filtrarSeccionesGrupo(grupoSeccionSearch.value);
    });
  }

  const seccionForm = document.getElementById('seccion-form');
  if (seccionForm && !seccionForm.dataset.wired) {
    seccionForm.dataset.wired = '1';
    seccionForm.addEventListener('submit', handleSeccionSubmit);
  }

  const btnBorrarSeccion = document.getElementById('btn-borrar-seccion');
  if (btnBorrarSeccion && !btnBorrarSeccion.dataset.wired) {
    btnBorrarSeccion.dataset.wired = '1';
    btnBorrarSeccion.addEventListener('click', async () => {
      const idSeccion = document.getElementById('seccion-delete-select')?.value;
      if (!idSeccion) {
        showToast('Selecciona una sección para borrar.', 'error');
        return;
      }
      await borrarSeccion(idSeccion);
    });
  }
  setDefaultSeccionPeriodo();

  const hoyISO = new Date().toISOString().split('T')[0];
  const matFechaInput = document.getElementById('mat-fecha');
  if (matFechaInput) matFechaInput.max = hoyISO;

  const btnAbrirModalGrupo = document.querySelector('[data-bs-target="#modalGrupo"]');
  if (btnAbrirModalGrupo && !btnAbrirModalGrupo.dataset.wired) {
    btnAbrirModalGrupo.dataset.wired = '1';
    btnAbrirModalGrupo.addEventListener('click', () => {
      populateProfesoresSelects();
      populateSeccionesSelect();
    });
  }

  const btnAbrirModalMatricula = document.querySelector('[data-bs-target="#modalMatricula"]');
  if (btnAbrirModalMatricula && !btnAbrirModalMatricula.dataset.wired) {
    btnAbrirModalMatricula.dataset.wired = '1';
    btnAbrirModalMatricula.addEventListener('click', () => {
      populatePersonaSelects();
      populateGruposSelects();
    });
  }

  const modalMatriculaEl = document.getElementById('modalMatricula');
  if (modalMatriculaEl && !modalMatriculaEl.dataset.wired) {
    modalMatriculaEl.dataset.wired = '1';
    modalMatriculaEl.addEventListener('show.bs.modal', () => {
      const fechaInput = document.getElementById('mat-fecha');
      if (fechaInput && !fechaInput.value) {
        fechaInput.value = new Date().toISOString().split('T')[0];
      }
      actualizarInfoCupoGrupo();
    });
  }

  const matGrupoSel = document.getElementById('mat-id-grupo');
  if (matGrupoSel && !matGrupoSel.dataset.wired) {
    matGrupoSel.dataset.wired = '1';
    matGrupoSel.addEventListener('change', actualizarInfoCupoGrupo);
  }

  const matGrupoSearch = document.getElementById('mat-grupo-search');
  if (matGrupoSearch && !matGrupoSearch.dataset.wired) {
    matGrupoSearch.dataset.wired = '1';
    matGrupoSearch.addEventListener('input', () => {
      filtrarGruposMatricula(matGrupoSearch.value);
    });
  }
}

async function loadMatriculaData() {
  await Promise.all([
    populatePersonaSelects(),
    populateGruposSelects(),
    populateProfesoresSelects(),
    populateSeccionesSelect()
  ]);
}

function setDefaultSeccionPeriodo() {
  const input = document.getElementById('seccion-periodo');
  if (input && !input.value) input.value = new Date().getFullYear();
}

async function populatePersonaSelects() {
  try {
    const res = await apiFetch('/api/estudiantes');
    if (!res.ok) return;
    const estudiantes = await res.json();
    const matSel = document.getElementById('mat-persona');

    if (matSel) {
      matSel.innerHTML = '<option value="" disabled selected>Seleccionar estudiante</option>';
      estudiantes.forEach((p) => {
        const id = p.id_estudiante ?? p.id;
        const nombreCompleto = `${p.nombre ?? ''} ${p.apellido1 ?? ''} ${p.apellido2 ?? ''}`.trim();
        matSel.add(new Option(nombreCompleto, id));
      });
    }
  } catch (error) {
    console.error('Error poblando estudiantes', error);
  }
}

async function populateGruposSelects() {
  try {
    const res = await apiFetch('/api/procesos/grupos');
    if (!res.ok) return;
    const grupos = await res.json();
    allGrupos = grupos;
    const matGrupoSel = document.getElementById('mat-id-grupo');
    const asisGrupoSel = document.getElementById('asis-id-grupo');

    [matGrupoSel, asisGrupoSel].forEach((select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccionar grupo destino</option>';
    });

    grupos.forEach((g) => {
      const id = g.id_grupo ?? g.id;
      const ocupados = g.ocupados ?? 0;
      const capacidad = g.capacidad ?? 0;
      const lleno = ocupados >= capacidad;
      const etiqueta = `${g.nombre_grupo ?? 'Grupo'} · ${g.nivel ?? ''} — Ocupados: ${ocupados}/${capacidad}${lleno ? ' (CUPO LLENO)' : ''}`;

      if (matGrupoSel) {
        const optMat = new Option(etiqueta, id);
        optMat.dataset.nombre = (g.nombre_grupo ?? '').toLowerCase();
        optMat.disabled = lleno;
        matGrupoSel.add(optMat);
      }
      if (asisGrupoSel) {
        asisGrupoSel.add(new Option(etiqueta, id));
      }
    });

    actualizarInfoCupoGrupo();
    filtrarGruposMatricula(document.getElementById('mat-grupo-search')?.value || '');
  } catch (error) {
    console.error('Error poblando grupos', error);
  }
}

function filtrarGruposMatricula(termino) {
  const select = document.getElementById('mat-id-grupo');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    if (option.value === '') return;
    const nombre = (option.dataset.nombre || option.textContent || '').toLowerCase();
    const coincide = !busqueda || nombre.includes(busqueda);
    option.hidden = !coincide;
  });

  const primerVisible = Array.from(select.options).find((option) => !option.hidden && option.value !== '');
  if (primerVisible) {
    select.value = primerVisible.value;
    actualizarInfoCupoGrupo();
  }
}

async function borrarGrupo(idGrupo) {
  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo borrar el grupo.', 'error');
      return;
    }

    showToast('Grupo eliminado correctamente.', 'success');
    document.getElementById('gestion-grupo-form')?.reset();
    await populateGruposSelects();
    await populateGestionGrupoModal();
  } catch (error) {
    console.error('Error al borrar grupo', error);
    showToast('Error al borrar el grupo.', 'error');
  }
}

async function actualizarInfoCupoGrupo() {
  const sel = document.getElementById('mat-id-grupo');
  const info = document.getElementById('mat-grupo-info');
  if (!sel || !info) return;

  const idSeleccionado = parseInt(sel.value, 10);
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === idSeleccionado);

  if (!grupo) {
    info.textContent = 'Selecciona un grupo para ver el cupo disponible.';
    info.classList.remove('text-danger');
    return;
  }

  const ocupados = grupo.ocupados ?? 0;
  const capacidad = grupo.capacidad ?? 0;
  const disponibles = capacidad - ocupados;

  if (disponibles <= 0) {
    info.textContent = `Este grupo ya no tiene cupo disponible (${ocupados}/${capacidad}).`;
    info.classList.add('text-danger');
  } else {
    info.textContent = `Cupo disponible: ${disponibles} de ${capacidad} · Año lectivo: ${grupo.periodo_lectivo ?? '—'}.`;
    info.classList.remove('text-danger');
  }
}

async function populateSeccionesSelect() {
  try {
    const res = await apiFetch('/api/procesos/secciones');
    if (!res.ok) return [];
    const secciones = await res.json();
    const sel = document.getElementById('grupo-seccion');
    const deleteSel = document.getElementById('seccion-delete-select');
    const hint = document.getElementById('grupo-seccion-empty-hint');

    if (sel) {
      sel.innerHTML = '<option value="" disabled selected>Seleccionar sección</option>';
      secciones.forEach((s) => {
        const etiqueta = `${s.nombre} — ${s.nivel} (${s.anio_lectivo})`;
        const option = new Option(etiqueta, s.id_seccion);
        option.dataset.busqueda = `${s.nombre ?? ''} ${s.nivel ?? ''} ${s.anio_lectivo ?? ''}`.toLowerCase();
        sel.add(option);
      });
    }
    if (deleteSel) {
      deleteSel.innerHTML = '<option value="" disabled selected>Seleccionar sección</option>';
      secciones.forEach((s) => {
        const etiqueta = `${s.nombre} — ${s.nivel} (${s.anio_lectivo})`;
        deleteSel.add(new Option(etiqueta, s.id_seccion));
      });
    }
    if (hint) hint.classList.toggle('hidden', secciones.length > 0);
    return secciones;
  } catch (error) {
    console.error('Error poblando secciones', error);
    return [];
  }
}

function filtrarSeccionesGrupo(termino) {
  const select = document.getElementById('grupo-seccion');
  const busqueda = (termino || '').trim().toLowerCase();
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    const texto = (option.dataset.busqueda || option.textContent || '').toLowerCase();
    option.hidden = !!busqueda && !texto.includes(busqueda);
  });
}

async function borrarSeccion(idSeccion) {
  try {
    const res = await apiFetch(`/api/procesos/secciones/${idSeccion}`, {
      method: 'DELETE'
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo borrar la sección.', 'error');
      return;
    }

    showToast('Sección eliminada correctamente.', 'success');
    document.getElementById('seccion-form')?.reset();
    setDefaultSeccionPeriodo();
    await populateSeccionesSelect();
  } catch (error) {
    console.error('Error al borrar sección', error);
    showToast('Error al borrar la sección.', 'error');
  }
}

async function populateGestionGrupoModal() {
  const select = document.getElementById('gestion-grupo-select');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Seleccionar grupo</option>';
  allGrupos.forEach((grupo) => {
    const nombre = `${grupo.nombre_grupo} · ${grupo.nombre_seccion || grupo.id_seccion} · Cupo ${grupo.ocupados ?? 0}/${grupo.capacidad ?? 0}`;
    select.add(new Option(nombre, grupo.id_grupo));
  });
}

async function cargarDetalleGestionGrupo(idGrupo) {
  const grupo = allGrupos.find((g) => (g.id_grupo ?? g.id) === Number(idGrupo));
  const capacidadInput = document.getElementById('gestion-grupo-capacidad');
  const aulaSelect = document.getElementById('gestion-grupo-aula');
  const profSelect = document.getElementById('gestion-grupo-profesor');

  if (!grupo || !capacidadInput || !aulaSelect || !profSelect) return;

  capacidadInput.value = grupo.capacidad ?? 30;
  aulaSelect.value = grupo.aula ?? '';

  try {
    const res = await apiFetch(`/api/procesos/grupos/${grupo.id_grupo}/detalle`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    const profesorActivo = (json.profesores || []).find((p) => p?.id_profesor);
    if (profesorActivo) {
      profSelect.value = String(profesorActivo.id_profesor);
    }
  } catch (error) {
    console.error('Error cargando detalle del grupo', error);
  }
}

async function handleGestionGrupoSubmit(e) {
  e.preventDefault();

  const idGrupo = Number(document.getElementById('gestion-grupo-select')?.value || 0);
  const capacidad = Number(document.getElementById('gestion-grupo-capacidad')?.value || 0);
  const aula = document.getElementById('gestion-grupo-aula')?.value.trim() || null;
  const idProfesor = Number(document.getElementById('gestion-grupo-profesor')?.value || 0);

  if (!idGrupo || !capacidad || !idProfesor) {
    showToast('Selecciona un grupo, capacidad y profesor.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/procesos/grupos/${idGrupo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacidad, aula, id_profesor: idProfesor })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(json.error || json.mensaje || 'No se pudo actualizar el grupo.', 'error');
      return;
    }

    showToast('Grupo actualizado correctamente.', 'success');
    document.getElementById('gestion-grupo-form')?.reset();
    await populateGruposSelects();
    await populateGestionGrupoModal();
    await populateProfesoresSelects(true);
  } catch (error) {
    console.error('Error actualizando grupo', error);
    showToast('Error al actualizar el grupo.', 'error');
  }
}

async function handleMatriculaSubmit(e) {
  e.preventDefault();
  const personaSelect = document.getElementById('mat-persona');
  const grupoSelect = document.getElementById('mat-id-grupo');

  if (!personaSelect.value || !grupoSelect.value) {
    showToast('Selecciona un estudiante y un grupo destino.', 'error');
    return;
  }

  const personaId = parseInt(personaSelect.value, 10);
  const id_grupo = parseInt(grupoSelect.value, 10);
  const grupoSeleccionado = allGrupos.find((g) => (g.id_grupo ?? g.id) === id_grupo);

  const fechaInput = document.getElementById('mat-fecha').value;
  const fecha = fechaInput || new Date().toISOString().split('T')[0];

  const anio = grupoSeleccionado?.periodo_lectivo ?? new Date(`${fecha}T00:00:00`).getFullYear();

  const payload = {
    fecha,
    periodo: parseInt(document.getElementById('mat-periodo').value, 10),
    anio,
    tipo: document.getElementById('mat-tipo').value,
    estado: 'activa',
    observaciones: document.getElementById('mat-observaciones').value.trim().slice(0, 20) || null,
    id_estudiante: personaId,
    id_usuario: currentUser?.id_usuario ?? 1,
    id_grupo: id_grupo
  };

  const submitBtn = document.getElementById('mat-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...'; }

  try {
    const res = await apiFetch('/api/procesos/matricula', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('¡Matrícula definitiva completada y cupo actualizado correctamente!', 'success');
      const modalEl = document.getElementById('modalMatricula');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('matricula-form').reset();
      
      await populateGruposSelects();
      await populatePersonaSelects();
      await refreshDashboardCounts();
    } else {
      showToast(json.error || json.mensaje || 'Error al procesar la matrícula', 'error');
    }
  } catch {
    showToast('Error de conexión al matricular', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Completar Matrícula'; }
  }
}

async function handleGrupoSubmit(e) {
  e.preventDefault();
  const payload = {
    nombre_grupo: document.getElementById('grupo-nombre').value.trim(),
    capacidad: parseInt(document.getElementById('grupo-capacidad').value, 10),
    aula: document.getElementById('grupo-aula').value.trim() || null,
    id_profesor: parseInt(document.getElementById('grupo-profesor').value, 10),
    id_seccion: parseInt(document.getElementById('grupo-seccion').value, 10)
  };

  try {
    const res = await apiFetch('/api/procesos/grupos', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      showToast('Grupo creado correctamente');
      const modalEl = document.getElementById('modalGrupo');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('grupo-form').reset();
      await populateGruposSelects();
    } else {
      const json = await res.json().catch(() => ({}));
      showToast(json.error || json.mensaje || 'Error creando grupo', 'error');
    }
  } catch {
    showToast('Error creando grupo', 'error');
  }
}

async function handleSeccionSubmit(e) {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('seccion-nombre').value.trim(),
    nivel: document.getElementById('seccion-nivel').value.trim(),
    anio_lectivo: parseInt(document.getElementById('seccion-periodo').value, 10),
    descripcion: document.getElementById('seccion-descripcion').value.trim()
  };

  try {
    const res = await apiFetch('/api/procesos/secciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      showToast('Sección creada correctamente');
      const modalEl = document.getElementById('modalSeccion');
      if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
      document.getElementById('seccion-form').reset();
      setDefaultSeccionPeriodo();

      await populateSeccionesSelect();
      if (json.id_seccion) {
        const sel = document.getElementById('grupo-seccion');
        if (sel) sel.value = json.id_seccion;
      }
    } else {
      showToast(json.error || json.mensaje || 'Error creando sección', 'error');
    }
  } catch {
    showToast('Error creando sección', 'error');
  }
}