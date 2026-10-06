import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Catalogo } from '../../services/catalogo';
import { Avisos } from '../../services/ui';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { CampoFecha, fechaValida } from '../../components/campo-fecha/campo-fecha';
import { mensajeError } from '../../utils/errores';
import {
  edadMaxima,
  fechaNoFutura,
  passwordFuerte,
  passwordsIguales,
  soloLetras,
} from '../../utils/validadores';

/**
 * Registro. Solo se piden los datos que el cine necesita:
 * - email y contraseña para la cuenta,
 * - nombre y apellido para la entrada,
 * - fecha de nacimiento para las restricciones de edad y los cupones para mayores de 50.
 * (Tipo de sangre, color de ojos o días de vacaciones no aportan nada al negocio
 * y serían datos personales innecesarios: se descartaron.)
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, ErroresCampo, CampoFecha],
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
