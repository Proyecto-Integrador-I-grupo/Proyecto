import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/variables.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/matricula.css';
import './styles/asistencia.css';
import './styles/consultas.css';
import './styles/perfil.css';
import './styles/profesores.css';
import './styles/reportes.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { jsPDF } from 'jspdf';
import Chart from 'chart.js/auto';
window.jspdf = { jsPDF };
window.Chart = Chart;

createRoot(document.getElementById('root')).render(<App />);

// La lógica original queda en JS, pero ahora trabaja sobre el DOM generado por React.
// Esto permite conservar endpoints, validaciones, permisos y flujos mientras cada módulo
// puede convertirse posteriormente a hooks/componentes sin perder comportamiento.
import('./logic/runtime.js').then(({ bootLegacyRuntime }) => bootLegacyRuntime());
