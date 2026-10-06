import { Pipe, PipeTransform } from '@angular/core';

/** "CC1A2B3C4D5E" → "CC-1A2B3-C4D5E" (más fácil de leer y dictar). */
export function formatearCodigo(codigo: string): string {
  const limpio = codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (limpio.length !== 12) return limpio;
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 7)}-${limpio.slice(7)}`;
}

@Pipe({ name: 'codigo' })
export class CodigoPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? formatearCodigo(valor) : '';
  }
}
