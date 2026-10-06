import { Component, effect, ElementRef, input, OnDestroy, viewChild } from '@angular/core';
import type { Chart } from 'chart.js';

/**
 * Gráfico de barras de una sola serie (Chart.js, importado bajo demanda).
 * Un color, sin leyenda (el título dice qué se grafica), barras finas con
 * extremo redondeado y grilla tenue. El tooltip muestra el valor exacto.
 */
@Component({
  selector: 'app-grafico-barras',
  template: `<div class="lienzo" [style.height.px]="alto()">
    <canvas #lienzo [attr.aria-label]="descripcion()" role="img"></canvas>
  </div>`,
  styles: `
    .lienzo {
      position: relative;
      width: 100%;
    }
  `,
})
export class GraficoBarras implements OnDestroy {
  etiquetas = input.required<string[]>();
  valores = input.required<number[]>();
  horizontal = input(false);
  formato = input<'moneda' | 'numero'>('numero');
  alto = input(280);
  descripcion = input('Gráfico de barras');

  private lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico?: Chart;

  constructor() {
    effect(async () => {
      const etiquetas = this.etiquetas();
      const valores = this.valores();
      const horizontal = this.horizontal();
      const formatear = this.formateador();
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      this.grafico?.destroy();

      const ejeValor = {
        beginAtZero: true,
        grid: { color: '#E6E8EC', drawTicks: false },
        border: { display: false },
        ticks: {
          color: '#69727E',
          font: { size: 11 },
          callback: (v: string | number) => formatear(Number(v)),
        },
      };
      const ejeCategoria = {
        grid: { display: false },
        border: { color: '#D6DAE0' },
        ticks: { color: '#343B45', font: { size: 11 }, autoSkip: !horizontal },
      };

      this.grafico = new Chart(this.lienzo().nativeElement, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [
            {
              data: valores,
              backgroundColor: '#C8721A',
              hoverBackgroundColor: '#A85E12',
              borderRadius: 4,
              borderSkipped: 'start',
              maxBarThickness: 24,
            },
          ],
        },
        options: {
          indexAxis: horizontal ? 'y' : 'x',
          maintainAspectRatio: false,
          animation: { duration: 400 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#14171C',
              padding: 10,
              displayColors: false,
              callbacks: { label: (ctx) => formatear(Number(ctx.raw)) },
            },
          },
          scales: horizontal ? { x: ejeValor, y: ejeCategoria } : { x: ejeCategoria, y: ejeValor },
        },
      });
    });
  }

  private formateador(): (n: number) => string {
    const moneda = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    });
    const numero = new Intl.NumberFormat('es-AR');
    return this.formato() === 'moneda' ? (n) => moneda.format(n) : (n) => numero.format(n);
  }

  ngOnDestroy() {
    this.grafico?.destroy();
  }
}
