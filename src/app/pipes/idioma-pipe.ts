import { Pipe, PipeTransform } from '@angular/core';
import { Idioma } from '../interfaces/catalogo';

/** 'CAST' → 'Castellano', 'SUBT' → 'Subtitulada' */
@Pipe({ name: 'idioma' })
export class IdiomaPipe implements PipeTransform {
  transform(valor: Idioma | null | undefined, corto = false): string {
    if (valor === 'CAST') return corto ? 'Cast.' : 'Castellano';
    if (valor === 'SUBT') return corto ? 'Subt.' : 'Subtitulada';
    return '';
  }
}
