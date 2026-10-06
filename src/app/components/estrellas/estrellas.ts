import { Component, computed, input, output, signal } from '@angular/core';

/**
 * Calificación con estrellas. En modo lectura muestra el promedio (admite medias
 * estrellas); en modo editable emite la calificación elegida.
 */
@Component({
  selector: 'app-estrellas',
  templateUrl: './estrellas.html',
  styleUrl: './estrellas.css',
})
export class Estrellas {
  valor = input<number>(0);
  editable = input(false);
  tamanio = input<'chico' | 'grande'>('chico');
  cambio = output<number>();

  protected hover = signal(0);
  protected readonly posiciones = [1, 2, 3, 4, 5];
  protected mostrado = computed(() => this.hover() || this.valor());

  protected relleno(posicion: number): number {
    const v = this.mostrado();
    return Math.max(0, Math.min(1, v - posicion + 1)) * 100;
  }

  protected elegir(posicion: number) {
    if (this.editable()) this.cambio.emit(posicion);
  }
}
