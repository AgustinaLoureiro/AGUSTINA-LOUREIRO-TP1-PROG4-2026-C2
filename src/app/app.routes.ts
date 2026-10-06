import { Routes } from '@angular/router';
import { LayoutPublico } from './layouts/publico/publico';
import { Home } from './pages/home/home';
import { authGuard, invitadoGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';

export const routes: Routes = [
  // Panel de administración: módulo aparte, con su propio layout y estética.
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.adminRoutes),
  },
  // Validación de QR para empleados (cine y candy bar).
  {
    path: 'staff',
    title: 'Validación de entradas',
    canActivate: [roleGuard(['empleado', 'admin'])],
    loadComponent: () => import('./pages/empleado/empleado').then((m) => m.Empleado),
  },
  { path: 'empleado', redirectTo: 'staff' },

  // Sitio público
  {
    path: '',
    component: LayoutPublico,
    children: [
      { path: '', component: Home },
      {
        path: 'cartelera',
        title: 'Cartelera',
        loadComponent: () => import('./pages/cartelera/cartelera').then((m) => m.Cartelera),
      },
      {
        path: 'proximamente',
        title: 'Próximamente',
        loadComponent: () =>
          import('./pages/proximamente/proximamente').then((m) => m.Proximamente),
      },
      {
        path: 'pelicula/:id',
        loadComponent: () => import('./pages/pelicula/pelicula').then((m) => m.PeliculaDetalle),
      },
      {
        path: 'comprar/:funcionId',
        title: 'Comprar entradas',
        loadComponent: () => import('./pages/comprar/comprar').then((m) => m.Comprar),
      },
      {
        path: 'compra/:codigo',
        title: 'Tu entrada',
        loadComponent: () =>
          import('./pages/compra-confirmada/compra-confirmada').then((m) => m.CompraConfirmada),
      },
      {
        path: 'ingresar',
        title: 'Ingresar',
        canActivate: [invitadoGuard],
        loadComponent: () => import('./pages/login/login').then((m) => m.Login),
      },
      {
        path: 'registro',
        title: 'Crear cuenta',
        canActivate: [invitadoGuard],
        loadComponent: () => import('./pages/register/register').then((m) => m.Register),
      },
      { path: 'register', redirectTo: 'registro' },
      {
        path: 'perfil',
        title: 'Mi cuenta',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/perfil/perfil').then((m) => m.Perfil),
      },
      {
        path: 'mis-peliculas',
        title: 'Mis películas',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/mis-peliculas/mis-peliculas').then((m) => m.MisPeliculas),
      },
      {
        path: '**',
        title: 'Página no encontrada',
        loadComponent: () =>
          import('./pages/no-encontrada/no-encontrada').then((m) => m.NoEncontrada),
      },
    ],
  },
];
