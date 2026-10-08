import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { offlineQueue } from './services/offlineQueue';

// Initialisation du service hors-ligne (automatiquement géré par le singleton)
console.log("Service hors-ligne initialisé");

createRoot(document.getElementById('root')!).render(<App />);