import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Rol } from '../interfaces/usuario';

/**
 * Restringe una ruta a ciertos roles. La seguridad real está en la base (RLS y
 * validaciones dentro de las RPC); el guard evita mostrar pantallas sin permiso.
 */
export function roleGuard(rolesPermitidos: Rol[]): CanActivateFn {
  return async (route, state) => {
    const auth = inject(Auth);
    const router = inject(Router);
    await auth.listo();

    if (!auth.logueado()) {
      return router.createUrlTree(['/ingresar'], { queryParams: { volver: state.url } });
    }
    const rol = auth.rol();
    return rol && rolesPermitidos.includes(rol) ? true : router.parseUrl('/');
  };
}
