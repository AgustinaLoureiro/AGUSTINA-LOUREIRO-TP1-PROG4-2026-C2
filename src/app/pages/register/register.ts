import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Supabase } from '../../services/supabase';

// Validador personalizado
function fechaNoFutura(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const fecha = new Date(control.value);
  return fecha > new Date() ? { fechaFutura: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private fb = inject(FormBuilder);
  private supabase = inject(Supabase);
  private router = inject(Router);

  cargando = false;
  errorMsg = '';

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    fechaNacimiento: ['', [Validators.required, fechaNoFutura]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.errorMsg = '';

    const { nombre, apellido, email, fechaNacimiento, password } = this.form.getRawValue();

    // Crea el usuario
    const { data, error } = await this.supabase.Supabase.auth.signUp({
      email: email!,
      password: password!,
    });

    if (error || !data.user) {
      this.errorMsg = error?.message ?? 'No se pudo crear el usuario.';
      this.cargando = false;
      return;
    }

    // Inserta el perfil
    const { error: errorPerfil } = await this.supabase.Supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento,
      });

    this.cargando = false;

    if (errorPerfil) {
      this.errorMsg = 'Usuario creado, pero falló guardar el perfil: ' + errorPerfil.message;
      return;
    }

    this.router.navigate(['/']);
  }
}