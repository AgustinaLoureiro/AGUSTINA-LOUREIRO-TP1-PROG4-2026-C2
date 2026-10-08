import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { AdminDatos } from '../../../services/admin';
import { Auth } from '../../../services/auth';
import { Avisos } from '../../../services/ui';
import { Perfil } from '../../../interfaces/usuario';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { PrecioPipe } from '../../../pipes/precio-pipe';
import { mensajeError } from '../../../utils/errores';
import { passwordFuerte, soloLetras } from '../../../utils/validadores';
import { Confirmacion } from '../../../services/confirmacion';

type Grupo = 'personal' | 'clientes';
type Destino = 'clientes' | 'yo' | 'email';

@Component({
  selector: 'app-admin-usuarios',
  imports: [DatePipe, ReactiveFormsModule, ErroresCampo, PrecioPipe],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
})
export class AdminUsuarios implements OnInit {
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);
  private fb = inject(FormBuilder);
  protected auth = inject(Auth);

  protected grupo = signal<Grupo>('personal');
  protected usuarios = signal<Perfil[]>([]);
  protected cargando = signal(true);
  protected modalAlta = signal(false);
  protected guardando = signal(false);
  protected busqueda = new FormControl('', { nonNullable: true });

  // ---------- Enviar notificación ----------
  protected modalNotificar = signal(false);
  protected enviando = signal(false);
  protected readonly enlaces: [string, string][] = [
    ['/', 'Inicio'],
    ['/cartelera', 'Cartelera'],
    ['/proximamente', 'Próximamente'],
    ['/perfil', 'Mis entradas'],
  ];
  protected notificacion = this.fb.nonNullable.group({
    destino: ['clientes' as Destino],
    email: [''],
    titulo: [
      '🎬 ¡Nuevos estrenos en CineCorn!',
      [Validators.required, Validators.minLength(3), Validators.maxLength(60)],
    ],
    cuerpo: [
      'Ya están a la venta las entradas de los estrenos de esta semana. ¡Te esperamos!',
      [Validators.required, Validators.minLength(3), Validators.maxLength(160)],
    ],
    url: ['/cartelera'],
  });

  protected alta = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), soloLetras]],
    apellido: ['', [Validators.required, Validators.minLength(2), soloLetras]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), passwordFuerte]],
  });

  constructor() {
    this.busqueda.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.cargar());
  }

  async ngOnInit() {
    await this.cargar();
  }

  protected cambiarGrupo(g: Grupo) {
    this.grupo.set(g);
    this.busqueda.setValue('', { emitEvent: false });
    this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.usuarios.set(await this.admin.usuarios(this.busqueda.value, this.grupo()));
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected abrirAlta() {
    this.alta.reset();
    this.modalAlta.set(true);
  }

  protected async guardarAlta() {
    if (this.alta.invalid) {
      this.alta.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    const v = this.alta.getRawValue();
    try {
      const { cuentaNueva } = await this.admin.agregarEmpleado({
        ...v,
        email: v.email.trim().toLowerCase(),
        nombre: v.nombre.trim(),
        apellido: v.apellido.trim(),
      });
      this.avisos.ok(
        cuentaNueva
          ? `Listo: ${v.nombre} ya puede ingresar con su email y la contraseña inicial.`
          : `${v.email} ya tenía cuenta: ahora tiene acceso de empleado.`,
      );
      this.modalAlta.set(false);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected abrirNotificar(email = '') {
    this.notificacion.patchValue({ destino: email ? 'email' : 'clientes', email });
    this.modalNotificar.set(true);
  }

  /** El aviso llega al instante a la campanita (Realtime) y como push a los dispositivos suscriptos. */
  protected async enviarNotificacion() {
    const v = this.notificacion.getRawValue();
    const email = v.email.trim();
    if (this.notificacion.invalid || (v.destino === 'email' && !email.includes('@'))) {
      this.notificacion.markAllAsTouched();
      if (v.destino === 'email' && !email.includes('@'))
        this.avisos.error('Ingresá el email del usuario.');
      return;
    }
    const destino =
      v.destino === 'yo'
        ? (this.auth.perfil()?.email ?? '')
        : v.destino === 'email'
          ? email
          : 'clientes';
    this.enviando.set(true);
    try {
      const cantidad = await this.admin.enviarNotificacion(destino, v.titulo, v.cuerpo, v.url);
      this.avisos.ok(
        cantidad === 1 ? 'Notificación enviada.' : `Notificación enviada a ${cantidad} usuarios.`,
      );
      this.modalNotificar.set(false);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async quitarAcceso(u: Perfil) {
    const ok = await this.confirmacion.pedir({
      titulo: `¿Quitarle el acceso a ${u.nombre || u.email}?`,
      mensaje: 'Su cuenta queda como cliente y ya no puede validar entradas.',
      aceptar: 'Quitar acceso',
      peligro: true,
    });
    if (!ok) return;
    await this.cambiarRol(u, 'cliente', 'Acceso quitado.');
  }

  protected async alternarAdmin(u: Perfil) {
    const nuevo = u.rol === 'admin' ? 'empleado' : 'admin';
    const texto = nuevo === 'admin' ? 'darle permisos de administrador a' : 'pasar a empleado a';
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Querés ${texto} ${u.nombre || u.email}?`,
        mensaje:
          nuevo === 'admin'
            ? 'Va a tener acceso a todo el panel de administración.'
            : 'Solo va a poder validar entradas y entregas del candy.',
        aceptar: 'Confirmar',
        peligro: false,
      }))
    )
      return;
    await this.cambiarRol(u, nuevo, 'Permisos actualizados.');
  }

  private async cambiarRol(u: Perfil, rol: Perfil['rol'], mensaje: string) {
    try {
      await this.admin.asignarRol(u.email, rol);
      this.avisos.ok(mensaje);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }
}
