import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../../services/auth';
import { Notificaciones } from '../../services/notificaciones';
import { SiRol } from '../../directives/si-rol';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo-pipe';
import { DialogoConfirmacion } from '../../components/dialogo-confirmacion/dialogo-confirmacion';

@Component({
  selector: 'app-layout-publico',
  imports: [
    DialogoConfirmacion,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SiRol,
    TiempoRelativoPipe,
  ],
  templateUrl: './publico.html',
  styleUrl: './publico.css',
  host: { class: 'tema-publico' },
})
export class LayoutPublico {
  protected auth = inject(Auth);
  protected notis = inject(Notificaciones);
  private router = inject(Router);

  protected menuAbierto = signal(false);
  protected panelNotis = signal(false);
  protected panelUsuario = signal(false);
  protected readonly anio = new Date().getFullYear();

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.cerrarTodo());
  }

  protected alternarNotis() {
    const abrir = !this.panelNotis();
    this.cerrarTodo();
    this.panelNotis.set(abrir);
    if (abrir) this.notis.marcarLeidas();
  }

  protected alternarUsuario() {
    const abrir = !this.panelUsuario();
    this.cerrarTodo();
    this.panelUsuario.set(abrir);
  }

  protected cerrarTodo() {
    this.menuAbierto.set(false);
    this.panelNotis.set(false);
    this.panelUsuario.set(false);
  }

  protected async salir() {
    await this.auth.salir();
    this.router.navigateByUrl('/');
  }
}
