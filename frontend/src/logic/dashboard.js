(function () {
  const moduleName = 'dashboard';
  window.EduControlModules = window.EduControlModules || {};
  window.EduControlModules[moduleName] = {
    name: moduleName,
    init() {
      const section = document.getElementById(`${moduleName}-view`);
      if (!section) return;
      section.dataset.module = moduleName;
    }
  };

  if (document.readyState !== 'loading') {
    window.dispatchEvent(new CustomEvent('app:module-ready', { detail: { module: moduleName } }));
  }
})();

/* ==========================================
   MÓDULO DE DASHBOARD
   Contadores generales de estudiantes y profesores.
   ========================================== */

export async function refreshDashboardCounts() {
  try {
    const resEst = await apiFetch('/api/estudiantes');
    if (resEst.ok) {
      const estudiantes = await resEst.json();
      const cnt = document.getElementById('cnt-personas');
      if (cnt) cnt.textContent = estudiantes.length;
    }

    const resProf = await apiFetch('/api/profesores');
    if (resProf.ok) {
      const profesores = await resProf.json();
      const cntP = document.getElementById('cnt-profesores');
      if (cntP) cntP.textContent = profesores.length;
    }
  } catch {
    console.error('Error al actualizar contadores');
  }
}