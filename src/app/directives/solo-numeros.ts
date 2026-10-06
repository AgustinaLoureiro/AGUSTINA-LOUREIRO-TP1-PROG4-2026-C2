import { Directive, ElementRef, inject, input } from '@angular/core';

const TECLAS_PERMITIDAS = [
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

/**
 * Campos numéricos: no deja escribir signo menos, "e", letras ni (salvo que se
 * indique) decimales. Así una duración o un precio nunca pueden ser negativos.
 * Uso: <input type="number" appSoloNumeros /> · <input appSoloNumeros [decimales]="true" />
 */
@Directive({
  selector: 'input[appSoloNumeros]',
  host: {
    inputmode: 'numeric',
    '(keydown)': 'alPresionar($event)',
    '(paste)': 'alPegar($event)',
  },
})
export class SoloNumeros {
  private el: ElementRef<HTMLInputElement> = inject(ElementRef);
  decimales = input(false);

  protected alPresionar(evento: KeyboardEvent) {
    if (evento.ctrlKey || evento.metaKey || TECLAS_PERMITIDAS.includes(evento.key)) return;
    if (/^\d$/.test(evento.key)) return;
    if (
      this.decimales() &&
      (evento.key === '.' || evento.key === ',') &&
      !this.el.nativeElement.value.includes('.')
    ) {
      return;
    }
    evento.preventDefault();
  }

  protected alPegar(evento: ClipboardEvent) {
    const texto = evento.clipboardData?.getData('text') ?? '';
    const valido = this.decimales() ? /^\d+([.,]\d+)?$/ : /^\d+$/;
    if (!valido.test(texto.trim())) evento.preventDefault();
  }
}
