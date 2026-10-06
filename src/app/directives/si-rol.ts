import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { Auth } from '../services/auth';
import { Rol } from '../interfaces/usuario';

/**
 * Directiva estructural: muestra el contenido solo si el usuario tiene alguno de los roles.
 * Uso: <a *appSiRol="['admin']" routerLink="/admin">Panel</a>
 * Reacciona sola a los cambios de sesión porque lee un signal dentro de un effect.
 */
@Directive({ selector: '[appSiRol]' })
export class SiRol {
  private template = inject(TemplateRef<unknown>);
  private contenedor = inject(ViewContainerRef);
  private auth = inject(Auth);

  appSiRol = input.required<Rol[]>();
  private visible = false;

  constructor() {
    effect(() => {
      const rol = this.auth.rol();
      const mostrar = !!rol && this.appSiRol().includes(rol);
      if (mostrar && !this.visible) {
        this.contenedor.createEmbeddedView(this.template);
      } else if (!mostrar && this.visible) {
        this.contenedor.clear();
      }
      this.visible = mostrar;
    });
  }
}
