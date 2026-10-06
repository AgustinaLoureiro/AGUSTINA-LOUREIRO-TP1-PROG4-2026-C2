import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminDatos } from '../../../services/admin';
import { Storage } from '../../../services/storage';
import { Avisos } from '../../../services/ui';
import { Categoria, Combo, Producto } from '../../../interfaces/candy';
import { ErroresCampo } from '../../../components/errores-campo/errores-campo';
import { ImagenRespaldo } from '../../../directives/imagen-respaldo';
import { PrecioPipe } from '../../../pipes/precio-pipe';
import { mensajeError } from '../../../utils/errores';
import { entero, textoRequerido } from '../../../utils/validadores';
import { Confirmacion } from '../../../services/confirmacion';
import { SoloNumeros } from '../../../directives/solo-numeros';

type Pestania = 'productos' | 'combos' | 'categorias';

@Component({
  selector: 'app-admin-candy',
  imports: [SoloNumeros, ReactiveFormsModule, ErroresCampo, ImagenRespaldo, PrecioPipe],
  templateUrl: './candy.html',
})
export class AdminCandy implements OnInit {
  private fb = inject(FormBuilder);
  private admin = inject(AdminDatos);
  private storage = inject(Storage);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);

  protected pestania = signal<Pestania>('productos');
  protected categorias = signal<Categoria[]>([]);
  protected productos = signal<Producto[]>([]);
  protected combos = signal<Combo[]>([]);
  protected editandoProducto = signal<number | 'nuevo' | null>(null);
  protected editandoCombo = signal<number | 'nuevo' | null>(null);
  protected subiendo = signal(false);

  protected nombreCategoria = computed(
    () => new Map(this.categorias().map((c) => [c.id, c.nombre])),
  );

  protected formProducto = this.fb.group({
    nombre: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.maxLength(60),
    ]),
    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(140)]),
    categoria_id: this.fb.control<number | null>(null, Validators.required),
    precio: this.fb.control<number | null>(null, [Validators.required, entero, Validators.min(1)]),
    imagen_url: this.fb.control<string | null>(null),
    activo: this.fb.nonNullable.control(true),
  });

  protected formCombo = this.fb.group({
    nombre: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.maxLength(40),
    ]),
    descripcion: this.fb.nonNullable.control('', [Validators.maxLength(140)]),
    precio: this.fb.control<number | null>(null, [Validators.required, entero, Validators.min(1)]),
    imagen_url: this.fb.control<string | null>(null),
    activo: this.fb.nonNullable.control(true),
    // FormArray: lista dinámica de productos del combo
    items: this.fb.array([this.nuevoItem()]),
  });

  protected formCategoria = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, textoRequerido, Validators.maxLength(30)]],
  });

  async ngOnInit() {
    await this.cargar();
  }

  private async cargar() {
    try {
      const [categorias, productos, combos] = await Promise.all([
        this.admin.categorias(),
        this.admin.productos(),
        this.admin.combos(),
      ]);
      this.categorias.set(categorias);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  // ---------- Productos ----------
  protected abrirProducto(p?: Producto) {
    this.formProducto.reset({ activo: true, categoria_id: this.categorias()[0]?.id ?? null });
    if (p) this.formProducto.patchValue(p);
    this.editandoProducto.set(p?.id ?? 'nuevo');
  }

  protected async subirImagen(evento: Event, destino: 'producto' | 'combo') {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendo.set(true);
    try {
      const url = await this.storage.subirImagen(
        archivo,
        destino === 'producto' ? 'productos' : 'combos',
      );
      (destino === 'producto' ? this.formProducto : this.formCombo).controls.imagen_url.setValue(
        url,
      );
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.subiendo.set(false);
    }
  }

  protected async guardarProducto() {
    if (this.formProducto.invalid) {
      this.formProducto.markAllAsTouched();
      return;
    }
    const v = this.formProducto.getRawValue();
    const id = this.editandoProducto();
    try {
      await this.admin.guardarProducto(
        { ...v, categoria_id: Number(v.categoria_id), precio: Number(v.precio) },
        typeof id === 'number' ? id : undefined,
      );
      this.editandoProducto.set(null);
      await this.cargar();
      this.avisos.ok('Producto guardado.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async alternarProducto(p: Producto) {
    const { id, ...resto } = p;
    await this.admin
      .guardarProducto({ ...resto, activo: !p.activo }, id)
      .catch((e) => this.avisos.error(mensajeError(e)));
    await this.cargar();
  }

  protected async eliminarProducto(p: Producto) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar ${p.nombre}?`,
        mensaje:
          'Se quita del candy bar. Si ya tuvo ventas no se puede eliminar: en ese caso, desactivalo.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarProducto(p.id);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e) + ' Podés desactivarlo en su lugar.');
    }
  }

  // ---------- Combos ----------
  protected get items(): FormArray {
    return this.formCombo.controls.items;
  }

  private nuevoItem(productoId: number | null = null, cantidad = 1) {
    return this.fb.group({
      producto_id: this.fb.control<number | null>(productoId, Validators.required),
      cantidad: this.fb.nonNullable.control(cantidad, [
        Validators.required,
        Validators.min(1),
        Validators.max(10),
      ]),
    });
  }

  protected agregarItem() {
    this.items.push(this.nuevoItem());
  }

  protected quitarItem(i: number) {
    if (this.items.length > 1) this.items.removeAt(i);
  }

  protected abrirCombo(c?: Combo) {
    this.formCombo.reset({ activo: true });
    this.items.clear();
    if (c) {
      this.formCombo.patchValue({ ...c, items: [] });
      c.combo_productos.forEach((cp) =>
        this.items.push(this.nuevoItem(cp.producto_id, cp.cantidad)),
      );
    } else {
      this.items.push(this.nuevoItem());
    }
    this.editandoCombo.set(c?.id ?? 'nuevo');
  }

  protected async guardarCombo() {
    if (this.formCombo.invalid) {
      this.formCombo.markAllAsTouched();
      return;
    }
    const { items, ...v } = this.formCombo.getRawValue();
    const id = this.editandoCombo();
    try {
      await this.admin.guardarCombo(
        { ...v, precio: Number(v.precio) },
        (items as { producto_id: number; cantidad: number }[]).map((i) => ({
          producto_id: Number(i.producto_id),
          cantidad: Number(i.cantidad),
        })),
        typeof id === 'number' ? id : undefined,
      );
      this.editandoCombo.set(null);
      await this.cargar();
      this.avisos.ok('Combo guardado.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async eliminarCombo(c: Combo) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar el combo ${c.nombre}?`,
        mensaje: 'Deja de ofrecerse al comprar entradas.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarCombo(c.id);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e) + ' Podés desactivarlo en su lugar.');
    }
  }

  protected detalleCombo(c: Combo): string {
    return c.combo_productos.map((cp) => `${cp.cantidad} × ${cp.productos?.nombre}`).join(', ');
  }

  /** Suma de los productos sueltos, para comparar con el precio del combo. */
  protected valorSuelto(c: Combo): number {
    return c.combo_productos.reduce(
      (t, cp) =>
        t + (this.productos().find((p) => p.id === cp.producto_id)?.precio ?? 0) * cp.cantidad,
      0,
    );
  }

  // ---------- Categorías ----------
  protected async crearCategoria() {
    if (this.formCategoria.invalid) return;
    try {
      await this.admin.guardarCategoria({
        nombre: this.formCategoria.getRawValue().nombre.trim(),
        orden: this.categorias().length + 1,
      });
      this.formCategoria.reset();
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async renombrarCategoria(c: Categoria, nombre: string) {
    if (!nombre.trim() || nombre === c.nombre) return;
    try {
      await this.admin.guardarCategoria({ nombre: nombre.trim(), orden: c.orden }, c.id);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected async eliminarCategoria(c: Categoria) {
    if (
      !(await this.confirmacion.pedir({
        titulo: `¿Eliminar la categoría ${c.nombre}?`,
        mensaje: 'Solo se puede si no tiene productos.',
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return;
    try {
      await this.admin.eliminarCategoria(c.id);
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeError(e, '') + ' (Primero mové o eliminá sus productos.)');
    }
  }
}
