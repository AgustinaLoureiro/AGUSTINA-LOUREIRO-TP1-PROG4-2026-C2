// Utilidades de fecha. Las fechas "de calendario" se manejan como 'YYYY-MM-DD'
// en hora local (el cine opera en Argentina), sin pasar por UTC.

export function aISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function desdeISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoyISO(): string {
  return aISO(new Date());
}

export function sumarDias(iso: string, dias: number): string {
  const f = desdeISO(iso);
  f.setDate(f.getDate() + dias);
  return aISO(f);
}

export function diferenciaDias(desde: string, hasta: string): number {
  return Math.round((desdeISO(hasta).getTime() - desdeISO(desde).getTime()) / 86_400_000);
}

/** Fecha local (YYYY-MM-DD) de un timestamp ISO. */
export function diaDe(timestamp: string): string {
  return aISO(new Date(timestamp));
}

export function edad(nacimientoISO: string, alISO = hoyISO()): number {
  const n = desdeISO(nacimientoISO);
  const a = desdeISO(alISO);
  let e = a.getFullYear() - n.getFullYear();
  if (a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate()))
    e--;
  return e;
}

export function esFechaValida(y: number, m: number, d: number): boolean {
  const f = new Date(y, m - 1, d);
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d;
}

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export interface DiaTira {
  iso: string;
  etiqueta: string;
  diaSemana: string;
  numero: number;
  mes: string;
}

/** Días consecutivos para mostrar como tira de chips (sin calendario desplegable). */
export function tiraDeDias(desde: string, cantidad: number): DiaTira[] {
  const hoy = hoyISO();
  return Array.from({ length: cantidad }, (_, i) => {
    const iso = sumarDias(desde, i);
    const f = desdeISO(iso);
    const etiqueta =
      iso === hoy ? 'Hoy' : iso === sumarDias(hoy, 1) ? 'Mañana' : DIAS_CORTOS[f.getDay()];
    return {
      iso,
      etiqueta,
      diaSemana: DIAS_CORTOS[f.getDay()],
      numero: f.getDate(),
      mes: MESES_CORTOS[f.getMonth()],
    };
  });
}

export function inicioDeSemana(iso: string): string {
  const f = desdeISO(iso);
  const dow = (f.getDay() + 6) % 7; // lunes = 0
  return sumarDias(iso, -dow);
}

export function inicioDeMes(iso: string): string {
  return iso.slice(0, 8) + '01';
}

export function finDeMes(iso: string): string {
  const f = desdeISO(inicioDeMes(iso));
  f.setMonth(f.getMonth() + 1);
  f.setDate(0);
  return aISO(f);
}

/**
 * Próximos jueves (día de estreno en Argentina) como atajos: "Hoy (jue)", "Jue 9/10"…
 * Si hoy es jueves, se incluye hoy.
 */
export function proximosJueves(cantidad = 4): { texto: string; dias: number }[] {
  const hoy = desdeISO(hoyISO());
  const hastaJueves = (4 - hoy.getDay() + 7) % 7;
  return Array.from({ length: cantidad }, (_, i) => {
    const dias = hastaJueves + i * 7;
    const f = desdeISO(sumarDias(hoyISO(), dias));
    return { texto: dias === 0 ? 'Hoy (jue)' : `Jue ${f.getDate()}/${f.getMonth() + 1}`, dias };
  });
}
