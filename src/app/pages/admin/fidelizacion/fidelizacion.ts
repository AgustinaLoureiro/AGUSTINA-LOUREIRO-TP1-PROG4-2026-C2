import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDatos } from '../../../services/admin';
import { Avisos } from '../../../services/ui';
import { Cupon, Producto, Recompensa } from '../../../interfaces/candy';
import { Formato } from '../../../interfaces/catalogo';
import { CampoFecha, fechaValida } from '../../../components/campo-fecha/campo-fecha';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { PrecioPipe } from '../../../pipes/precio-pipe';
import { mensajeError } from '../../../utils/errores';
import { entero, textoRequerido } from '../../../utils/validadores';
import { Confirmacion } from '../../../services/confirmacion';
import { SoloNumeros } from '../../../directives/solo-numeros';

@Component({
  selector: 'app-admin-fidelizacion',
  imports: [SoloNumeros, DatePipe, ReactiveFormsModule, CampoFecha, ErroresCampo, PrecioPipe],
  templateUrl: './fidelizacion.html',
})
export class AdminFidelizacion implements OnInit {
  private fb = inject(FormBuilder);
  private admin = inject(AdminDatos);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  protected formatos = signal<Formato[]>([]);
  protected cupones = signal<Cupon[]>([]);
  protected recompensas = signal<Recompensa[]>([]);
  protected productos = signal<Producto[]>([]);
  protected editandoCupon = signal<number | 'nuevo' | null>(null);
  protected editandoRecompensa = signal<number | 'nuevo' | null>(null);

  protected config = this.fb.nonNullable.group({
    descuento_primera_compra: [
      20,
      [Validators.required, entero, Validators.min(0), Validators.max(100)],
    ],
    recargo_vip: [0, [Validators.required, entero, Validators.min(0)]],
    puntos_por_peso: [1, [Validators.required, Validators.min(0)]],
    horas_limite_cancelacion: [
      2,
      [Validators.required, entero, Validators.min(0), Validators.max(72)],
    ],
    max_entradas_por_compra: [
      10,
      [Validators.required, entero, Validators.min(1), Validators.max(30)],
    ],
  });

  protected formCupon = this.fb.group({
    codigo: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[A-Za-z0-9]{4,20}$/),
    ]),
    descripcion: this.fb.nonNullable.control(''),
    porcentaje: this.fb.control<number | null>(null, [
      Validators.required,
      entero,
      Validators.min(1),
      Validators.max(100),
    ]),
    edad_minima: this.fb.control<number | null>(null, [
      entero,
      Validators.min(1),
      Validators.max(120),
    ]),
    desde: this.fb.control<string | null>(null, [fechaValida]),
    hasta: this.fb.control<string | null>(null, [fechaValida]),
    activo: this.fb.nonNullable.control(true),
  });

  protected formRecompensa = this.fb.group({
    nombre: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.maxLength(60),
    ]),
    tipo: this.fb.nonNullable.control<'entrada' | 'producto'>('entrada'),
    producto_id: this.fb.control<number | null>(null),
    puntos: this.fb.control<number | null>(null, [Validators.required, entero, Validators.min(1)]),
    activa: this.fb.nonNullable.control(true),
  });

  async ngOnInit() {
    try {
      const [config, formatos, cupones, recompensas, productos] = await Promise.all([
        this.admin.configuracion(),
        this.admin.formatos(),
        this.admin.cupones(),
        this.admin.recompensas(),
        this.admin.productos(),
      ]);
      this.config.patchValue(config);
      this.formatos.set(formatos);
      this.cupones.set(cupones);
      this.recompensas.set(recompensas);
      this.productos.set(productos);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async guardarConfig() {
    if (this.config.invalid) {
      this.config.markAllAsTouched();
      return;
    }
    try {
      await this.admin.guardarConfiguracion(this.config.getRawValue());
      this.config.markAsPristine();
      this.avisos.ok('Configuración guardada. Queda registrada en el log de actividad.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async guardarPrecio(f: Formato, campo: HTMLInputElement) {
    const precio = Number(campo.value);
    if (precio === Number(f.precio)) return;
    if (!Number.isInteger(precio) || precio <= 0) {
      this.avisos.error('El precio tiene que ser un número entero mayor a 0.');
      campo.value = String(f.precio);
      return;
    }
    try {
      await this.admin.actualizarPrecioFormato(f.codigo, precio);
      this.formatos.set(await this.admin.formatos());
      this.avisos.ok(
        `Precio ${f.codigo} actualizado. Se aplica a las funciones que se programen desde ahora.`,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  // ---------- Cupones ----------
  protected abrirCupon(c?: Cupon) {
    this.formCupon.reset({ activo: true });
    if (c) this.formCupon.patchValue(c);
    this.editandoCupon.set(c?.id ?? 'nuevo');
  }

  protected async guardarCupon() {
    if (this.formCupon.invalid) {
      this.formCupon.markAllAsTouched();
      return;
    }
    const v = this.formCupon.getRawValue();
    if (v.desde && v.hasta && v.hasta < v.desde) {
      this.avisos.error('La fecha de fin es anterior a la de inicio.');
      return;
    }
    const id = this.editandoCupon();
    try {
      await this.admin.guardarCupon(
        {
          ...v,
          codigo: v.codigo.toUpperCase(),
          porcentaje: Number(v.porcentaje),
          edad_minima: v.edad_minima ? Number(v.edad_minima) : null,
        },
        typeof id === 'number' ? id : undefined,
      );
      this.cupones.set(await this.admin.cupones());
      this.editandoCupon.set(null);
      this.avisos.ok('Cupón guardado.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async eliminarCupon(c: Cupon) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar el cupón ${c.codigo}?`,
        mensaje: 'Deja de poder usarse en nuevas compras.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarCupon(c.id);
      this.cupones.set(await this.admin.cupones());
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  // ---------- Recompensas ----------
  protected abrirRecompensa(r?: Recompensa) {
    this.formRecompensa.reset({ tipo: 'entrada', activa: true });
    if (r) this.formRecompensa.patchValue(r);
    this.editandoRecompensa.set(r?.id ?? 'nuevo');
  }

  protected async guardarRecompensa() {
    const v = this.formRecompensa.getRawValue();
    if (this.formRecompensa.invalid || (v.tipo === 'producto' && !v.producto_id)) {
      this.formRecompensa.markAllAsTouched();
      this.avisos.error('Completá los datos (y el producto, si es un canje de candy).');
      return;
    }
    const id = this.editandoRecompensa();
    try {
      await this.admin.guardarRecompensa(
        {
          ...v,
          puntos: Number(v.puntos),
          producto_id: v.tipo === 'producto' ? Number(v.producto_id) : null,
        },
        typeof id === 'number' ? id : undefined,
      );
      this.recompensas.set(await this.admin.recompensas());
      this.editandoRecompensa.set(null);
      this.avisos.ok('Recompensa guardada.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async eliminarRecompensa(r: Recompensa) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar la recompensa "${r.nombre}"?`,
        mensaje: 'Deja de poder canjearse con puntos.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarRecompensa(r.id);
      this.recompensas.set(await this.admin.recompensas());
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected nombreProducto(id: number | null): string {
    return this.productos().find((p) => p.id === id)?.nombre ?? '';
  }
}
