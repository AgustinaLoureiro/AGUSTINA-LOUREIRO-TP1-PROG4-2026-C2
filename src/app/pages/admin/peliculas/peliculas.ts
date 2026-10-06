import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminDatos } from '../../../services/admin';
import { Avisos } from '../../../services/ui';
import { Pelicula } from '../../../interfaces/catalogo';
import { DuracionPipe } from '../../../pipes/duracion-pipe';
import { ImagenRespaldo } from '../../../directives/imagen-respaldo';
import { hoyISO } from '../../../utils/fechas';
import { mensajeError } from '../../../utils/errores';
import { Confirmacion } from '../../../services/confirmacion';
import { ProgramacionesPelicula } from '../../../components/programaciones-pelicula/programaciones-pelicula';

type Filtro = 'todas' | 'cartelera' | 'proximas' | 'ocultas';
type Orden = 'estreno-desc' | 'estreno-asc' | 'titulo-asc' | 'titulo-desc' | 'funciones-desc';

@Component({
  selector: 'app-admin-peliculas',
  imports: [DatePipe, RouterLink, DuracionPipe, ImagenRespaldo, ProgramacionesPelicula],
  templateUrl: './peliculas.html',
  styleUrl: './peliculas.css',
})
export class AdminPeliculas implements OnInit {
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  protected cargando = signal(true);
  protected peliculas = signal<Pelicula[]>([]);
  protected filtro = signal<Filtro>('todas');
  protected orden = signal<Orden>('estreno-desc');
  protected texto = signal('');
  /** Funciones próximas de cada película. */
  private funciones = signal(new Map<number, number>());
  /** Película con sus funciones desplegadas debajo de la fila. */
  protected abierta = signal<number | null>(null);

  protected readonly filtros: [Filtro, string][] = [
    ['todas', 'Todas'],
    ['cartelera', 'En cartelera'],
    ['proximas', 'Próximamente'],
    ['ocultas', 'Ocultas'],
  ];

  protected readonly ordenes: [Orden, string][] = [
    ['estreno-desc', 'Estreno: más nuevas primero'],
    ['estreno-asc', 'Estreno: más viejas primero'],
    ['titulo-asc', 'Título: A → Z'],
    ['titulo-desc', 'Título: Z → A'],
    ['funciones-desc', 'Más funciones primero'],
  ];

  protected lista = computed(() => {
    const t = this.texto().toLowerCase();
    const filtro = this.filtro();
    const hoy = hoyISO();
    const filtradas = this.peliculas().filter((p) => {
      if (t && !p.titulo.toLowerCase().includes(t)) return false;
      switch (filtro) {
        case 'cartelera':
          return p.visible && p.fecha_estreno <= hoy;
        case 'proximas':
          return p.visible && p.fecha_estreno > hoy;
        case 'ocultas':
          return !p.visible;
        default:
          return true;
      }
    });
    return filtradas.sort(this.comparador(this.orden()));
  });

  private comparador(orden: Orden): (a: Pelicula, b: Pelicula) => number {
    switch (orden) {
      case 'estreno-asc':
        return (a, b) => a.fecha_estreno.localeCompare(b.fecha_estreno);
      case 'titulo-asc':
        return (a, b) => a.titulo.localeCompare(b.titulo, 'es');
      case 'titulo-desc':
        return (a, b) => b.titulo.localeCompare(a.titulo, 'es');
      case 'funciones-desc':
        return (a, b) => this.cantidadFunciones(b) - this.cantidadFunciones(a);
      default:
        return (a, b) => b.fecha_estreno.localeCompare(a.fecha_estreno);
    }
  }

  protected cantidadFunciones(p: Pelicula): number {
    return this.funciones().get(p.id) ?? 0;
  }

  protected alternarFunciones(p: Pelicula) {
    this.abierta.update((id) => (id === p.id ? null : p.id));
  }

  async ngOnInit() {
    // Las películas cuya última función ya pasó se ocultan antes de mostrar la lista
    try {
      await this.admin.ocultarSinFunciones();
    } catch {
      // si falla, la lista se muestra igual
    }
    await this.cargar();
  }

  /** También se usa después de quitar funciones: puede haber cambiado la visibilidad. */
  protected async cargar() {
    try {
      const [peliculas, funciones] = await Promise.all([
        this.admin.peliculas(),
        this.admin.funcionesProximasPorPelicula(),
      ]);
      this.peliculas.set(peliculas);
      this.funciones.set(funciones);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async alternarVisible(p: Pelicula) {
    try {
      await this.admin.cambiarVisibilidad(p.id, !p.visible);
      this.peliculas.update((l) =>
        l.map((x) => (x.id === p.id ? { ...x, visible: !p.visible } : x)),
      );
      this.avisos.ok(
        `${p.titulo} ${!p.visible ? 'ahora es visible' : 'quedó oculta'} en el sitio.`,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async eliminar(p: Pelicula) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar "${p.titulo}"?`,
        mensaje: 'Solo se puede si no tiene funciones. Si no, podés ocultarla del sitio.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarPelicula(p.id);
      this.peliculas.update((l) => l.filter((x) => x.id !== p.id));
      this.avisos.ok('Película eliminada.');
    } catch (e) {
      this.avisos.error(mensajeError(e, 'No se pudo eliminar.') + ' Podés ocultarla en su lugar.');
    }
  }
}
