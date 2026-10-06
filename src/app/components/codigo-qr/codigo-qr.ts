import { Component, effect, ElementRef, input, viewChild } from '@angular/core';

/** Dibuja un QR en un canvas. La librería se carga recién cuando se necesita. */
@Component({
  selector: 'app-codigo-qr',
  template: `<canvas
    #lienzo
    class="qr"
    [attr.aria-label]="'Código QR ' + texto()"
    role="img"
  ></canvas>`,
  styles: `
    .qr {
      display: block;
      width: 100%;
      max-width: 260px;
      height: auto;
      aspect-ratio: 1;
      margin-inline: auto;
      border-radius: 8px;
      background: #fff;
    }
  `,
})
export class CodigoQr {
  texto = input.required<string>();
  private lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  constructor() {
    effect(async () => {
      const texto = this.texto();
      const canvas = this.lienzo().nativeElement;
      const QRCode = await import('qrcode');
      await QRCode.toCanvas(canvas, texto, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#120C08', light: '#FFFFFF' },
      });
      canvas.style.width = '';
      canvas.style.height = '';
    });
  }
}
