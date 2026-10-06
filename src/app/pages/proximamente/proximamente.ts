import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Catalogo } from '../../services/catalogo';
import { Auth } from '../../services/auth';
import { Notificaciones } from '../../services/notificaciones';
import { Avisos } from '../../services/ui';
import { PeliculaPublica } from '../../interfaces/catalogo';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { DuracionPipe } from '../../pipes/duracion-pipe';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo-pipe';
import { mensajeError } from '../../utils/errores';

@Component({
  selector: 'app-proximamente',
  imports: [DatePipe, RouterLink, ImagenRespaldo, DuracionPipe, TiempoRelativoPipe],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.css',
})
export class Proximamente implements OnInit {
  private catalogo = inject(Catalogo);
  private router = inject(Router);
  private avisos = inject(Avisos);
  protected auth = inject(Auth);
  protected notis = inject(Notificaciones);

  protected cargando = signal(true);
  private peliculas = signal<PeliculaPublica[]>([]);
  protected procesando = signal<number | null>(null);

  protected estrenos = computed(() =>
    this.peliculas()
      .filter((p) => p.proximamente)
      .sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno)),
  );

  async ngOnInit() {
    try {
      this.peliculas.set(await this.catalogo.peliculas());
    } finally {
      this.cargando.set(false);
    }
  }

  protected ventaAbierta(p: PeliculaPublica): boolean {
    return p.tiene_funciones && new Date(p.venta_desde) <= new Date();
  }

  protected async alerta(p: PeliculaPublica) {
    if (!this.auth.logueado()) {
      this.router.navigate(['/ingresar'], { queryParams: { volver: '/proximamente' } });
      return;
    }
    this.procesando.set(p.id);
    try {
      const activa = await this.notis.alternarAlerta(p.id);
      this.avisos.ok(
        activa
          ? `Listo: te avisamos cuando salgan las entradas de ${p.titulo}.`
          : `Desactivaste la alerta de ${p.titulo}.`,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.procesando.set(null);
    }
  }
}
