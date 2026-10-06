import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AdminDatos } from '../../../services/admin';
import { Avisos } from '../../../services/ui';
import { CodigoFormato, Sala } from '../../../interfaces/catalogo';
import { MapaButacas } from '../../../components/mapa-butacas/mapa-butacas';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { SoloNumeros } from '../../../directives/solo-numeros';
import { ordenarButacas, TOTAL_BUTACAS } from '../../../utils/butacas';
import { mensajeError } from '../../../utils/errores';
import { Confirmacion } from '../../../services/confirmacion';

@Component({
  selector: 'app-admin-salas',
  imports: [ReactiveFormsModule, MapaButacas, ErroresCampo, SoloNumeros],
  templateUrl: './salas.html',
  styleUrl: './salas.css',
})
export class AdminSalas implements OnInit {
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  protected salas = signal<Sala[]>([]);
  protected elegida = signal<Sala | null>(null);
  protected inhabilitadas = signal<string[]>([]);
  protected guardando = signal(false);
  protected guardandoFormato = signal(false);
  protected readonly formatos: CodigoFormato[] = ['2D', '3D', '4D', '5D'];
  protected creando = signal(false);
  /** Número de la nueva sala: el nombre siempre es "Sala N". */
  protected nueva = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.pattern(/^[1-9]d?$/),
      (c: AbstractControl): ValidationErrors | null => this.numeroRepetido(c),
    ],
  });
  protected formatosNueva = signal<CodigoFormato[]>(['2D']);
  protected readonly total = TOTAL_BUTACAS;

  protected hayCambios = computed(() => {
    const s = this.elegida();
    return !!s && ordenarButacas(s.butacas_inhabilitadas).join() !== this.inhabilitadas().join();
  });

  async ngOnInit() {
    await this.cargar();
    this.sugerirNumero();
    if (this.salas().length) this.elegir(this.salas()[0]);
  }

  private async cargar() {
    try {
      this.salas.set(await this.admin.salas());
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected elegir(s: Sala) {
    this.elegida.set(s);
    this.inhabilitadas.set(ordenarButacas(s.butacas_inhabilitadas));
  }

  protected alternarButaca(id: string) {
    this.inhabilitadas.update((l) =>
      l.includes(id) ? l.filter((b) => b !== id) : ordenarButacas([...l, id]),
    );
  }

  protected async guardarDistribucion() {
    const s = this.elegida();
    if (!s) return;
    this.guardando.set(true);
    try {
      await this.admin.actualizarSala(s.id, { butacas_inhabilitadas: this.inhabilitadas() });
      await this.cargar();
      this.elegir(this.salas().find((x) => x.id === s.id)!);
      this.avisos.ok(`Distribución de ${s.nombre} guardada.`);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Formatos especiales de la sala (el 2D lo tienen todas, no se muestra). */
  protected especiales(s: Sala): string[] {
    return (s.formatos ?? ['2D']).filter((f) => f !== '2D');
  }

  /** Equipa o quita un formato. La base no deja quitarlo si hay funciones futuras en ese formato. */
  protected async alternarFormato(s: Sala, f: CodigoFormato) {
    if (f === '2D') return;
    const actuales = s.formatos ?? ['2D'];
    const formatos = actuales.includes(f)
      ? actuales.filter((x) => x !== f)
      : this.formatos.filter((x) => x === f || actuales.includes(x));
    this.guardandoFormato.set(true);
    try {
      await this.admin.actualizarSala(s.id, { formatos });
      await this.cargar();
      const actualizada = this.salas().find((x) => x.id === s.id);
      if (actualizada) this.elegida.set(actualizada);
      this.avisos.ok(`${s.nombre}: ${actuales.includes(f) ? 'se quitó' : 'ahora proyecta'} ${f}.`);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.guardandoFormato.set(false);
    }
  }

  protected async alternarActiva(s: Sala) {
    try {
      await this.admin.actualizarSala(s.id, { activa: !s.activa });
      await this.cargar();
      this.avisos.ok(
        s.activa
          ? `${s.nombre} no recibirá nuevas funciones. Las ya programadas se mantienen.`
          : `${s.nombre} vuelve a estar disponible.`,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  /** Validador propio: no puede haber dos salas con el mismo número. */
  private numeroRepetido(c: AbstractControl): ValidationErrors | null {
    const nombre = `sala ${Number(c.value)}`;
    return c.value && this.salas?.().some((s) => s.nombre.trim().toLowerCase() === nombre)
      ? { repetido: true }
      : null;
  }

  /** Propone el primer número libre (si existen la 1, 2 y 4, sugiere la 3). */
  private sugerirNumero() {
    let n = 1;
    while (this.salas().some((s) => s.nombre.trim().toLowerCase() === `sala ${n}`)) n++;
    this.nueva.reset(n <= 99 ? String(n) : '');
  }

  protected alternarFormatoNueva(f: CodigoFormato) {
    if (f === '2D') return;
    this.formatosNueva.update((l) =>
      l.includes(f)
        ? l.filter((x) => x !== f)
        : this.formatos.filter((x) => x === f || l.includes(x)),
    );
  }

  protected async eliminar(s: Sala) {
    const ok = await this.confirmacion.pedir({
      titulo: `¿Eliminar ${s.nombre}?`,
      mensaje:
        'Solo se puede si no tiene funciones. Si está en remodelación, conviene desactivarla.',
      aceptar: 'Eliminar sala',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.admin.eliminarSala(s.id);
      await this.cargar();
      if (this.elegida()?.id === s.id) this.elegida.set(null);
      if (!this.elegida() && this.salas().length) this.elegir(this.salas()[0]);
      this.avisos.ok(`${s.nombre} eliminada.`);
    } catch {
      this.avisos.error(
        `${s.nombre} tiene funciones programadas o vendidas: no se puede eliminar. Podés desactivarla.`,
      );
    }
  }

  protected async crear() {
    if (this.nueva.invalid) {
      this.nueva.markAsTouched();
      return;
    }
    const nombre = `Sala ${Number(this.nueva.value)}`;
    this.creando.set(true);
    try {
      await this.admin.crearSala(nombre, this.formatosNueva());
      await this.cargar();
      this.elegir(this.salas().find((s) => s.nombre === nombre) ?? this.salas()[0]);
      this.sugerirNumero();
      this.formatosNueva.set(['2D']);
      this.avisos.ok(`${nombre} creada y habilitada.`);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.creando.set(false);
    }
  }
}
