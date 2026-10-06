import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

/** Solo usuarios logueados. Si no hay sesión, manda a ingresar y luego vuelve. */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.listo();

  if (auth.logueado()) {
    return true;
  }
  return router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
};

/** Solo visitantes sin sesión (login y registro). */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.listo();

  return auth.logueado() ? router.parseUrl(auth.rutaInicio()) : true;
};
