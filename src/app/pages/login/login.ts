import { Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { mensajeError } from '../../utils/errores';
import { CUENTAS_PRUEBA } from '../../utils/cuentas-prueba';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ErroresCampo],
  templateUrl: './login.html',
  styleUrls: ['../register/register.css', './login.css'],
})
export class Login {
  /** Ruta a la que volver después de ingresar (?volver=…). */
  volver = input<string>('');

  private auth = inject(Auth);
  private router = inject(Router);

  protected enviando = signal(false);
  protected error = signal<string | null>(null);
  protected verPassword = signal(false);
  protected readonly cuentasPrueba = CUENTAS_PRUEBA;

  protected formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** Completa el formulario con una cuenta de prueba e ingresa. */
  protected ingresarComo(email: string, password: string) {
    this.formulario.setValue({ email, password });
    this.ingresar();
  }

  async ingresar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.formulario.getRawValue();
      await this.auth.ingresar(email.trim(), password);
      const destino = this.volver()?.startsWith('/') ? this.volver() : this.auth.rutaInicio();
      this.router.navigateByUrl(destino);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
