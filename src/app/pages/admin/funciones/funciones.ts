import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDatos } from '../../../services/admin';
import { Avisos } from '../../../services/ui';
import {
  Formato,
  Funcion,
  Pelicula,
  ResultadoProgramacion,
  Sala,
} from '../../../interfaces/catalogo';
import { CampoFecha, fechaValida } from '../../../components/campo-fecha/campo-fecha';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { ProgramacionesPelicula } from '../../../components/programaciones-pelicula/programaciones-pelicula';
import { TiraDias } from '../../../components/tira-dias/tira-dias';
import { PrecioPipe } from '../../../pipes/precio-pipe';
import { IdiomaPipe } from '../../../pipes/idioma-pipe';
import {
  desdeISO,
  diaDe,
  diferenciaDias,
  hoyISO,
  proximosJueves,
  sumarDias,
  tiraDeDias,
} from '../../../utils/fechas';
import { generarHorarios, HorarioGenerado } from '../../../utils/horarios';
import { fechaNoPasada } from '../../../utils/validadores';
import { mensajeError } from '../../../utils/errores';
import { Confirmacion } from '../../../services/confirmacion';

type FuncionAgenda = Funcion & { vendidas: number };
type Pestania = 'programar' | 'cartel' | 'agenda';

/** Resumen de lo que una película tiene programado de acá en adelante. */
interface PeliculaEnCartel {
  peliculaId: number;
  titulo: string;
  poster: string | null;
  funciones: number;
  desde: string;
  hasta: string;
  salas: string[];
  formatos: string[];
  vendidas: number;
  conVentas: number;
  /** Programaciones (tandas) distintas. */
  tandas: Set<string>;
}

/** Todas las funciones empiezan dentro del mismo día: la última, antes de las 23:59. */
const ULTIMO_INICIO = '23:59';

const HORA_INICIO_AGENDA = 10; // 10:00
const HORAS_AGENDA = 17; // hasta las 03:00

@Component({
  selector: 'app-admin-funciones',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    CampoFecha,
    ErroresCampo,
    TiraDias,
    PrecioPipe,
    IdiomaPipe,
    ProgramacionesPelicula,
  ],
  templateUrl: './funciones.html',
  styleUrl: './funciones.css',
})
export class AdminFunciones implements OnInit {
  /** ?pelicula=ID para llegar desde la lista de películas con la película elegida. */
  pelicula = input<string>();

  private fb = inject(FormBuilder);
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  protected peliculas = signal<Pelicula[]>([]);
  protected formatos = signal<Formato[]>([]);
  protected salas = signal<Sala[]>([]);
  protected resultados = signal<ResultadoProgramacion[] | null>(null);
  /** Datos de la última programación confirmada (para la pantalla de resultado). */
  protected programada = signal<{
    titulo: string;
    poster: string | null;
    formato: string;
    idioma: string;
    desde: string;
    hasta: string;
  } | null>(null);
  protected programando = signal(false);
  protected limpieza = signal(30);
  protected pestania = signal<Pestania>('programar');
  protected cartel = signal<PeliculaEnCartel[]>([]);
  protected cargandoCartel = signal(false);
  protected quitando = signal<number | null>(null);
  /** Película de En cartel con sus tandas desplegadas. */
  protected tandasAbiertas = signal<number | null>(null);

  protected readonly horas = [
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
  ];
  protected readonly minutos = ['00', '15', '30', '45'];
  protected readonly dias: [number, string][] = [
    [1, 'Lun'],
    [2, 'Mar'],
    [3, 'Mié'],
    [4, 'Jue'],
    [5, 'Vie'],
    [6, 'Sáb'],
    [0, 'Dom'],
  ];
  /**
   * Semanas de cine (de jueves a miércoles). Un estreno suele estar entre 2 y 8
   * semanas en cartel; por defecto se programan 4 y después se extiende o se quita.
   */
  protected readonly atajosHasta = [
    { texto: '2 semanas', dias: 13 },
    { texto: '4 semanas', dias: 27 },
    { texto: '6 semanas', dias: 41 },
    { texto: '8 semanas', dias: 55 },
  ];

