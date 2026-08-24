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
import { bootLegacyRuntime } from './logic/runtime.js';

window.bootstrap = bootstrap;
window.jspdf = { jsPDF };

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento #root.');
}

createRoot(rootElement).render(<App />);

bootLegacyRuntime();