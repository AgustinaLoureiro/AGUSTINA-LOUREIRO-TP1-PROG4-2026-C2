import { Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { mensajeError } from '../../utils/errores';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, ErroresCampo],
  templateUrl: './login.html',
  styleUrl: '../register/register.css',
})
export class Login {
  /** Ruta a la que volver después de ingresar (?volver=…). */
  volver = input<string>('');

  private auth = inject(Auth);
  private router = inject(Router);

  protected enviando = signal(false);
  protected error = signal<string | null>(null);
  protected verPassword = signal(false);

  protected formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

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
