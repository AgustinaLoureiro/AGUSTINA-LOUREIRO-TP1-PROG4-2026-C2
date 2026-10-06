import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../services/auth';
import { DialogoConfirmacion } from '../../components/dialogo-confirmacion/dialogo-confirmacion';

interface Seccion {
  ruta: string;
  texto: string;
  icono: string;
}

/**
 * Layout del panel de administración ("Cabina de proyección").
 * Tiene su propia estética (tema-admin) para que se note que es otra parte del sistema.
 */
@Component({
  imports: [DialogoConfirmacion, RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-admin',
  styleUrl: './admin.css',
  templateUrl: './admin.html',
  host: { class: 'tema-admin' },
})
export class Admin {
  protected auth = inject(Auth);
  private router = inject(Router);
  protected menuAbierto = signal(false);
  protected menuPerfil = signal(false);

  protected nombreCompleto = computed(() => {
    const p = this.auth.perfil();
    const nombre = [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim();
    return nombre || 'Administración';
  });

  protected iniciales = computed(() => {
    const p = this.auth.perfil();
    const ini = (p?.nombre?.[0] ?? '') + (p?.apellido?.[0] ?? '');
    return (ini || p?.email?.[0] || 'A').toUpperCase();
  });

  protected readonly secciones: Seccion[] = [
    { ruta: 'reportes', texto: 'Reportes', icono: 'M4 19h16M7 16V9m5 7V5m5 11v-4' },
    {
      ruta: 'peliculas',
      texto: 'Películas',
      icono: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
    },
    {
      ruta: 'funciones',
      texto: 'Funciones',
      icono: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    },
    {
      ruta: 'salas',
      texto: 'Salas y butacas',
      icono: 'M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 10h18v6H3zM6 16v3M18 16v3',
    },
    { ruta: 'candy', texto: 'Candy bar', icono: 'M6 8h12l-1.5 12h-9zM8 8a4 4 0 0 1 8 0' },
    {
      ruta: 'fidelizacion',
      texto: 'Precios y beneficios',
      icono: 'M20 12l-8 8-8-8 8-8h8zM15 8h.01',
    },
    {
      ruta: 'usuarios',
      texto: 'Usuarios',
      icono: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    },
    { ruta: 'actividad', texto: 'Registro de actividad', icono: 'M5 6h14M5 12h14M5 18h9' },
  ];

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuAbierto.set(false);
      this.menuPerfil.set(false);
    });
  }

  protected async salir() {
    await this.auth.salir();
    this.router.navigateByUrl('/');
  }
}
