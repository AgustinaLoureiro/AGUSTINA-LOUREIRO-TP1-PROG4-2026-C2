import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

/** Proveedores mínimos para montar componentes en los tests unitarios. */
export const proveedoresDePrueba = [
  provideRouter([]),
  provideHttpClient(),
  provideServiceWorker('ngsw-worker.js', { enabled: false }),
];
