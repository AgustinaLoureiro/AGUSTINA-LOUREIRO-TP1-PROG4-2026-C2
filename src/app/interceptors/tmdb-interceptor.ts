import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const TMDB_URL = 'https://api.themoviedb.org/3';

/**
 * Agrega la API key y el idioma a todas las peticiones a TMDB.
 * Así ningún servicio necesita conocer la clave, que viene del environment
 * (generado en el build y fuera del repositorio).
 */
export const tmdbInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(TMDB_URL)) {
    return next(req);
  }
  const reqModificada = req.clone({
    params: req.params.set('api_key', environment.TMDB_API_KEY).set('language', 'es-AR'),
  });
  return next(reqModificada);
};
