import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Compras } from '../../services/compras';
import { TicketPdf } from '../../services/ticket-pdf';
import { Auth } from '../../services/auth';
import { Avisos } from '../../services/ui';
import { CompraDetalle } from '../../interfaces/compra';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { CodigoPipe } from '../../pipes/codigo-pipe';
import { PrecioPipe } from '../../pipes/precio-pipe';
import { IdiomaPipe } from '../../pipes/idioma-pipe';
import { DuracionPipe } from '../../pipes/duracion-pipe';

@Component({
  selector: 'app-compra-confirmada',
  imports: [
    DatePipe,
    RouterLink,
    CodigoQr,
    ImagenRespaldo,
    CodigoPipe,
    PrecioPipe,
    IdiomaPipe,
    DuracionPipe,
  ],
  templateUrl: './compra-confirmada.html',
  styleUrl: './compra-confirmada.css',
})
export class CompraConfirmada implements OnInit {
  codigo = input.required<string>();

  private compras = inject(Compras);
  private pdf = inject(TicketPdf);
  private avisos = inject(Avisos);
  protected auth = inject(Auth);

  protected cargando = signal(true);
  protected compra = signal<CompraDetalle | null>(null);
  protected descargando = signal(false);

  async ngOnInit() {
    try {
      this.compra.set(await this.compras.obtener(this.codigo()));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async descargar() {
    const c = this.compra();
    if (!c) return;
    this.descargando.set(true);
    try {
      await this.pdf.descargar(c);
    } catch {
      this.avisos.error('No se pudo generar el PDF. Probá de nuevo.');
    } finally {
      this.descargando.set(false);
    }
  }
}
