import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Si una imagen (póster, producto) no carga, la reemplaza por una de respaldo
 * en lugar de mostrar el ícono roto del navegador.
 */
@Directive({
  selector: 'img[appImagenRespaldo]',
  host: {
    '(error)': 'alFallar()',
    loading: 'lazy',
    decoding: 'async',
  },
})
export class ImagenRespaldo {
  private el: ElementRef<HTMLImageElement> = inject(ElementRef);
  appImagenRespaldo = input<string>('');

  alFallar() {
    const img = this.el.nativeElement;
    const respaldo = this.appImagenRespaldo() || '/marca/poster-respaldo.svg';
    if (!img.src.endsWith(respaldo)) {
      img.src = respaldo;
    }
  }
}
