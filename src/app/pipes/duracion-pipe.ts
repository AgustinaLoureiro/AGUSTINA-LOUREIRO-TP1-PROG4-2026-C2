import { Pipe, PipeTransform } from '@angular/core';

/** 125 → "2 h 05 min" */
@Pipe({ name: 'duracion' })
export class DuracionPipe implements PipeTransform {
  transform(minutos: number | null | undefined): string {
    if (!minutos) return '';
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (!h) return `${m} min`;
    return `${h} h ${String(m).padStart(2, '0')} min`;
  }
}
