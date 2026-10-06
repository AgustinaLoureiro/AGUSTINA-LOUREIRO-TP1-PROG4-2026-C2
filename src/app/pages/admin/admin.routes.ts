import { Routes } from '@angular/router';
import { Admin } from './admin';

/** Rutas hijas del panel (se cargan todas en forma diferida desde /admin). */
export const adminRoutes: Routes = [
  {
    path: '',
    component: Admin,
    children: [
      { path: '', redirectTo: 'reportes', pathMatch: 'full' },
      {
        path: 'reportes',
        title: 'Admin · Reportes',
        loadComponent: () => import('./reportes/reportes').then((m) => m.Reportes),
      },
      {
        path: 'peliculas',
        title: 'Admin · Películas',
        loadComponent: () => import('./peliculas/peliculas').then((m) => m.AdminPeliculas),
      },
      {
        path: 'peliculas/nueva',
        title: 'Admin · Nueva película',
        loadComponent: () => import('./pelicula-form/pelicula-form').then((m) => m.PeliculaForm),
      },
      {
        path: 'peliculas/:id',
        title: 'Admin · Editar película',
        loadComponent: () => import('./pelicula-form/pelicula-form').then((m) => m.PeliculaForm),
      },
      {
        path: 'funciones',
        title: 'Admin · Funciones',
        loadComponent: () => import('./funciones/funciones').then((m) => m.AdminFunciones),
      },
      {
        path: 'salas',
        title: 'Admin · Salas',
        loadComponent: () => import('./salas/salas').then((m) => m.AdminSalas),
      },
      {
        path: 'candy',
        title: 'Admin · Candy bar',
        loadComponent: () => import('./candy/candy').then((m) => m.AdminCandy),
      },
      {
        path: 'fidelizacion',
        title: 'Admin · Precios y beneficios',
        loadComponent: () => import('./fidelizacion/fidelizacion').then((m) => m.AdminFidelizacion),
      },
      {
        path: 'usuarios',
        title: 'Admin · Usuarios',
        loadComponent: () => import('./usuarios/usuarios').then((m) => m.AdminUsuarios),
      },
      {
        path: 'actividad',
        title: 'Admin · Registro de actividad',
        loadComponent: () => import('./actividad/actividad').then((m) => m.AdminActividad),
      },
    ],
  },
];
