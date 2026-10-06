import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { Confirmacion } from '../../services/confirmacion';

/**
 * Diálogo de confirmación. Se monta en cada layout para tomar los colores
 * de esa sección (sitio público, panel admin o control de acceso).
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  templateUrl: './dialogo-confirmacion.html',
  styleUrl: './dialogo-confirmacion.css',
  host: { '(document:keydown.escape)': 'cancelar()' },
})
export class DialogoConfirmacion {
  protected confirmacion = inject(Confirmacion);
  private botonAceptar = viewChild<ElementRef<HTMLButtonElement>>('aceptar');

  constructor() {
    // Al abrirse, el foco va al botón principal (Enter confirma, Escape cancela).
    effect(() => {
      if (this.confirmacion.actual()) {
        setTimeout(() => this.botonAceptar()?.nativeElement.focus());
      }
    });
  }

  protected cancelar() {
    if (this.confirmacion.actual()) this.confirmacion.responder(false);
  }
}
