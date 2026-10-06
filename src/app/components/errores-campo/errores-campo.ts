import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const MENSAJES: Record<string, (e: any) => string> = {
  required: () => 'Este campo es obligatorio.',
  email: () => 'Ingresá un email válido.',
  minlength: (e) => `Mínimo ${e.requiredLength} caracteres.`,
  maxlength: (e) => `Máximo ${e.requiredLength} caracteres.`,
  min: (e) => `El mínimo es ${e.min}.`,
  max: (e) => `El máximo es ${e.max}.`,
  pattern: () => 'El formato no es válido.',
  fechaInvalida: () => 'La fecha no existe.',
  fechaFutura: () => 'La fecha no puede ser futura.',
  edadMaxima: () => 'Revisá el año de nacimiento.',
  soloLetras: () => 'Usá solo letras.',
  passwordsDistintas: () => 'Las contraseñas no coinciden.',
  passwordDebil: () => 'Combiná letras y números.',
  tarjetaInvalida: () => 'El número de tarjeta no es válido.',
  vencida: () => 'La tarjeta está vencida.',
  fechaPasada: () => 'La fecha no puede ser anterior a hoy.',
  entero: () => 'Ingresá un número entero.',
  repetido: () => 'Ya existe un registro con ese nombre.',
};

/**
 * Muestra el primer error de un control con un mensaje claro (patrón de la clase
 * de formularios: un componente de error reutilizable que recibe el control por input()).
 * Usa estrategia Eager porque el estado de un FormControl no es un signal.
 */
@Component({
  selector: 'app-errores-campo',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `@if (mensaje; as m) {
    <span class="campo__error" role="alert">{{ m }}</span>
  }`,
})
export class ErroresCampo {
  control = input.required<AbstractControl | null>();
  /** Mensajes personalizados por clave de error. */
  mensajes = input<Record<string, string>>({});

  protected get mensaje(): string | null {
    const c = this.control();
    if (!c || !c.errors || !c.touched) return null;
    const clave = Object.keys(c.errors)[0];
    return this.mensajes()[clave] ?? MENSAJES[clave]?.(c.errors[clave]) ?? 'Valor inválido.';
  }
}
