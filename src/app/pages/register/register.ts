import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Catalogo } from '../../services/catalogo';
import { Avisos } from '../../services/ui';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { CampoFecha, fechaValida } from '../../components/campo-fecha/campo-fecha';
import {
  DatosPersonales,
  grupoDatosPersonales,
} from '../../components/datos-personales/datos-personales';
import { mensajeError } from '../../utils/errores';
import {
  edadMaxima,
  fechaNoFutura,
  passwordFuerte,
  passwordsIguales,
  soloLetras,
} from '../../utils/validadores';

/**
 * Registro con todos los datos que pidió el cliente: email, nombre, apellido,
 * fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año.
 * La fecha de nacimiento además se usa para las restricciones de edad y los
 * cupones para mayores de 50.
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ErroresCampo, CampoFecha, DatosPersonales],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private catalogo = inject(Catalogo);
  private router = inject(Router);
  private avisos = inject(Avisos);

  protected enviando = signal(false);
  protected error = signal<string | null>(null);
  protected requiereConfirmacion = signal(false);
  protected descuento = signal<number | null>(null);
  protected verPassword = signal(false);

  protected form = this.fb.nonNullable.group({
    nombre: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(40), soloLetras],
    ],
    apellido: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(40), soloLetras],
    ],
    email: ['', [Validators.required, Validators.email]],
    fechaNacimiento: this.fb.control<string | null>(null, [
      Validators.required,
      fechaValida,
      fechaNoFutura,
      edadMaxima(110),
    ]),
    personales: grupoDatosPersonales(),
    claves: this.fb.nonNullable.group(
      {
        password: ['', [Validators.required, Validators.minLength(8), passwordFuerte]],
        repetir: ['', [Validators.required]],
      },
      { validators: passwordsIguales },
    ),
  });

  async ngOnInit() {
    try {
      this.descuento.set((await this.catalogo.configuracion()).descuento_primera_compra);
    } catch {
      this.descuento.set(null);
    }
  }

  async registrar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    try {
      const { requiereConfirmacion } = await this.auth.registrar({
        nombre: v.nombre.trim(),
        apellido: v.apellido.trim(),
        email: v.email.trim().toLowerCase(),
        fecha_nacimiento: v.fechaNacimiento!,
        tipo_sangre: v.personales.tipoSangre!,
        color_ojos: v.personales.colorOjos!,
        dias_vacaciones: Number(v.personales.diasVacaciones),
        password: v.claves.password,
      });
      if (requiereConfirmacion) {
        this.requiereConfirmacion.set(true);
      } else {
        this.avisos.ok(`¡Te damos la bienvenida, ${v.nombre}! Tu primera compra tiene descuento.`);
        this.router.navigateByUrl('/cartelera');
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
