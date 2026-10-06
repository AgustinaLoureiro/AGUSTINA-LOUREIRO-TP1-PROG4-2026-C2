import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminDatos } from '../../services/admin';
import { Avisos } from '../../services/ui';
import { Confirmacion } from '../../services/confirmacion';
import { IdiomaPipe } from '../../pipes/idioma-pipe';
import { PrecioPipe } from '../../pipes/precio-pipe';
import { mensajeError } from '../../utils/errores';

/** Una programación: las funciones que se crearon juntas al tocar "Programar funciones". */
interface Tanda {
  id: string;
  formato: string;
  idioma: string;
  precio: number;
  desde: string;
  hasta: string;
  funciones: number;
  vendidas: number;
  salas: string[];
  creadaEn: string;
}

/**
 * Funciones próximas de una película agrupadas por programación (tanda), con
 * acciones para quitar una tanda, quitar todas o agregar más.
 * Uso: <app-programaciones-pelicula [peliculaId]="p.id" [titulo]="p.titulo" (cambio)="recargar()" />
 */
@Component({
  selector: 'app-programaciones-pelicula',
  imports: [DatePipe, RouterLink, IdiomaPipe, PrecioPipe],
  templateUrl: './programaciones-pelicula.html',
  styleUrl: './programaciones-pelicula.css',
})
export class ProgramacionesPelicula {
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  peliculaId = input.required<number>();
  titulo = input.required<string>();
  /** false cuando la pantalla que lo usa ya tiene sus propios botones de agregar/quitar todas. */
  acciones = input(true);
  /** Avisa que se quitaron funciones, para que la pantalla actualice sus datos. */
  cambio = output<void>();

  protected cargando = signal(true);
  protected tandas = signal<Tanda[]>([]);
  protected quitando = signal<string | null>(null);

  constructor() {
    effect(() => this.cargar(this.peliculaId()));
  }

  private async cargar(id: number) {
    this.cargando.set(true);
    try {
      const funciones = await this.admin.funcionesDePelicula(id);
      const tandas: Tanda[] = [];
      for (const fn of funciones) {
        const idTanda = fn.tanda ?? 'sin-tanda';
        let t = tandas.find((x) => x.id === idTanda);
        if (!t) {
          t = {
            id: idTanda,
            formato: fn.formato,
            idioma: fn.idioma,
            precio: fn.precio,
            desde: fn.inicio,
            hasta: fn.inicio,
            funciones: 0,
            vendidas: 0,
            salas: [],
            creadaEn: fn.creado_en,
          };
          tandas.push(t);
        }
        t.funciones++;
        t.hasta = fn.inicio;
        t.vendidas += fn.vendidas;
        const sala = fn.salas?.nombre ?? '';
        if (!t.salas.includes(sala)) t.salas.push(sala);
      }
      this.tandas.set(tandas);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected total(): number {
    return this.tandas().reduce((n, t) => n + t.funciones, 0);
  }

  protected async quitarTanda(t: Tanda) {
    const ok = await this.confirmacion.pedir({
      titulo: `¿Quitar esta programación de "${this.titulo()}"?`,
      mensaje: `${t.formato} · ${t.idioma === 'CAST' ? 'Castellano' : 'Subtitulada'} · ${t.funciones} funciones. Las que ya tienen entradas vendidas se conservan.`,
      aceptar: 'Quitar programación',
      peligro: true,
    });
    if (!ok) return;
    this.quitando.set(t.id);
    try {
      this.informar(await this.admin.quitarTanda(t.id));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.quitando.set(null);
    }
  }

  protected async quitarTodas() {
    const ok = await this.confirmacion.pedir({
      titulo: `¿Quitar todas las funciones de "${this.titulo()}"?`,
      mensaje: 'Las que ya tienen entradas vendidas se conservan.',
      aceptar: 'Quitar todas',
      peligro: true,
    });
    if (!ok) return;
    this.quitando.set('todas');
    try {
      this.informar(await this.admin.quitarFunciones(this.peliculaId(), new Date().toISOString()));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.quitando.set(null);
    }
  }

  private async informar(r: { eliminadas: number; con_ventas: number }) {
    this.avisos.ok(
      `Se quitaron ${r.eliminadas} funciones.` +
        (r.con_ventas ? ` Se conservaron ${r.con_ventas} con entradas vendidas.` : ''),
    );
    await this.cargar(this.peliculaId());
    this.cambio.emit();
  }
}
