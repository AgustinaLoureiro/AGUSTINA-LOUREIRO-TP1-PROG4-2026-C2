// Distribución fija de todas las salas (definida por el cliente):
// - 20 filas originales (A–T) con bloques de 4 | 20 | 4 butacas.
// - Las filas J y K se reemplazaron por UNA fila accesible de 2 | 10 | 2 (se rotula "J").
// - Las filas R, S y T son VIP.
// La misma regla está replicada en la base (función tipo_butaca) para validar las compras.

export type TipoButaca = 'estandar' | 'vip' | 'accesible';

export interface Butaca {
  id: string;
  fila: string;
  numero: number;
  tipo: TipoButaca;
}

export interface FilaSala {
  letra: string;
  tipo: TipoButaca;
  bloques: Butaca[][];
}

export const FILAS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
];
export const FILAS_VIP = ['R', 'S', 'T'];
export const FILA_ACCESIBLE = 'J';

const BLOQUES_NORMALES = [4, 20, 4];
const BLOQUES_ACCESIBLES = [2, 10, 2];

export function tipoDeFila(letra: string): TipoButaca {
  if (letra === FILA_ACCESIBLE) return 'accesible';
  return FILAS_VIP.includes(letra) ? 'vip' : 'estandar';
}

export function generarSala(): FilaSala[] {
  return FILAS.map((letra) => {
    const tipo = tipoDeFila(letra);
    const tamanios = tipo === 'accesible' ? BLOQUES_ACCESIBLES : BLOQUES_NORMALES;
    let numero = 0;
    const bloques = tamanios.map((cant) =>
      Array.from({ length: cant }, () => {
        numero++;
        return { id: `${letra}${numero}`, fila: letra, numero, tipo };
      }),
    );
    return { letra, tipo, bloques };
  });
}

export function tipoButaca(id: string): TipoButaca | null {
  const m = /^([A-Z])(\d{1,2})$/.exec(id);
  if (!m || !FILAS.includes(m[1])) return null;
  const tipo = tipoDeFila(m[1]);
  const max = tipo === 'accesible' ? 14 : 28;
  const n = Number(m[2]);
  return n >= 1 && n <= max ? tipo : null;
}

/** Ordena "A2, A10, B1" de forma natural (fila y luego número). */
export function ordenarButacas(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const fa = FILAS.indexOf(a[0]);
    const fb = FILAS.indexOf(b[0]);
    return fa !== fb ? fa - fb : Number(a.slice(1)) - Number(b.slice(1));
  });
}

export const TOTAL_BUTACAS = generarSala().reduce(
  (total, fila) => total + fila.bloques.flat().length,
  0,
);
