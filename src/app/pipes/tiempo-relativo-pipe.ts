import { Pipe, PipeTransform } from '@angular/core';

const RELATIVO = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** Fecha → "hace 5 minutos", "en 2 días", "ayer". */
@Pipe({ name: 'tiempoRelativo' })
export class TiempoRelativoPipe implements PipeTransform {
  transform(fecha: string | Date | null | undefined): string {
    if (!fecha) return '';
    const segundos = (new Date(fecha).getTime() - Date.now()) / 1000;
    for (const [unidad, enSegundos] of UNIDADES) {
      if (Math.abs(segundos) >= enSegundos) {
        return RELATIVO.format(Math.round(segundos / enSegundos), unidad);
      }
    }
    return 'recién';
  }
}