  // El formulario arranca vacío: cada dato se elige a mano en cada programación.
  protected form = this.fb.group({
    peliculaId: this.fb.control<number | null>(null, Validators.required),
    formato: this.fb.control<Formato['codigo'] | null>(null, Validators.required),
    idioma: this.fb.control<'CAST' | 'SUBT' | null>(null, Validators.required),
    desde: this.fb.control<string | null>(null, [Validators.required, fechaValida, fechaNoPasada]),
    hasta: this.fb.control<string | null>(null, [Validators.required, fechaValida]),
    // Cada franja agrupa días con la misma grilla (ej. semana vs. fin de semana)
    franjas: this.fb.array([this.nuevaFranja()]),
  });

  private peliculaId = toSignal(this.form.controls.peliculaId.valueChanges, { initialValue: null });
  protected desdeElegido = toSignal(this.form.controls.desde.valueChanges, {
    initialValue: this.form.controls.desde.value,
  });
  /**
   * Películas del selector agrupadas para encontrarlas rápido: las que todavía
   * no tienen funciones, los próximos estrenos y las que ya están en cartel.
   */
  protected gruposPeliculas = computed(() => {
    const hoy = hoyISO();
    const enCartel = new Set(this.cartel().map((c) => c.peliculaId));
    const todas = this.peliculas();
    return [
      {
        nombre: 'Sin funciones',
        peliculas: todas.filter((p) => !enCartel.has(p.id) && p.fecha_estreno <= hoy),
      },
      {
        nombre: 'Próximos estrenos',
        peliculas: todas
          .filter((p) => !enCartel.has(p.id) && p.fecha_estreno > hoy)
          .sort((a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno)),
      },
      { nombre: 'En cartel', peliculas: todas.filter((p) => enCartel.has(p.id)) },
    ].filter((g) => g.peliculas.length);
  });

  /** Próximos jueves (día de estreno) y, si la película aún no se estrenó, su fecha de estreno. */
  protected atajosDesde = computed(() => {
    const jueves = proximosJueves(4);
    const p = this.peliculas().find((x) => x.id === Number(this.peliculaId()));
    if (!p || p.fecha_estreno <= hoyISO()) return jueves;
    const dias = diferenciaDias(hoyISO(), p.fecha_estreno);
    const [, m, d] = p.fecha_estreno.split('-').map(Number);
    return [{ texto: 'Estreno ' + d + '/' + m, dias }, ...jueves.filter((j) => j.dias > dias)];
  });

  // Agenda
  protected diaAgenda = signal(hoyISO());
  protected readonly tira = tiraDeDias(hoyISO(), 21);
  protected funcionesDia = signal<FuncionAgenda[]>([]);
  protected seleccionada = signal<FuncionAgenda | null>(null);
  protected cargandoAgenda = signal(false);
  protected readonly marcas = Array.from(
    { length: HORAS_AGENDA + 1 },
    (_, i) => (HORA_INICIO_AGENDA + i) % 24,
  );

  protected filasAgenda = computed(() =>
    this.salas().map((s) => ({
      sala: s,
      funciones: this.funcionesDia().filter((f) => f.sala_id === s.id),
    })),
  );

