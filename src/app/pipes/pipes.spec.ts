import { CodigoPipe } from './codigo-pipe';
import { DuracionPipe } from './duracion-pipe';
import { IdiomaPipe } from './idioma-pipe';
import { PrecioPipe } from './precio-pipe';

describe('Pipes propios', () => {
  it('duracion: minutos a horas', () => {
    const p = new DuracionPipe();
    expect(p.transform(125)).toBe('2 h 05 min');
    expect(p.transform(45)).toBe('45 min');
  });

  it('codigo: agrupa el código de la entrada', () => {
    expect(new CodigoPipe().transform('cc1a2b3c4d5e')).toBe('CC-1A2B3-C4D5E');
  });

  it('idioma: nombres legibles', () => {
    expect(new IdiomaPipe().transform('SUBT')).toBe('Subtitulada');
    expect(new IdiomaPipe().transform('CAST', true)).toBe('Cast.');
  });

  it('precio: pesos argentinos y "sin cargo"', () => {
    const p = new PrecioPipe();
    expect(p.transform(11500).replace(/\s/g, ' ')).toContain('11.500');
    expect(p.transform(0, true)).toBe('Sin cargo');
  });
});
