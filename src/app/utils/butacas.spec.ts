import { generarSala, ordenarButacas, tipoButaca, TOTAL_BUTACAS } from './butacas';

describe('Distribución de butacas', () => {
  const sala = generarSala();

  it('tiene 19 filas: A–T sin la K (J y K se unieron en la fila accesible)', () => {
    expect(sala.map((f) => f.letra).join('')).toBe('ABCDEFGHIJLMNOPQRST');
  });

  it('las filas comunes tienen bloques de 4, 20 y 4 butacas', () => {
    expect(sala[0].bloques.map((b) => b.length)).toEqual([4, 20, 4]);
  });

  it('la fila J es accesible con bloques de 2, 10 y 2', () => {
    const j = sala.find((f) => f.letra === 'J')!;
    expect(j.tipo).toBe('accesible');
    expect(j.bloques.map((b) => b.length)).toEqual([2, 10, 2]);
  });

  it('R, S y T son VIP', () => {
    expect(sala.filter((f) => f.tipo === 'vip').map((f) => f.letra)).toEqual(['R', 'S', 'T']);
  });

  it('suma 518 butacas (18 filas × 28 + 14 accesibles)', () => {
    expect(TOTAL_BUTACAS).toBe(518);
  });

  it('reconoce butacas válidas e inválidas', () => {
    expect(tipoButaca('A1')).toBe('estandar');
    expect(tipoButaca('T28')).toBe('vip');
    expect(tipoButaca('J14')).toBe('accesible');
    expect(tipoButaca('J15')).toBeNull();
    expect(tipoButaca('K3')).toBeNull();
    expect(tipoButaca('A29')).toBeNull();
  });

  it('ordena de forma natural', () => {
    expect(ordenarButacas(['B1', 'A10', 'A2'])).toEqual(['A2', 'A10', 'B1']);
  });
});
