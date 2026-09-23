import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Register } from './pages/register/register';
import { roleGuard } from './guards/role-guard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'register', component: Register },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then(m => m.Admin),
    canActivate: [roleGuard(['administrador'])],
  },
  {
    path: 'empleado',
    loadComponent: () => import('./pages/empleado/empleado').then(m => m.Empleado),
    canActivate: [roleGuard(['empleado', 'administrador'])],
  },
];