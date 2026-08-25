import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import * as bootstrap from 'bootstrap';
import { jsPDF } from 'jspdf';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/asistencia.css';
import './styles/consultas.css';
import './styles/matricula.css';
import './styles/perfil.css';
import './styles/pagos.css';
import './styles/profesores.css';
import './styles/reportes.css';
import './styles/theme.css';
import './styles/contrast-fixes.css';
import './styles/final-fixes.css';
import './styles/ui-polish.css';
import './styles/accessibility-theme.css';
import './styles/stability-final.css';
import './styles/requested-fixes.css';
import './styles/release-polish.css';
import './styles/last-mile-fixes.css';
import './styles/dark-mode-final.css';
import './styles/dark-mode-polished.css';
import './styles/dark-mode-master.css';

window.bootstrap = bootstrap;
window.jspdf = { jsPDF };

const ACCESSIBILITY_KEY = 'educontrol_accesibilidad';
try {
  const saved = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}');
  const isDark = Boolean(saved.isDark);
  document.body.classList.toggle('theme-dark', isDark);
  document.documentElement.classList.toggle('theme-dark', isDark);
  document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  document.body.classList.toggle('high-contrast', Boolean(saved.highContrast));
  document.body.classList.toggle('reduced-motion', Boolean(saved.reducedMotion));
  document.documentElement.classList.toggle('reduced-motion', Boolean(saved.reducedMotion));
  const fontSize = Number(saved.fontSize || 100);
  document.body.style.fontSize = `${Number.isFinite(fontSize) ? Math.min(160, Math.max(90, fontSize)) : 100}%`;
} catch {
  // Si el valor guardado está dañado se utilizarán los valores predeterminados.
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento #root.');
}

createRoot(rootElement).render(<App />);