  async ngOnInit() {
    try {
      const [peliculas, formatos, salas, config] = await Promise.all([
        this.admin.peliculas(),
        this.admin.formatos(),
        this.admin.salas(),
        this.admin.configuracion(),
      ]);
      // Todas: las nuevas nacen ocultas y se publican al programarlas
      this.peliculas.set(peliculas);
      this.formatos.set(formatos);
      this.salas.set(salas);
      this.limpieza.set(config.minutos_limpieza);
      // Si se llega desde Películas, esa película ya viene elegida
      const id = Number(this.pelicula());
      if (id) this.form.controls.peliculaId.setValue(id);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
    await Promise.all([this.cargarAgenda(), this.cargarCartel()]);
  }

  protected cambiarPestania(p: Pestania) {
    // Al salir de Programar, el resultado se descarta: al volver, el formulario está limpio
    if (p !== 'programar') this.resultados.set(null);
    this.pestania.set(p);
    if (p === 'cartel') this.cargarCartel();
    if (p === 'agenda') this.cargarAgenda();
  }

  // ---------- Programador por franjas ----------
  /** Franja vacía: sin días, sin horario y sin modo elegidos. */
  private nuevaFranja() {
    return this.fb.nonNullable.group({
      nombre: [''],
      dias: [[] as number[]],
      hora: [''],
      minuto: [''],
      modo: ['' as 'cantidad' | 'cierre' | ''],
      cantidad: [1, [Validators.min(1), Validators.max(10)]],
      excluidos: [[] as string[]],
    });
  }

  /** Nombre visible de la franja (si no se le puso uno, "Franja N"). */
  protected nombreFranja(i: number): string {
    return this.franjas.at(i).controls.nombre.value.trim() || `Franja ${i + 1}`;
  }

  /** Qué le falta a la franja para poder calcular sus horarios (null si está completa). */
  protected faltaEnFranja(i: number): string | null {
    const f = this.franjas.at(i).getRawValue();
    if (!this.peliculaElegida) return 'Elegí una película para ver los horarios.';
    if (!f.dias.length) return 'Elegí los días de la franja.';
    if (!f.hora || !f.minuto) return 'Elegí la hora y los minutos de la primera función.';
    if (!f.modo) return 'Elegí cuántas funciones por día.';
    return null;
  }

  protected get franjas() {
    return this.form.controls.franjas;
  }

  protected agregarFranja() {
    const usados = new Set(this.franjas.getRawValue().flatMap((f) => f.dias));
    const libres = this.dias.map((d) => d[0]).filter((d) => !usados.has(d));
    this.franjas.push(this.nuevaFranja());
  }

  protected quitarFranja(i: number) {
    if (this.franjas.length > 1) this.franjas.removeAt(i);
  }

  /** Un día pertenece a una sola franja: al marcarlo en una, se quita de las demás. */
  protected alternarDia(i: number, dia: number) {
    this.franjas.controls.forEach((franja, j) => {
      const dias = franja.controls.dias.value;
      if (j === i) {
        franja.controls.dias.setValue(
          dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia],
        );
      } else if (dias.includes(dia)) {
        franja.controls.dias.setValue(dias.filter((d) => d !== dia));
      }
    });
  }

  protected duenioDe(dia: number, i: number): string | null {
    const j = this.franjas.getRawValue().findIndex((f, k) => k !== i && f.dias.includes(dia));
    return j >= 0 ? this.nombreFranja(j) : null;
  }

  /** Horarios generados automáticamente para la franja (duración + limpieza). */
  protected horariosDe(i: number): HorarioGenerado[] {
    if (this.faltaEnFranja(i)) return [];
    const f = this.franjas.at(i).getRawValue();
    return generarHorarios({
      inicio: `${f.hora}:${f.minuto}`,
      duracion: this.peliculaElegida?.duracion_min ?? 0,
      limpieza: this.limpieza(),
      modo: f.modo || 'cantidad',
      cantidad: f.cantidad,
      ultimoInicio: ULTIMO_INICIO,
    });
  }

  protected activos(i: number): string[] {
    const excluidos = this.franjas.at(i).controls.excluidos.value;
    return this.horariosDe(i)
      .map((h) => h.inicio)
      .filter((h) => !excluidos.includes(h));
  }

