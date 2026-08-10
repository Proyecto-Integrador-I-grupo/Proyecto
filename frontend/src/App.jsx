import React from 'react';
import Dashboard from './pages/Dashboard';
import Estudiantes from './pages/Estudiantes';
import Matricula from './pages/Matricula';
import Profesores from './pages/Profesores';
import Asistencia from './pages/Asistencia';
import Reportes from './pages/Reportes';
import Consultas from './pages/Consultas';
import Usuarios from './pages/Usuarios';
import Perfil from './pages/Perfil';

export default function App() {
  return (
    <div>
      <div id="login-screen" className="login-screen d-flex align-items-center justify-content-center">
<div className="login-card">
<div className="text-center mb-4">
<span className="brand-mark brand-mark-lg mx-auto mb-3">EC</span>
<h1 className="h3 mb-1">EduControl</h1>
<p className="text-muted small mb-0">Ingresa con tus credenciales asignadas</p>
</div>
<form id="login-form" novalidate="">
<div className="mb-3">
<label className="form-label" htmlFor="login-correo">Correo electrónico</label>
<div className="input-group">
<span className="input-group-text"><i className="bi bi-envelope"></i></span>
<input id="login-correo" type="email" className="form-control" placeholder="usuario@educontrol.com" required="" autoComplete="username" />
</div>
</div>
<div className="mb-3">
<label className="form-label" htmlFor="login-contrasena">Contraseña</label>
<div className="input-group">
<span className="input-group-text"><i className="bi bi-lock"></i></span>
<input id="login-contrasena" type="password" className="form-control" placeholder="••••••••" required="" autoComplete="current-password" />
<button type="button" id="toggle-password" className="btn btn-outline-secondary" aria-label="Mostrar contraseña" aria-controls="login-contrasena" aria-pressed="false">
<i className="bi bi-eye"></i>
</button>
</div>
</div>
<div id="login-error" className="login-error hidden"></div>
<button type="submit" id="login-submit" className="btn btn-primary w-100 mt-2 py-2">
<i className="bi bi-box-arrow-in-right"></i> Iniciar sesión
        </button>
</form>
</div>
</div>
      <div id="app-shell" className="d-flex min-vh-100 hidden">
        <aside className="sidebar d-flex flex-column flex-shrink-0 p-3">
<div className="d-flex align-items-center gap-2 px-1 mb-4">
<span className="brand-mark">EC</span>
<span className="brand-name">EduControl</span>
</div>
<ul className="nav nav-pills flex-column gap-1 mb-auto">
<li className="nav-item">
<button type="button" data-view="dashboard" className="nav-link active w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-grid-1x2-fill"></i> Dashboard
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="estudiantes" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-people-fill"></i> Estudiantes
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="matricula" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-journal-plus"></i> Matrícula
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="profesores" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-person-badge"></i> Profesores
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="asistencia" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-calendar2-check"></i> Asistencia
          </button>
</li>
<li className="nav-item admin-only">
<button type="button" data-view="reportes" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-bar-chart-line"></i> Reportes
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="consultas" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-search"></i> Consultas
          </button>
</li>

<li className="nav-item admin-only">
<button type="button" data-view="usuarios" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-shield-lock-fill"></i> Permisos y Usuarios
          </button>
</li>
<li className="nav-item">
<button type="button" data-view="perfil" className="nav-link w-100 text-start d-flex align-items-center gap-2">
<i className="bi bi-person-gear"></i> Mi Perfil
          </button>
</li>
</ul>
<div className="sidebar-user pt-3 mt-3 border-top border-secondary">
<div className="d-flex align-items-center gap-2 mb-2">
<span id="sidebar-avatar" className="avatar avatar-sm">--</span>
<div className="lh-sm flex-grow-1 min-w-0">
<div id="sidebar-user-name" className="fw-semibold small text-truncate">—</div>
<span id="sidebar-role-badge" className="role-badge">—</span>
</div>
</div>
<button type="button" id="logout-btn" className="btn btn-sm btn-outline-light w-100 d-flex align-items-center justify-content-center gap-2">
<i className="bi bi-box-arrow-left"></i> Cerrar sesión
        </button>
</div>
</aside>
        <div className="flex-grow-1 d-flex flex-column">
          <header className="topbar d-flex justify-content-between align-items-center px-4 py-3 border-bottom bg-white">
<div className="d-flex align-items-center gap-2">
<button id="sidebar-toggle" className="btn btn-sm btn-outline-secondary d-lg-none" type="button" aria-label="Abrir menú">
<i className="bi bi-list"></i>
</button>
<div>
<p className="eyebrow mb-0">Gestión Académica</p>
<h1 id="view-title" className="h4 mb-0">Dashboard</h1>
</div>
</div>
<div className="d-flex align-items-center gap-3">
<div id="assistant-permission-notice" className="asistente-notice hidden">
<i className="bi bi-shield-lock"></i> Módulo de Asistente
          </div>
</div>
</header>
          <main id="content" className="flex-grow-1 overflow-auto p-4">
            <div id="toast" className="toast hidden"></div>
            <section id="dashboard-hero" className="hero-card p-4 mb-4">
              <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                <div>
                  <p className="eyebrow mb-1">Panel de Control</p>
                  <h2 className="h4 mb-1">Bienvenido a EduControl</h2>
                  <p className="mb-0 text-white-50 small">Administración integral de matrículas, profesores, asistencia y expedientes.</p>
                </div>
                <div className="hero-pill"><i className="bi bi-check-circle-fill"></i><span>Sistema Operativo</span></div>
              </div>
            </section>
            <Dashboard />
            <Estudiantes />
            <Matricula />
            <Profesores />
            <Asistencia />
            <Reportes />
            <Consultas />
            <Usuarios />
            <Perfil />
          </main>
        </div>
      </div>
      <div className="modal fade" id="modalResultado" tabIndex="-1" aria-hidden="true">
<div className="modal-dialog modal-dialog-centered modal-sm">
<div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
<div className="modal-body p-4 text-center">
<i id="resultado-icono" className="bi bi-check-circle-fill text-success" style={{font_size: "42px"}}></i>
<h5 id="resultado-titulo" className="mt-3 mb-2">Éxito</h5>
<p id="resultado-mensaje" className="text-muted mb-4">Operación realizada correctamente.</p>
<button type="button" className="btn btn-primary w-100" data-bs-dismiss="modal">Aceptar</button>
</div>
</div>
</div>
</div>
      <div id="accessibility-widget" className="accessibility-widget">
<button id="accessibility-toggle" className="accessibility-toggle" aria-expanded="false" aria-controls="accessibility-menu" aria-label="Abrir opciones de accesibilidad">
<i className="bi bi-universal-access"></i>
</button>
<div id="accessibility-menu" className="accessibility-menu hidden" role="menu" aria-label="Controles de accesibilidad">
<button type="button" id="btn-toggle-theme" className="accessibility-action" role="menuitem">Modo oscuro</button>
<button type="button" id="btn-toggle-contrast" className="accessibility-action" role="menuitem">Alto contraste</button>
<button type="button" id="btn-reset-accessibility" className="accessibility-action" role="menuitem">Restablecer</button>
<div className="accessibility-control" role="group" aria-label="Ajustar tamaño de letra">
<label htmlFor="font-size-range" className="accessibility-control-label">Tamaño: <span id="font-size-value">100%</span></label>
<input type="range" id="font-size-range" className="accessibility-range" min="90" max="160" step="5" value="100" aria-valuemin="90" aria-valuemax="160" aria-valuenow="100" /></div>
</div>
</div>
    </div>
  );
}
