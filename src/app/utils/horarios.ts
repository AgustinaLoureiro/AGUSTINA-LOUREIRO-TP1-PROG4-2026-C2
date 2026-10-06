// Generación automática de horarios de una franja.
// A partir del primer horario, cada función siguiente arranca cuando termina la
// anterior más la limpieza, redondeado hacia arriba a múltiplos de 5 minutos.
// Los horarios entre 00:00 y 05:59 son "trasnoche" (pertenecen a la noche del día).

const CORTE_TRASNOCHE = 6 * 60; // 06:00
const MINUTOS_DIA = 24 * 60;

/** "00:30" → 1470 (minutos desde las 00:00 del día, contando la trasnoche como +24 h). */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m;
  return total < CORTE_TRASNOCHE ? total + MINUTOS_DIA : total;
}

/** 1470 → "00:30" */
export function aHora(minutos: number): string {
  const m = ((minutos % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface OpcionesFranja {
  inicio: string;
  duracion: number;
  limpieza: number;
  /** 'cantidad': hasta N funciones seguidas · 'cierre': todas las que entren hasta el último inicio. */
  modo: 'cantidad' | 'cierre';
  cantidad: number;
  ultimoInicio: string;
}

export interface HorarioGenerado {
  inicio: string;
  fin: string;
}

export function generarHorarios(o: OpcionesFranja): HorarioGenerado[] {
  if (!o.inicio || !o.duracion) return [];
  const paso = Math.ceil((o.duracion + o.limpieza) / 5) * 5;
  const limite = aMinutos(o.ultimoInicio);
  const resultado: HorarioGenerado[] = [];

  // En los dos modos, ninguna función empieza después del último inicio permitido
  for (let t = aMinutos(o.inicio); t <= limite; t += paso) {
    if (o.modo === 'cantidad' && resultado.length >= o.cantidad) break;
    resultado.push({ inicio: aHora(t), fin: aHora(t + o.duracion) });
  }
  return resultado;
}