  protected alternarExcluido(i: number, hora: string) {
    const c = this.franjas.at(i).controls.excluidos;
    c.setValue(c.value.includes(hora) ? c.value.filter((h) => h !== hora) : [...c.value, hora]);
  }

  protected cambiarCantidad(i: number, delta: number) {
    const c = this.franjas.at(i).controls.cantidad;
    c.setValue(Math.min(10, Math.max(1, c.value + delta)));
  }

  protected get peliculaElegida(): Pelicula | undefined {
    return this.peliculas().find((p) => p.id === Number(this.form.controls.peliculaId.value));
  }

  /** El precio de la entrada es el del formato (se cambia en Precios y beneficios). */
  protected get precioFormato(): number {
    return Number(
      this.formatos().find((f) => f.codigo === this.form.controls.formato.value)?.precio ?? 0,
    );
  }

  /** Salas activas equipadas para un formato (3D, 4D y 5D no están en todas). */
  protected salasCon(codigo: Formato['codigo']): string[] {
    return this.salas()
      .filter((s) => s.activa && (s.formatos ?? ['2D']).includes(codigo))
      .map((s) => s.nombre);
  }

  protected elegirFormato(codigo: Formato['codigo']) {
    this.form.controls.formato.setValue(codigo);
  }

  private diasEnRango(dias: number[]): number {
    const { desde, hasta } = this.form.getRawValue();
    if (!desde || !hasta || hasta < desde) return 0;
    let total = 0;
    for (let i = 0; i <= diferenciaDias(desde, hasta); i++) {
      if (dias.includes(desdeISO(sumarDias(desde, i)).getDay())) total++;
    }
    return total;
  }

  protected totalFranja(i: number): number {
    return this.diasEnRango(this.franjas.at(i).controls.dias.value) * this.activos(i).length;
  }

  protected get cantidadEstimada(): number {
    return this.franjas.controls.reduce((t, _, i) => t + this.totalFranja(i), 0);
  }

  protected async programar() {
    const v = this.form.getRawValue();
    const falta = this.faltante();
    if (falta) {
      this.form.markAllAsTouched();
      this.avisos.error(falta);
      return;
    }
    if (v.hasta! < v.desde!) {
      this.avisos.error('La fecha "hasta" no puede ser anterior a "desde".');
      return;
    }
    this.programando.set(true);
    // Todas las franjas de esta programación quedan en la misma tanda
    const tanda = crypto.randomUUID();
    try {
      const todos: ResultadoProgramacion[] = [];
      for (let i = 0; i < this.franjas.length; i++) {
        const dias = this.franjas.at(i).controls.dias.value;
        const horarios = this.activos(i);
        if (!dias.length || !horarios.length) continue;
        todos.push(
          ...(await this.admin.programarFunciones({
            peliculaId: Number(v.peliculaId),
            formato: v.formato!,
            idioma: v.idioma!,
            desde: v.desde!,
            hasta: v.hasta!,
            dias,
            horarios,
            tanda,
          })),
        );
      }
      todos.sort((a, b) => a.horario.localeCompare(b.horario));
      const p = this.peliculaElegida;
      this.programada.set({
        titulo: p?.titulo ?? '',
        poster: p?.poster_url ?? null,
        formato: v.formato!,
        idioma: v.idioma!,
        desde: v.desde!,
        hasta: v.hasta!,
      });
      this.resultados.set(todos);
      this.limpiarFormulario();
      window.scrollTo({ top: 0 });
      const ok = todos.filter((x) => x.resultado === 'ok').length;
      this.avisos.ok(`Se programaron ${ok} de ${todos.length} funciones.`);
      await Promise.all([this.cargarAgenda(), this.cargarCartel()]);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.programando.set(false);
    }
  }

