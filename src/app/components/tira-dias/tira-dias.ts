import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DiaTira } from '../../utils/fechas';

/**
 * Selector de día en una tira horizontal (Hoy, Mañana, Sáb 5…).
 * Reemplaza al calendario desplegable: un toque y listo. Si los días no
 * entran, se navega con flechas en lugar de una barra de desplazamiento.
 */
@Component({
  selector: 'app-tira-dias',
  templateUrl: './tira-dias.html',
  styleUrl: './tira-dias.css',
})
export class TiraDias implements AfterViewInit, OnDestroy {
  dias = input.required<DiaTira[]>();
  seleccionado = input<string | null>(null);
  /** Días que tienen algo (funciones). Los demás se muestran apagados. */
  conContenido = input<ReadonlySet<string> | null>(null);
  elegir = output<string>();

  protected puedeIzquierda = signal(false);
  protected puedeDerecha = signal(false);
  private tira = viewChild.required<ElementRef<HTMLElement>>('tira');
  private observador?: ResizeObserver;

  ngAfterViewInit() {
    this.actualizarFlechas();
    this.observador = new ResizeObserver(() => this.actualizarFlechas());
    this.observador.observe(this.tira().nativeElement);
  }

  ngOnDestroy() {
    this.observador?.disconnect();
  }

  protected desplazar(sentido: 1 | -1) {
    const el = this.tira().nativeElement;
    el.scrollBy({ left: sentido * el.clientWidth * 0.8 });
  }

  protected actualizarFlechas() {
    const el = this.tira().nativeElement;
    this.puedeIzquierda.set(el.scrollLeft > 4);
    this.puedeDerecha.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
}
