import { Pipe, PipeTransform } from '@angular/core';

const FORMATO = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 11500 → "$ 11.500" (pesos argentinos, sin decimales si no hacen falta). */
@Pipe({ name: 'precio' })
export class PrecioPipe implements PipeTransform {
  transform(valor: number | string | null | undefined, gratisSiCero = false): string {
    const n = Number(valor ?? 0);
    if (gratisSiCero && n === 0) return 'Sin cargo';
    return FORMATO.format(n);
  }
}