  /** Primer dato que falta completar, en el orden del formulario (null si está todo). */
  private faltante(): string | null {
    const c = this.form.controls;
    if (c.peliculaId.invalid) return 'Elegí la película.';
    if (c.formato.invalid) return 'Elegí el formato.';
    if (c.idioma.invalid) return 'Elegí el idioma.';
    if (c.desde.invalid || c.hasta.invalid) return 'Completá el período en cartel.';
    if (c.hasta.value! < c.desde.value!) return 'La fecha "hasta" no puede ser anterior a "desde".';
    for (let i = 0; i < this.franjas.length; i++) {
      const falta = this.faltaEnFranja(i);
      if (falta)
        return `${this.nombreFranja(i)}: ${falta.charAt(0).toLowerCase()}${falta.slice(1)}`;
    }
    if (!this.cantidadEstimada) return 'Con esos datos no queda ninguna función para programar.';
    return null;
  }

  /** Deja el formulario vacío: cada programación arranca de cero. */
  private limpiarFormulario() {
    this.form.reset();
    this.franjas.clear();
    this.franjas.push(this.nuevaFranja());
  }

  /** Abre Programar vacío; si se indica una película (desde En cartel), ya viene elegida. */
  protected programarOtra(peliculaId: number | null = null) {
    this.resultados.set(null);
    this.limpiarFormulario();
    this.form.controls.peliculaId.setValue(peliculaId);
    this.cambiarPestania('programar');
    window.scrollTo({ top: 0 });
  }

  protected contar(estado: ResultadoProgramacion['resultado']): number {
    return this.resultados()?.filter((r) => r.resultado === estado).length ?? 0;
  }

  protected textoResultado(r: ResultadoProgramacion['resultado']): string {
    return {
      ok: 'Programada',
      sin_sala: 'Sin sala libre',
      pasado: 'Horario pasado',
      antes_del_estreno: 'Antes del estreno',
    }[r];
  }

