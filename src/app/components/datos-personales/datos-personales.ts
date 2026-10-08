import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErroresCampo } from '../errores-campo/errores-campo';
import { SoloNumeros } from '../../directives/solo-numeros';
import { entero } from '../../utils/validadores';
import { COLORES_OJOS, TIPOS_SANGRE } from '../../interfaces/usuario';

/** Grupo de controles para los datos personales que pide el registro. */
export function grupoDatosPersonales() {
  return new FormGroup({
    tipoSangre: new FormControl<string | null>(null, Validators.required),
    colorOjos: new FormControl<string | null>(null, Validators.required),
    diasVacaciones: new FormControl<number | null>(null, [
      Validators.required,
      entero,
      Validators.min(0),
      // Por ley (LCT, art. 150) son entre 14 y 35 días según la antigüedad
      Validators.max(35),
    ]),
  });
}

export type GrupoDatosPersonales = ReturnType<typeof grupoDatosPersonales>;

/**
 * Tipo de sangre, color de ojos y días de vacaciones: datos que el cliente pidió
 * recopilar al registrarse. Se usa en el registro y en "Mis datos" del perfil.
 * Opciones con botones (sin listas desplegables largas, como pidió el cliente).
 * Usa estrategia Eager porque el estado de un FormGroup no es un signal.
 */
@Component({
  selector: 'app-datos-personales',
  imports: [ReactiveFormsModule, ErroresCampo, SoloNumeros],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './datos-personales.html',
  styleUrl: './datos-personales.css',
})
export class DatosPersonales {
  grupo = input.required<GrupoDatosPersonales>();

  protected readonly tiposSangre = TIPOS_SANGRE;
  protected readonly coloresOjos = COLORES_OJOS;

  protected elegir(control: FormControl<string | null>, valor: string) {
    control.setValue(valor);
    control.markAsTouched();
    control.markAsDirty();
  }
}
