import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminDatos } from '../../../services/admin';
import { Avisos } from '../../../services/ui';
import { Actividad } from '../../../interfaces/usuario';
import { TiempoRelativoPipe } from '../../../pipes/tiempo-relativo-pipe';
import { aISO, hoyISO, sumarDias } from '../../../utils/fechas';
import { mensajeError } from '../../../utils/errores';

const ACCIONES: Record<string, string> = {
  crear: 'creó',
  modificar: 'modificó',
  eliminar: 'eliminó',
  programar: 'programó funciones de',
  quitar: 'quitó funciones de',
  validar_entrada: 'validó el ingreso de la compra',
  entregar_candy: 'entregó el candy de la compra',
  cambiar_rol: 'cambió el rol de',
  cancelar: 'canceló la compra',
};

const ENTIDADES: Record<string, string> = {
  peliculas: 'la película',
  funciones: 'la función del',
  salas: 'la sala',
  formatos: 'el precio del formato',
  configuracion: 'la configuración general',
  categorias: 'la categoría',
  productos: 'el producto',
  combos: 'el combo',
  cupones: 'el cupón',
  recompensas: 'la recompensa',
};

const ACCIONES_SIN_ENTIDAD = [
  'programar',
  'quitar',
  'validar_entrada',
  'entregar_candy',
  'cancelar',
  'cambiar_rol',
];
const CAMPOS_OCULTOS = [
  'id',
  'creado_en',
  'fin',
  'pelicula_generos',
  'sinopsis',
  'poster_url',
  'fondo_url',
];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

interface GrupoDia {
  dia: string;
  titulo: string;
  eventos: Actividad[];
}

/** Registro de actividad: quién hizo qué y cuándo (lo completan triggers y RPC en la base). */
@Component({
  selector: 'app-admin-actividad',
  imports: [DatePipe, TiempoRelativoPipe],
  templateUrl: './actividad.html',
  styleUrl: './actividad.css',
})
export class AdminActividad implements OnInit {
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);

  protected filas = signal<Actividad[]>([]);
  protected total = signal(0);
  protected pagina = signal(0);
  protected entidad = signal<string>('');
  protected texto = signal('');
  protected abierta = signal<number | null>(null);
  protected readonly porPagina = 30;
  protected readonly filtros: [string, string][] = [
    ['', 'Todo'],
    ['funciones', 'Funciones'],
    ['peliculas', 'Películas'],
    ['compras', 'Validaciones de QR y cancelaciones'],
    ['formatos', 'Precios'],
    ['configuracion', 'Configuración'],
    ['productos', 'Candy'],
    ['cupones', 'Cupones'],
    ['perfiles', 'Personal'],
  ];
  protected paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina)));

  /** Eventos agrupados por día: "Hoy", "Ayer" o la fecha. */
  protected grupos = computed<GrupoDia[]>(() => {
    const hoy = hoyISO();
    const ayer = sumarDias(hoy, -1);
    const mapa = new Map<string, GrupoDia>();
    for (const a of this.filas()) {
      const dia = aISO(new Date(a.creado_en));
      if (!mapa.has(dia)) {
        const titulo = dia === hoy ? 'Hoy' : dia === ayer ? 'Ayer' : '';
        mapa.set(dia, { dia, titulo, eventos: [] });
      }
      mapa.get(dia)!.eventos.push(a);
    }
    return [...mapa.values()];
  });

  async ngOnInit() {
    await this.cargar();
  }

  protected async cargar() {
    try {
      const r = await this.admin.actividad({
        entidad: this.entidad() || undefined,
        texto: this.texto() || undefined,
        pagina: this.pagina(),
        porPagina: this.porPagina,
      });
      this.filas.set(r.filas);
      this.total.set(r.total);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected filtrar(entidad: string) {
    this.entidad.set(entidad);
    this.pagina.set(0);
    this.cargar();
  }

  protected buscar(texto: string) {
    this.texto.set(texto.trim());
    this.pagina.set(0);
    this.cargar();
  }

  protected irA(p: number) {
    this.pagina.set(p);
    this.cargar();
  }

  protected quien(a: Actividad): string {
    return a.usuario_email ?? 'Carga inicial del sistema';
  }

  protected frase(a: Actividad): string {
    const accion = ACCIONES[a.accion] ?? a.accion;
    if (ACCIONES_SIN_ENTIDAD.includes(a.accion)) return accion;
    return `${accion} ${ENTIDADES[a.entidad] ?? a.entidad}`;
  }

  protected etiqueta(a: Actividad): string {
    return this.valor(a.etiqueta);
  }

  /** Para modificaciones: campos con valor anterior y nuevo. */
  protected cambios(a: Actividad): { campo: string; antes: string; despues: string }[] {
    if (a.accion !== 'modificar' && a.accion !== 'cambiar_rol') return [];
    return Object.entries(a.detalle)
      .filter(([campo]) => !CAMPOS_OCULTOS.includes(campo))
      .map(([campo, v]) => {
        const par = v as { antes: unknown; despues: unknown };
        return {
          campo: this.nombreCampo(campo),
          antes: this.valor(par?.antes),
          despues: this.valor(par?.despues),
        };
      });
  }

  /** Para altas, bajas y otras acciones: los datos principales en lista. */
  protected datos(a: Actividad): { campo: string; valor: string }[] {
    return Object.entries(a.detalle)
      .filter(
        ([campo, v]) => !CAMPOS_OCULTOS.includes(campo) && v !== null && typeof v !== 'object',
      )
      .slice(0, 8)
      .map(([campo, v]) => ({ campo: this.nombreCampo(campo), valor: this.valor(v) }));
  }

  private nombreCampo(campo: string): string {
    const s = campo.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private valor(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (v === true) return 'sí';
    if (v === false) return 'no';
    if (Array.isArray(v)) return v.join(', ');
    const s = String(v);
    return ISO.test(s) ? FECHA_HORA.format(new Date(s)) : s;
  }
}
