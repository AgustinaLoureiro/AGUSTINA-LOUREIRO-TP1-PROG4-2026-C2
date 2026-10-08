import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Compras } from '../../services/compras';
import { Resenas } from '../../services/resenas';
import { Avisos } from '../../services/ui';
import { CompraResumen } from '../../interfaces/compra';
import { Resena } from '../../interfaces/catalogo';
import { Estrellas } from '../../components/estrellas/estrellas';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { mensajeError } from '../../utils/errores';

interface PeliculaVista {
  peliculaId: number;
  titulo: string;
  poster: string | null;
  /** Si sigue en cartel, el póster lleva al detalle; si no, el detalle ya no existe. */
  enCartel: boolean;
  fecha: string;
  sala: string;
  formato: string;
  veces: number;
  calificacion: number;
}

/**
 * Historial visual de lo que la persona vio: funciones ya terminadas o con
 * ingreso validado, con póster, fecha y su propia calificación (editable).
 */
@Component({
  selector: 'app-mis-peliculas',
  imports: [DatePipe, RouterLink, Estrellas, ImagenRespaldo, NgTemplateOutlet],
  templateUrl: './mis-peliculas.html',
  styleUrl: './mis-peliculas.css',
})
export class MisPeliculas implements OnInit {
  private auth = inject(Auth);
  private compras = inject(Compras);
  private resenas = inject(Resenas);
  private avisos = inject(Avisos);

  protected cargando = signal(true);
  private lista = signal<CompraResumen[]>([]);
  private calificaciones = signal<Map<number, Resena>>(new Map());

  protected vistas = computed<PeliculaVista[]>(() => {
    const porPelicula = new Map<number, PeliculaVista>();
    const vistas = this.lista()
      .filter(
        (c) =>
          c.estado === 'pagada' &&
          (c.entrada_validada_en || new Date(c.funciones.fin) < new Date()),
      )
      .sort((a, b) => b.funciones.inicio.localeCompare(a.funciones.inicio));
    for (const c of vistas) {
      const p = c.funciones.peliculas;
      const existente = porPelicula.get(p.id);
      if (existente) {
        existente.veces++;
        continue;
      }
      porPelicula.set(p.id, {
        peliculaId: p.id,
        titulo: p.titulo,
        poster: p.poster_url,
        enCartel: p.visible,
        fecha: c.funciones.inicio,
        sala: c.funciones.salas.nombre,
        formato: c.funciones.formato,
        veces: 1,
        calificacion: this.calificaciones().get(p.id)?.estrellas ?? 0,
      });
    }
    return [...porPelicula.values()];
  });

  protected calificadas = computed(() => this.vistas().filter((v) => v.calificacion > 0).length);

  async ngOnInit() {
    const id = this.auth.usuario()!.id;
    try {
      const [lista, resenas] = await Promise.all([
        this.compras.misCompras(id),
        this.resenas.misCalificaciones(id),
      ]);
      this.lista.set(lista);
      this.calificaciones.set(new Map(resenas.map((r) => [r.pelicula_id, r])));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async calificar(v: PeliculaVista, estrellas: number) {
    try {
      const previa = this.calificaciones().get(v.peliculaId);
      await this.resenas.guardar(
        v.peliculaId,
        this.auth.usuario()!.id,
        estrellas,
        previa?.comentario ?? '',
      );
      this.calificaciones.update((m) =>
        new Map(m).set(v.peliculaId, {
          ...previa!,
          pelicula_id: v.peliculaId,
          estrellas,
          comentario: previa?.comentario ?? '',
        }),
      );
      this.avisos.ok(
        `Calificaste ${v.titulo} con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}.`,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }
}
