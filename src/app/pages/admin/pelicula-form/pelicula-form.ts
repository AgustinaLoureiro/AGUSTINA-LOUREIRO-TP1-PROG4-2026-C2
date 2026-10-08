import { Component, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { AdminDatos } from '../../../services/admin';
import { Storage } from '../../../services/storage';
import { ResultadoTmdb, Tmdb } from '../../../services/tmdb';
import { Avisos } from '../../../services/ui';
import { Clasificacion, Genero, PeliculaPorGuardar } from '../../../interfaces/catalogo';
import { CampoFecha, fechaValida } from '../../../components/campo-fecha/campo-fecha';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { ImagenRespaldo } from '../../../directives/imagen-respaldo';
import { mensajeError } from '../../../utils/errores';
import { entero, idYoutube, textoRequerido, trailerYoutube } from '../../../utils/validadores';
import { desdeISO, proximosJueves } from '../../../utils/fechas';
import { SoloNumeros } from '../../../directives/solo-numeros';

@Component({
  selector: 'app-pelicula-form',
  imports: [SoloNumeros, ReactiveFormsModule, RouterLink, CampoFecha, ErroresCampo, ImagenRespaldo],
  templateUrl: './pelicula-form.html',
  styleUrl: './pelicula-form.css',
})
export class PeliculaForm implements OnInit {
  /** :id de la ruta; vacío cuando es una película nueva. */
  id = input<string>();

  private fb = inject(FormBuilder);
  private admin = inject(AdminDatos);
  private storage = inject(Storage);
  private tmdb = inject(Tmdb);
  private router = inject(Router);
  private avisos = inject(Avisos);

  protected generos = signal<Genero[]>([]);
  protected generosElegidos = signal<ReadonlySet<number>>(new Set());
  protected guardando = signal(false);
  protected subiendo = signal<'poster' | 'fondo' | null>(null);
  protected resultadosTmdb = signal<ResultadoTmdb[]>([]);
  protected buscandoTmdb = signal(false);
  protected readonly clasificaciones: Clasificacion[] = ['ATP', '+13', '+18'];
  /** En Argentina los estrenos son los jueves: se ofrecen los próximos. */
  protected readonly atajos = proximosJueves(4);
  protected limpieza = signal(30);
  protected nuevoGenero = this.fb.nonNullable.control('', [Validators.maxLength(30)]);

  protected busquedaTmdb = this.fb.nonNullable.control('');

  protected form = this.fb.group({
    titulo: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.maxLength(120),
    ]),
    // Todo cine publica una sinopsis: es obligatoria
    sinopsis: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.minLength(40),
      Validators.maxLength(1200),
    ]),
    duracion_min: this.fb.control<number | null>(null, [
      Validators.required,
      entero,
      Validators.min(1),
      Validators.max(400),
    ]),
    clasificacion: this.fb.nonNullable.control<Clasificacion>('ATP'),
    fecha_estreno: this.fb.control<string | null>(null, [Validators.required, fechaValida]),
    // Las imágenes se suben a Supabase Storage; el póster es obligatorio
    poster_url: this.fb.control<string | null>(null, Validators.required),
    fondo_url: this.fb.control<string | null>(null),
    // Se puede pegar el link completo de YouTube o solo el ID del video
    trailer_youtube: this.fb.control<string | null>(null, trailerYoutube),
    // Nace oculta: se hace visible al programarle funciones (o a mano)
    visible: this.fb.nonNullable.control(false),
    preventa_habilitada: this.fb.nonNullable.control(false),
    preventa_dias: this.fb.nonNullable.control(7, [
      Validators.required,
      entero,
      Validators.min(1),
      Validators.max(60),
    ]),
    preventa_descuento: this.fb.nonNullable.control(20, [
      Validators.required,
      entero,
      Validators.min(0),
      Validators.max(90),
    ]),
    tmdb_id: this.fb.control<number | null>(null),
  });

  constructor() {
    // Búsqueda en TMDB mientras se escribe (debounce + switchMap cancela la anterior).
    this.busquedaTmdb.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        filter((t) => t.trim().length >= 2),
        tap(() => this.buscandoTmdb.set(true)),
        switchMap((t) => this.tmdb.buscar(t).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.resultadosTmdb.set(r);
        this.buscandoTmdb.set(false);
      });
  }

  async ngOnInit() {
    try {
      const [generos, config] = await Promise.all([
        this.admin.generos(),
        this.admin.configuracion(),
      ]);
      this.generos.set(generos);
      this.limpieza.set(config.minutos_limpieza);
      const id = Number(this.id());
      if (id) {
        const p = await this.admin.pelicula(id);
        this.form.patchValue(p);
        this.generosElegidos.set(new Set(p.pelicula_generos?.map((g) => g.genero_id)));
      }
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  /** Completa el formulario con los datos de TMDB; se guardan en Supabase al tocar Guardar. */
  protected async importar(r: ResultadoTmdb) {
    this.resultadosTmdb.set([]);
    this.busquedaTmdb.setValue('', { emitEvent: false });
    try {
      const datos = await this.tmdb.detalle(r.id);
      const ids = await this.admin.asegurarGeneros(datos.generos);
      this.generos.set(await this.admin.generos());
      this.generosElegidos.set(new Set(ids));
      const { generos: _, ...resto } = datos;
      this.form.patchValue(resto);
      this.form.markAsDirty();
      this.avisos.ok(`Datos de "${datos.titulo}" importados. Revisalos antes de guardar.`);
    } catch (e) {
      this.avisos.error('No se pudo importar desde TMDB: ' + mensajeError(e));
    }
  }

  protected get minutosEnSala(): number {
    return (Number(this.form.controls.duracion_min.value) || 0) + this.limpieza();
  }

  protected get estrenoNoEsJueves(): boolean {
    const f = this.form.controls.fecha_estreno.value;
    return !!f && this.form.controls.fecha_estreno.valid && desdeISO(f).getDay() !== 4;
  }

  /** Alta de un género que no está en la lista. */
  protected async agregarGenero() {
    const nombre = this.nuevoGenero.value.trim();
    if (!nombre) return;
    const existente = this.generos().find((g) => g.nombre.toLowerCase() === nombre.toLowerCase());
    try {
      const [id] = existente ? [existente.id] : await this.admin.asegurarGeneros([nombre]);
      if (!existente) this.generos.set(await this.admin.generos());
      this.generosElegidos.update((s) => new Set(s).add(id));
      this.nuevoGenero.setValue('');
      this.form.markAsDirty();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected alternarGenero(id: number) {
    this.generosElegidos.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    this.form.markAsDirty();
  }

  protected quitarImagen(campo: 'poster' | 'fondo') {
    this.form.controls[campo === 'poster' ? 'poster_url' : 'fondo_url'].setValue(null);
    this.form.markAsDirty();
  }

  protected async subir(evento: Event, campo: 'poster' | 'fondo') {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendo.set(campo);
    try {
      const url = await this.storage.subirImagen(
        archivo,
        campo === 'poster' ? 'posters' : 'fondos',
      );
      this.form.controls[campo === 'poster' ? 'poster_url' : 'fondo_url'].setValue(url);
      this.form.markAsDirty();
      this.avisos.ok('Imagen subida.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.subiendo.set(null);
    }
  }

  protected async guardar() {
    if (this.form.invalid || !this.generosElegidos().size) {
      this.form.markAllAsTouched();
      this.avisos.error(
        !this.generosElegidos().size
          ? 'Elegí al menos un género.'
          : this.form.controls.poster_url.invalid
            ? 'Subí el póster de la película.'
            : 'Revisá los campos marcados.',
      );
      return;
    }
    this.guardando.set(true);
    try {
      const v = this.form.getRawValue();
      const datos: PeliculaPorGuardar = {
        ...v,
        titulo: v.titulo.trim(),
        sinopsis: v.sinopsis.trim(),
        duracion_min: Number(v.duracion_min),
        fecha_estreno: v.fecha_estreno!,
        trailer_youtube: idYoutube(v.trailer_youtube),
      };
      await this.admin.guardarPelicula(
        datos,
        [...this.generosElegidos()],
        Number(this.id()) || undefined,
      );
      // Si con este cambio abrió la venta (ej. se habilitó la preventa), se avisa a quienes tenían alerta
      this.admin.procesarAlertas().catch(() => undefined);
      this.avisos.ok('Película guardada.');
      this.router.navigateByUrl('/admin/peliculas');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