  // ---------- En cartel: lo programado, agrupado por película ----------
  protected async cargarCartel() {
    this.cargandoCartel.set(true);
    try {
      const funciones = await this.admin.funcionesProximas();
      const grupos = new Map<number, PeliculaEnCartel>();
      for (const fn of funciones) {
        let g = grupos.get(fn.pelicula_id);
        if (!g) {
          g = {
            peliculaId: fn.pelicula_id,
            titulo: fn.peliculas?.titulo ?? '',
            poster: fn.peliculas?.poster_url ?? null,
            funciones: 0,
            desde: fn.inicio,
            hasta: fn.inicio,
            salas: [],
            formatos: [],
            vendidas: 0,
            conVentas: 0,
            tandas: new Set<string>(),
          };
          grupos.set(fn.pelicula_id, g);
        }
        g.tandas.add(fn.tanda ?? 'sin-tanda');
        g.funciones++;
        g.hasta = fn.inicio;
        g.vendidas += fn.vendidas;
        if (fn.vendidas) g.conVentas++;
        const sala = fn.salas?.nombre ?? '';
        if (!g.salas.includes(sala)) g.salas.push(sala);
        if (!g.formatos.includes(fn.formato)) g.formatos.push(fn.formato);
      }
      this.cartel.set([...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo)));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.cargandoCartel.set(false);
    }
  }

  /**
   * Quita las funciones de una película desde una fecha. Las que tienen entradas
   * vendidas se conservan, porque hay clientes con su QR.
   */
  protected async quitar(peliculaId: number, titulo: string, desde: Date, descripcion: string) {
    const ok = await this.confirmacion.pedir({
      titulo: '¿Quitar las funciones de "' + titulo + '" ' + descripcion + '?',
      mensaje: 'Las funciones que ya tienen entradas vendidas se conservan.',
      aceptar: 'Quitar funciones',
      peligro: true,
    });
    if (!ok) return;
    this.quitando.set(peliculaId);
    try {
      const r = await this.admin.quitarFunciones(peliculaId, desde.toISOString());
      this.avisos.ok(
        'Se quitaron ' +
          r.eliminadas +
          ' funciones.' +
          (r.con_ventas ? ' Se conservaron ' + r.con_ventas + ' con entradas vendidas.' : ''),
      );
      this.seleccionada.set(null);
      await Promise.all([this.cargarCartel(), this.cargarAgenda()]);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.quitando.set(null);
    }
  }

  protected alternarTandas(p: PeliculaEnCartel) {
    this.tandasAbiertas.update((id) => (id === p.peliculaId ? null : p.peliculaId));
  }

  protected quitarTodas(p: PeliculaEnCartel) {
    this.quitar(p.peliculaId, p.titulo, new Date(), 'de ahora en adelante');
  }

  /** Bajar de cartel al cierre de la semana de cine: desde el próximo jueves. */
  protected quitarDesdeJueves(p: PeliculaEnCartel) {
    const jueves = desdeISO(sumarDias(hoyISO(), proximosJueves(1)[0].dias || 7));
    jueves.setHours(6);
    this.quitar(
      p.peliculaId,
      p.titulo,
      jueves,
      'desde el jueves ' + jueves.getDate() + '/' + (jueves.getMonth() + 1),
    );
  }

  protected verEnAgenda(p: PeliculaEnCartel) {
    this.diaAgenda.set(diaDe(p.desde) < hoyISO() ? hoyISO() : diaDe(p.desde));
    this.cambiarPestania('agenda');
  }

  // ---------- Agenda ----------
  protected async elegirDia(iso: string) {
    this.diaAgenda.set(iso);
    this.seleccionada.set(null);
    await this.cargarAgenda();
  }

  protected async cargarAgenda() {
    this.cargandoAgenda.set(true);
    const inicio = desdeISO(this.diaAgenda());
    inicio.setHours(HORA_INICIO_AGENDA - 4);
    const fin = new Date(inicio);
    fin.setHours(fin.getHours() + 24);
    try {
      this.funcionesDia.set(
        await this.admin.funcionesDelDia(inicio.toISOString(), fin.toISOString()),
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.cargandoAgenda.set(false);
    }
  }

  /** Posición horizontal de un bloque en la grilla (porcentaje). */
  protected posicion(f: FuncionAgenda) {
    const base = desdeISO(this.diaAgenda());
    base.setHours(HORA_INICIO_AGENDA);
    const total = HORAS_AGENDA * 60;
    const inicio = (new Date(f.inicio).getTime() - base.getTime()) / 60000;
    const duracion = (new Date(f.fin).getTime() - new Date(f.inicio).getTime()) / 60000;
    return {
      izquierda: Math.max(0, (inicio / total) * 100),
      ancho: (duracion / total) * 100,
      limpieza: (30 / total) * 100,
    };
  }

  protected seleccionar(f: FuncionAgenda) {
    this.seleccionada.set(f);
  }

  protected async alternarActiva(f: FuncionAgenda) {
    try {
      await this.admin.actualizarFuncion(f.id, { activa: !f.activa });
      this.avisos.ok(f.activa ? 'Función cancelada: la sala quedó libre.' : 'Función reactivada.');
      await this.cargarAgenda();
      this.seleccionada.set(null);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  /** Desde la agenda: quitar la película a partir del día elegido. */
  protected quitarDesdeEsteDia(f: FuncionAgenda) {
    const dia = desdeISO(this.diaAgenda());
    dia.setHours(6);
    this.quitar(
      f.pelicula_id,
      f.peliculas?.titulo ?? '',
      dia,
      'desde el ' + dia.getDate() + '/' + (dia.getMonth() + 1),
    );
  }

  protected async eliminar(f: FuncionAgenda) {
    if (
      !(await this.confirmacion.pedir({
        titulo: '¿Quitar esta función?',
        mensaje: 'La sala queda libre en ese horario.',
        aceptar: 'Quitar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarFuncion(f.id);
      this.avisos.ok('Función eliminada.');
      this.seleccionada.set(null);
      await this.cargarAgenda();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }
}
