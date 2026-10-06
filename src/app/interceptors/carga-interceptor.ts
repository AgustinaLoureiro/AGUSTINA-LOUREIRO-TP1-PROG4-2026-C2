import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { Carga } from '../services/ui';

/** Enciende la barra de carga global mientras haya peticiones HTTP en curso. */
export const cargaInterceptor: HttpInterceptorFn = (req, next) => {
  const carga = inject(Carga);
  carga.iniciar();
  return next(req).pipe(finalize(() => carga.terminar()));
};
