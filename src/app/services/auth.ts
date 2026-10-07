import { computed, inject, Service, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { Supabase } from './supabase';
import { DatosRegistro, Perfil, Rol, DatosPerfil } from '../interfaces/usuario';

@Service()
export class Auth {
  private sup = inject(Supabase);

  readonly usuario = signal<User | null>(null);
  readonly perfil = signal<Perfil | null>(null);
  readonly iniciando = signal(true);

  readonly logueado = computed(() => this.usuario() !== null);
  readonly rol = computed<Rol | null>(() => this.perfil()?.rol ?? null);
  readonly esStaff = computed(() => this.rol() === 'admin' || this.rol() === 'empleado');
  /** Clientes a los que les falta el nombre o la fecha de nacimiento (cuentas viejas). */
  readonly perfilIncompleto = computed(() => {
    const p = this.perfil();
    return (
      !!p &&
      p.rol === 'cliente' &&
      (!p.nombre.trim() ||
        !p.apellido.trim() ||
        !p.fecha_nacimiento ||
        !p.tipo_sangre ||
        !p.color_ojos ||
        p.dias_vacaciones === null)
    );
  });

  private resolverListo!: () => void;
  private readonly listoPromesa = new Promise<void>((r) => (this.resolverListo = r));

  constructor() {
    // Se dispara al abrir la app (sesión guardada), al ingresar, registrarse o salir.
    this.sup.Auth.onAuthStateChange((evento, sesion) => {
      // Supabase recomienda no esperar otras llamadas dentro de este callback.
      setTimeout(async () => {
        const usuario = sesion?.user ?? null;
        this.usuario.set(usuario);
        if (usuario) {
          await this.cargarPerfil();
        } else {
          this.perfil.set(null);
        }
        this.iniciando.set(false);
        this.resolverListo();
      });
    });
  }

  /** Resuelve cuando ya se conoce si hay sesión (lo usan los guards). */
  listo(): Promise<void> {
    return this.listoPromesa;
  }

  async cargarPerfil() {
    const id = this.usuario()?.id;
    if (!id) return;
    const { data } = await this.sup.Supabase.from('perfiles').select('*').eq('id', id).single();
    this.perfil.set(data as Perfil | null);
  }

  async registrar(datos: DatosRegistro) {
    const { data, error } = await this.sup.Auth.signUp({
      email: datos.email,
      password: datos.password,
      options: {
        // El trigger crear_perfil() copia estos datos a la tabla perfiles.
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          fecha_nacimiento: datos.fecha_nacimiento,
          tipo_sangre: datos.tipo_sangre,
          color_ojos: datos.color_ojos,
          dias_vacaciones: datos.dias_vacaciones,
        },
      },
    });
    if (error) throw error;
    return { requiereConfirmacion: !data.session };
  }

  async ingresar(email: string, password: string) {
    const { error } = await this.sup.Auth.signInWithPassword({ email, password });
    if (error) throw error;
    await this.cargarPerfilDespuesDeIngresar();
  }

  async salir() {
    await this.sup.Auth.signOut();
  }

  /**
   * Actualiza nombre y apellido. La fecha de nacimiento solo se guarda si el perfil
   * no tenía (la base la ignora si ya estaba cargada).
   */
  async actualizarDatos(d: DatosPerfil) {
    const { error } = await this.sup.Supabase.rpc('completar_perfil', {
      p_nombre: d.nombre,
      p_apellido: d.apellido,
      p_fecha_nacimiento: d.fecha_nacimiento,
      p_tipo_sangre: d.tipo_sangre,
      p_color_ojos: d.color_ojos,
      p_dias_vacaciones: d.dias_vacaciones,
    });
    if (error) throw error;
    await this.cargarPerfil();
  }

  rutaInicio(): string {
    switch (this.rol()) {
      case 'admin':
        return '/admin';
      case 'empleado':
        return '/staff';
      default:
        return '/';
    }
  }

  private async cargarPerfilDespuesDeIngresar() {
    const { data } = await this.sup.Auth.getUser();
    this.usuario.set(data.user);
    await this.cargarPerfil();
  }
}
