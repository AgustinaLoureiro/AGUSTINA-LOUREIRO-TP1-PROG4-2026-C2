import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { edad, hoyISO } from './fechas';

// Cómo funcionan (clase de formularios): reciben el control y devuelven
// un objeto con el error si falla, o null si está todo bien.

export const soloLetras: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = (control.value ?? '') as string;
  return !v || /^[\p{L}' -]+$/u.test(v.trim()) ? null : { soloLetras: true };
};

export const fechaNoFutura: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = control.value as string | null;
  return v && v > hoyISO() ? { fechaFutura: true } : null;
};

export const fechaNoPasada: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = control.value as string | null;
  return v && v < hoyISO() ? { fechaPasada: true } : null;
};

export function edadMaxima(anios: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value as string | null;
    return v && edad(v) > anios ? { edadMaxima: { max: anios } } : null;
  };
}

/** Al menos una letra y un número. */
export const passwordFuerte: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = (control.value ?? '') as string;
  return !v || (/[A-Za-z]/.test(v) && /\d/.test(v)) ? null : { passwordDebil: true };
};

/** Validador de grupo: password y repetición iguales. */
export const passwordsIguales: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const pass = grupo.get('password')?.value;
  const repetir = grupo.get('repetir');
  if (!repetir) return null;
  const error =
    pass && repetir.value && pass !== repetir.value ? { passwordsDistintas: true } : null;
  repetir.setErrors(error ?? (repetir.hasError('required') ? { required: true } : null));
  return error;
};

/** Número de tarjeta: 13 a 19 dígitos y dígito verificador (algoritmo de Luhn). */
export const tarjetaValida: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const digitos = ((control.value ?? '') as string).replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length < 13 || digitos.length > 19) return { tarjetaInvalida: true };
  let suma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0 ? null : { tarjetaInvalida: true };
};

/** Vencimiento "MM/AA" no anterior al mes actual. */
export const vencimientoVigente: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const v = (control.value ?? '') as string;
  if (!v) return null;
  const m = /^(\d{2})\/(\d{2})$/.exec(v);
  if (!m || +m[1] < 1 || +m[1] > 12) return { pattern: true };
  const hoy = new Date();
  const anio = 2000 + Number(m[2]);
  const mes = Number(m[1]);
  return anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1)
    ? null
    : { vencida: true };
};

export function marcaTarjeta(numero: string): string {
  const n = numero.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  if (/^(50|6)/.test(n)) return 'Maestro / Cabal';
  return '';
}

/** Obligatorio que además no acepta un texto con solo espacios. */
export const textoRequerido: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = control.value;
  return typeof v === 'string' && v.trim().length === 0 ? { required: true } : null;
};

/** Número entero (sin decimales). */
export const entero: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  return Number.isInteger(Number(v)) ? null : { entero: true };
};

/**
 * Extrae el ID de un video de YouTube a partir del link (watch?v=, youtu.be/,
 * /embed/, /shorts/) o del ID solo. Devuelve null si no se reconoce.
 */
export function idYoutube(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim();
  if (!t) return null;
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/** Campo opcional: si tiene algo, tiene que ser un link (o ID) de YouTube válido. */
export const trailerYoutube: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = (control.value ?? '') as string;
  return !v.trim() || idYoutube(v) ? null : { trailer: true };
};
