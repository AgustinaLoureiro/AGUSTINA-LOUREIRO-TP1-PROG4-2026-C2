import { aHora, aMinutos, generarHorarios } from './horarios';

describe('Generación automática de horarios', () => {
  const base = { duracion: 153, limpieza: 30, ultimoInicio: '23:59' };

  it('trata la trasnoche como continuación del día', () => {
    expect(aMinutos('00:30')).toBeGreaterThan(aMinutos('23:00'));
    expect(aHora(aMinutos('00:30'))).toBe('00:30');
  });

  it('encadena funciones: duración + limpieza, redondeado a 5 minutos', () => {
    // 153 + 30 = 183 → 185 minutos entre inicios
    const h = generarHorarios({ ...base, inicio: '14:00', modo: 'cantidad', cantidad: 3 });
    expect(h.map((x) => x.inicio)).toEqual(['14:00', '17:05', '20:10']);
    expect(h[0].fin).toBe('16:33');
  });

  it('en modo cierre agrega todas las que entran hasta el último inicio', () => {
    const h = generarHorarios({ ...base, inicio: '13:00', modo: 'cierre', cantidad: 0 });
    expect(h.map((x) => x.inicio)).toEqual(['13:00', '16:05', '19:10', '22:15']);
  });

  it('no agrega funciones que empezarían después de las 23:59', () => {
    const h = generarHorarios({
      ...base,
      duracion: 95,
      inicio: '14:00',
      modo: 'cierre',
      cantidad: 0,
    });
    // la siguiente sería a las 00:25: queda afuera
    expect(h.at(-1)!.inicio).toBe('22:20');
  });

  it('en cantidad fija también corta en el último inicio aunque se pidan más', () => {
    const h = generarHorarios({ ...base, inicio: '20:00', modo: 'cantidad', cantidad: 10 });
    expect(h.map((x) => x.inicio)).toEqual(['20:00', '23:05']);
  });
});
