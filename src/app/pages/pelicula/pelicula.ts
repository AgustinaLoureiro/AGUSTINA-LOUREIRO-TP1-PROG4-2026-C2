import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Catalogo } from '../../services/catalogo';
import { Resenas } from '../../services/resenas';
import { Auth } from '../../services/auth';
import { Notificaciones } from '../../services/notificaciones';
import { Avisos } from '../../services/ui';
import { Funcion, PeliculaPublica, Resena } from '../../interfaces/catalogo';
import { Estrellas } from '../../components/estrellas/estrellas';
import { TiraDias } from '../../components/tira-dias/tira-dias';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { DuracionPipe } from '../../pipes/duracion-pipe';
import { IdiomaPipe } from '../../pipes/idioma-pipe';
import { PrecioPipe } from '../../pipes/precio-pipe';
import { TiempoRelativoPipe } from '../../pipes/tiempo-relativo-pipe';
import { YoutubePipe } from '../../pipes/youtube-pipe';
import { diaDe, diferenciaDias, hoyISO, tiraDeDias } from '../../utils/fechas';
import { mensajeError } from '../../utils/errores';

interface GrupoFunciones {
  clave: string;
  formato: string;
  idioma: Funcion['idioma'];
  funciones: Funcion[];
}

@Component({
  selector: 'app-pelicula',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    Estrellas,
    TiraDias,
    ImagenRespaldo,
    DuracionPipe,
    IdiomaPipe,
    PrecioPipe,
    TiempoRelativoPipe,
    YoutubePipe,
  ],
  templateUrl: './pelicula.html',
  styleUrl: './pelicula.css',
})
export class PeliculaDetalle implements OnInit {
  /** Parámetro :id de la ruta (withComponentInputBinding). */
  id = input.required<string>();

  private catalogo = inject(Catalogo);
  private resenasS = inject(Resenas);
  private router = inject(Router);
  private title = inject(Title);
  private avisos = inject(Avisos);
  protected auth = inject(Auth);
  protected notis = inject(Notificaciones);

  protected cargando = signal(true);
  protected pelicula = signal<PeliculaPublica | null>(null);
  protected funciones = signal<Funcion[]>([]);
  protected resenas = signal<Resena[]>([]);
  protected dia = signal<string | null>(null);
  protected verTrailer = signal(false);

  // Formulario de reseña
  protected estrellas = signal(0);
  protected comentario = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(280)],
  });
  protected guardando = signal(false);

  protected ventaAbierta = computed(() => {
    const p = this.pelicula();
    return !!p && p.tiene_funciones && new Date(p.venta_desde) <= new Date();
  });

  protected diasConFunciones = computed(
    () => new Set(this.funciones().map((f) => diaDe(f.inicio))),
  );

  protected tira = computed(() => {
    const dias = [...this.diasConFunciones()].sort();
    if (!dias.length) return [];
    const desde = dias[0] < hoyISO() ? hoyISO() : dias[0];
    const cantidad = Math.min(21, diferenciaDias(desde, dias[dias.length - 1]) + 1);
    return tiraDeDias(desde, Math.max(cantidad, 1));
  });

  /** Funciones del día elegido, agrupadas por formato + idioma. */
  protected grupos = computed<GrupoFunciones[]>(() => {
    const grupos = new Map<string, GrupoFunciones>();
    for (const f of this.funciones()) {
      if (diaDe(f.inicio) !== this.dia()) continue;
      const clave = `${f.formato}-${f.idioma}`;
      if (!grupos.has(clave))
        grupos.set(clave, { clave, formato: f.formato, idioma: f.idioma, funciones: [] });
      grupos.get(clave)!.funciones.push(f);
    }
    return [...grupos.values()].sort((a, b) => a.clave.localeCompare(b.clave));
  });

  protected miResena = computed(() => {
    const uid = this.auth.usuario()?.id;
    return this.resenas().find((r) => r.usuario_id === uid) ?? null;
  });

  protected distribucion = computed(() => {
    const total = this.resenas().length || 1;
    return [5, 4, 3, 2, 1].map((n) => ({
      estrellas: n,
      porcentaje: (this.resenas().filter((r) => r.estrellas === n).length / total) * 100,
    }));
  });

  async ngOnInit() {
    const id = Number(this.id());
    try {
      const [pelicula, funciones, resenas] = await Promise.all([
        this.catalogo.pelicula(id),
        this.catalogo.funcionesDe(id),
        this.resenasS.dePelicula(id),
      ]);
      if (!pelicula) {
        this.router.navigateByUrl('/cartelera');
        return;
      }
      this.pelicula.set(pelicula);
      this.title.setTitle(`${pelicula.titulo} · CineCorn`);
      this.funciones.set(funciones);
      this.resenas.set(resenas);
      this.dia.set(this.tira()[0]?.iso ?? null);
      const mia = this.miResena();
      if (mia) {
        this.estrellas.set(mia.estrellas);
        this.comentario.setValue(mia.comentario);
      }
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardarResena() {
    const p = this.pelicula();
    const uid = this.auth.usuario()?.id;
    if (!p || !uid || !this.estrellas() || this.comentario.invalid) return;
    this.guardando.set(true);
    try {
      await this.resenasS.guardar(p.id, uid, this.estrellas(), this.comentario.value.trim());
      this.resenas.set(await this.resenasS.dePelicula(p.id));
      this.avisos.ok('¡Gracias! Tu reseña quedó publicada.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async borrarResena() {
    const mia = this.miResena();
    if (!mia) return;
    await this.resenasS.eliminar(mia.id);
    this.resenas.update((l) => l.filter((r) => r.id !== mia.id));
    this.estrellas.set(0);
    this.comentario.setValue('');
  }

  protected async alerta() {
    const p = this.pelicula();
    if (!p) return;
    if (!this.auth.logueado()) {
      this.router.navigate(['/ingresar'], { queryParams: { volver: `/pelicula/${p.id}` } });
      return;
    }
    try {
      const activa = await this.notis.alternarAlerta(p.id);
      this.avisos.ok(activa ? 'Te avisamos cuando salgan las entradas.' : 'Alerta desactivada.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }
}
