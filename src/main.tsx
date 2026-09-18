import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
<<<<<<< HEAD
import ErrorBoundary from './ErrorBoundary.tsx';
=======
>>>>>>> parent of 72b55d7 (nieuwe update verlof en ui)
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
<<<<<<< HEAD
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
=======
    <App />
>>>>>>> parent of 72b55d7 (nieuwe update verlof en ui)
  </StrictMode>,
);
