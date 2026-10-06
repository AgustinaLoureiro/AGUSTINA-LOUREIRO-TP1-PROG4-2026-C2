import { FormControl, FormGroup } from '@angular/forms';
import {
  edadMaxima,
  fechaNoFutura,
  passwordFuerte,
  passwordsIguales,
  soloLetras,
  tarjetaValida,
  vencimientoVigente,
} from './validadores';
import { fechaValida } from '../components/campo-fecha/campo-fecha';
import { sumarDias, hoyISO } from './fechas';

const control = (valor: unknown) => new FormControl(valor);

describe('Validadores propios', () => {
  it('soloLetras acepta tildes y espacios', () => {
    expect(soloLetras(control('María José'))).toBeNull();
    expect(soloLetras(control('Ana123'))).toEqual({ soloLetras: true });
  });

  it('fechaValida descarta fechas que no existen', () => {
    expect(fechaValida(control('2024-02-29'))).toBeNull();
    expect(fechaValida(control('2025-02-29'))).toEqual({ fechaInvalida: true });
  });

  it('fechaNoFutura rechaza mañana', () => {
    expect(fechaNoFutura(control(sumarDias(hoyISO(), 1)))).toEqual({ fechaFutura: true });
    expect(fechaNoFutura(control(hoyISO()))).toBeNull();
  });

  it('edadMaxima detecta años imposibles', () => {
    expect(edadMaxima(110)(control('1890-01-01'))).not.toBeNull();
  });

  it('passwordFuerte pide letras y números', () => {
    expect(passwordFuerte(control('solamente'))).toEqual({ passwordDebil: true });
    expect(passwordFuerte(control('cine2026'))).toBeNull();
  });

  it('passwordsIguales compara las dos claves', () => {
    const g = new FormGroup({ password: control('cine2026'), repetir: control('otra2026') });
    expect(passwordsIguales(g)).toEqual({ passwordsDistintas: true });
    g.controls.repetir.setValue('cine2026');
    expect(passwordsIguales(g)).toBeNull();
  });

  it('tarjetaValida aplica el algoritmo de Luhn', () => {
    expect(tarjetaValida(control('4242 4242 4242 4242'))).toBeNull();
    expect(tarjetaValida(control('4242 4242 4242 4241'))).toEqual({ tarjetaInvalida: true });
  });

  it('vencimientoVigente rechaza tarjetas vencidas', () => {
    expect(vencimientoVigente(control('01/20'))).toEqual({ vencida: true });
    expect(vencimientoVigente(control('12/40'))).toBeNull();
    expect(vencimientoVigente(control('13/40'))).toEqual({ pattern: true });
  });
});
