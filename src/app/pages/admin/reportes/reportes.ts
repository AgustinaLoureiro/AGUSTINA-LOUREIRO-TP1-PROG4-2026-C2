import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Reportes as ReportesServicio } from '../../../services/reportes';
import { Avisos } from '../../../services/ui';
import { FilaReporte, RankingPelicula, RankingProducto } from '../../../interfaces/usuario';
import { GraficoBarras } from '../../../components/grafico-barras/grafico-barras';
import { PrecioPipe } from '../../../pipes/precio-pipe';
import { finDeMes, hoyISO, inicioDeMes, inicioDeSemana, sumarDias } from '../../../utils/fechas';
import { mensajeError } from '../../../utils/errores';

type Rango = '7' | '30' | 'mes' | 'mes-anterior';
type Periodo = 'semana' | 'mes';

@Component({
  selector: 'app-reportes',
  imports: [DatePipe, GraficoBarras, PrecioPipe],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes implements OnInit {
  private servicio = inject(ReportesServicio);
  private avisos = inject(Avisos);

  // Facturación
  protected rango = signal<Rango>('7');
  protected filas = signal<FilaReporte[]>([]);
  protected exportando = signal<'pdf' | 'xlsx' | null>(null);
  protected readonly rangos: [Rango, string][] = [
    ['7', 'Últimos 7 días'],
    ['30', 'Últimos 30 días'],
    ['mes', 'Este mes'],
    ['mes-anterior', 'Mes anterior'],
  ];

  protected fechas = computed(() => {
    const hoy = hoyISO();
    switch (this.rango()) {
      case '30':
        return { desde: sumarDias(hoy, -29), hasta: hoy };
      case 'mes':
        return { desde: inicioDeMes(hoy), hasta: hoy };
      case 'mes-anterior': {
        const finAnterior = sumarDias(inicioDeMes(hoy), -1);
        return { desde: inicioDeMes(finAnterior), hasta: finDeMes(finAnterior) };
      }
      default:
        return { desde: sumarDias(hoy, -6), hasta: hoy };
    }
  });

  protected totales = computed(() => this.servicio.totales(this.filas()));
  protected ticketPromedio = computed(() =>
    this.totales().compras ? this.totales().facturado / this.totales().compras : 0,
  );
  protected etiquetasDias = computed(() =>
    this.filas().map((f) => {
      const [, m, d] = f.fecha.split('-');
      return `${d}/${m}`;
    }),
  );
  protected valoresDias = computed(() => this.filas().map((f) => f.facturado));
  protected entradasDias = computed(() => this.filas().map((f) => Number(f.entradas)));

  // Películas más vistas (por semana o por mes)
  protected periodo = signal<Periodo>('semana');
  protected desplazamiento = signal(0);
  protected peliculas = signal<RankingPelicula[]>([]);
  protected rangoPeliculas = computed(() => {
    const hoy = hoyISO();
    if (this.periodo() === 'semana') {
      const desde = sumarDias(inicioDeSemana(hoy), this.desplazamiento() * 7);
      return { desde, hasta: sumarDias(desde, 6) };
    }
    let base = inicioDeMes(hoy);
    for (let i = 0; i < -this.desplazamiento(); i++) base = inicioDeMes(sumarDias(base, -1));
    for (let i = 0; i < this.desplazamiento(); i++) base = sumarDias(finDeMes(base), 1);
    return { desde: base, hasta: finDeMes(base) };
  });

  // Candy
  protected productos = signal<RankingProducto[]>([]);

  async ngOnInit() {
    await Promise.all([this.cargarFacturacion(), this.cargarPeliculas()]);
  }

  protected async elegirRango(r: Rango) {
    this.rango.set(r);
    await this.cargarFacturacion();
  }

  private async cargarFacturacion() {
    const { desde, hasta } = this.fechas();
    try {
      const [filas, productos] = await Promise.all([
        this.servicio.facturacion(desde, hasta),
        this.servicio.rankingProductos(desde, hasta),
      ]);
      this.filas.set(filas);
      this.productos.set(productos.slice(0, 8));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async cambiarPeriodo(p: Periodo) {
    this.periodo.set(p);
    this.desplazamiento.set(0);
    await this.cargarPeliculas();
  }

  protected async mover(delta: number) {
    this.desplazamiento.update((d) => d + delta);
    await this.cargarPeliculas();
  }

  private async cargarPeliculas() {
    const { desde, hasta } = this.rangoPeliculas();
    try {
      this.peliculas.set(await this.servicio.rankingPeliculas(desde, hasta));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected titulosPeliculas = computed(() => this.peliculas().map((p) => p.titulo));
  protected entradasPeliculas = computed(() => this.peliculas().map((p) => Number(p.entradas)));
  protected nombresProductos = computed(() => this.productos().map((p) => p.nombre));
  protected unidadesProductos = computed(() => this.productos().map((p) => Number(p.unidades)));

  protected async exportar(tipo: 'pdf' | 'xlsx') {
    const { desde, hasta } = this.fechas();
    this.exportando.set(tipo);
    try {
      if (tipo === 'pdf') await this.servicio.exportarPdf(this.filas(), desde, hasta);
      else await this.servicio.exportarExcel(this.filas(), desde, hasta);
    } catch (e) {
      this.avisos.error('No se pudo exportar: ' + mensajeError(e));
    } finally {
      this.exportando.set(null);
    }
  }
}
