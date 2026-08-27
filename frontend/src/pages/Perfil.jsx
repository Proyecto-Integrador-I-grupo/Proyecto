import React from 'react';

export default function Perfil() {
  return (
    <><section id="perfil-view" className="view hidden">
<div className="perfil-hero mb-4">
<div>
<span className="perfil-eyebrow">
        Configuración personal
      </span>
<h2 className="card-title-serif h3 mb-2">
        Mi Perfil
      </h2>
<p className="text-muted mb-0">
        Administra tu información personal y la seguridad de tu cuenta.
      </p>
</div>
<div className="perfil-icono">
<i className="bi bi-person-circle"></i>
</div>
</div>
<div className="row g-4">

<div className="col-12 col-lg-4">
<div className="card border-0 shadow-sm perfil-card">
<div className="card-body text-center p-4">
<div className="perfil-avatar">
<img id="perfil-foto-preview" src="https://via.placeholder.com/150" alt="Perfil" />
</div>
<label htmlFor="perfil-foto-input" className="btn btn-outline-primary perfil-photo-trigger mt-3">
<i className="bi bi-camera"></i>
<span>Cambiar fotografía</span>
          </label>
<input id="perfil-foto-input" type="file" accept="image/*" className="d-none" />
<hr />
<h4 id="perfil-nombre-completo" className="mb-1">

            Usuario

          </h4>
<span id="perfil-rol" className="badge bg-primary">

            Rol

          </span>
<div className="perfil-info mt-4">
<div className="perfil-info-item">
<i className="bi bi-envelope"></i>
<span id="perfil-correo-info">
                -
              </span>
</div>
</div>
</div>
</div>
</div>

<div className="col-12 col-lg-8">
<div className="card border-0 shadow-sm">
<div className="card-body p-4 p-xl-5">
<form id="perfil-form">
<div className="perfil-section-heading"><div><h5 className="mb-1">Información personal</h5><p className="text-muted small mb-0">Mantén actualizados tus datos de contacto.</p></div><i className="bi bi-person-vcard"></i></div>
<div className="row g-3">
<div className="col-md-6">
<label className="form-label">
                  Nombre
                </label>
<input id="perfil-nombre" className="form-control" maxLength="60" required="" />
</div>
<div className="col-md-6">
<label className="form-label">
                  Correo electrónico
                </label>
<input id="perfil-correo" type="email" className="form-control" required="" />
</div>
<div className="col-md-6">
<label className="form-label">
                  Primer apellido
                </label>
<input id="perfil-apellido1" className="form-control" maxLength="60" required="" />
</div>
<div className="col-md-6">
<label className="form-label">
                  Segundo apellido
                </label>
<input id="perfil-apellido2" className="form-control" maxLength="60" />
</div>
</div>
<hr className="my-4" />
<div className="perfil-section-heading"><div><h5 className="mb-1">Seguridad</h5><p className="text-muted small mb-0">Completa los tres campos solo si deseas cambiar tu contraseña.</p></div><i className="bi bi-shield-lock"></i></div>
<div className="row g-3">
<div className="col-md-4">
<label className="form-label">
                  Clave actual
                </label>
<input id="perfil-clave-actual" type="password" className="form-control" />
</div>
<div className="col-md-4">
<label className="form-label">
                  Nueva clave
                </label>
<input id="perfil-clave-nueva" type="password" className="form-control" />
</div>
<div className="col-md-4">
<label className="form-label">
                  Confirmar clave
                </label>
<input id="perfil-clave-confirmar" type="password" className="form-control" />
</div>
</div>
<div className="mt-4">
<button type="submit" className="btn btn-primary">
<i className="bi bi-check2-circle"></i>
                Guardar cambios

              </button>
</div>
</form>
</div>
</div>
</div>
</div>
</section></>
  );
}
