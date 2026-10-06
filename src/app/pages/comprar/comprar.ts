import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Catalogo } from '../../services/catalogo';
import { Compras } from '../../services/compras';
import { Auth } from '../../services/auth';
import { Avisos } from '../../services/ui';
import { ButacasEnVivo, SalaEnVivo } from '../../services/butacas-en-vivo';
import { Funcion } from '../../interfaces/catalogo';
import { Categoria, Combo, Configuracion, Producto, Recompensa } from '../../interfaces/candy';
import { Cotizacion, SolicitudCompra } from '../../interfaces/compra';
import { MapaButacas } from '../../components/mapa-butacas/mapa-butacas';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { PrecioPipe } from '../../pipes/precio-pipe';
import { IdiomaPipe } from '../../pipes/idioma-pipe';
import { ordenarButacas, tipoButaca } from '../../utils/butacas';
import { mensajeError } from '../../utils/errores';
import { marcaTarjeta, tarjetaValida, vencimientoVigente } from '../../utils/validadores';

type Paso = 1 | 2 | 3;

@Component({
  selector: 'app-comprar',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MapaButacas,
    ErroresCampo,
    ImagenRespaldo,
    PrecioPipe,
    IdiomaPipe,
  ],
  templateUrl: './comprar.html',
  styleUrl: './comprar.css',
})
export class Comprar implements OnInit, OnDestroy {
  funcionId = input.required<string>();

  private catalogo = inject(Catalogo);
  private compras = inject(Compras);
  private butacasEnVivo = inject(ButacasEnVivo);
  private router = inject(Router);
  private avisos = inject(Avisos);
  private fb = inject(FormBuilder);
  protected auth = inject(Auth);

  protected readonly sinButacas: ReadonlySet<string> = new Set();
  protected paso = signal<Paso>(1);
  protected cargando = signal(true);
  protected errorCarga = signal<string | null>(null);
  protected funcion = signal<Funcion | null>(null);
  protected config = signal<Configuracion | null>(null);
  protected sala = signal<SalaEnVivo | null>(null);

  // Selección
  protected butacas = signal<string[]>([]);
  protected combos = signal<Combo[]>([]);
  protected productos = signal<Producto[]>([]);
  protected categorias = signal<Categoria[]>([]);
  protected recompensas = signal<Recompensa[]>([]);
  protected cantCombos = signal<Record<number, number>>({});
  protected cantProductos = signal<Record<number, number>>({});
  protected cantRecompensas = signal<Record<number, number>>({});
  protected categoriaActiva = signal<number | null>(null);
  protected cupon = signal<string | null>(null);
  protected usarCredito = signal(false);

  // Cotización calculada por la base
  protected cotizacion = signal<Cotizacion | null>(null);
  protected cotizando = signal(false);
  protected errorCotizacion = signal<string | null>(null);
  protected confirmando = signal(false);

  protected formPago = this.fb.nonNullable.group({
    email: ['', [Validators.email]],
    nombre: [''],
    declaraEdad: [false],
    tarjeta: this.fb.nonNullable.group({
      numero: ['', [Validators.required, tarjetaValida]],
      titular: ['', [Validators.required, Validators.minLength(3)]],
      vencimiento: ['', [Validators.required, vencimientoVigente]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    }),
  });
  protected cuponIngresado = this.fb.nonNullable.control('');

  protected readonly maxButacas = computed(() => this.config()?.max_entradas_por_compra ?? 10);
  protected edadMinima = computed(() => {
    const c = this.funcion()?.peliculas?.clasificacion;
    return c === '+18' ? 18 : c === '+13' ? 13 : 0;
  });
  protected hayVip = computed(() => this.butacas().some((b) => tipoButaca(b) === 'vip'));
  protected hayCandy = computed(
    () =>
      Object.values(this.cantCombos()).some(Boolean) ||
      Object.values(this.cantProductos()).some(Boolean) ||
      this.recompensas().some((r) => r.tipo === 'producto' && this.cantRecompensas()[r.id]),
  );
  protected entradasCubiertas = computed(() => {
    const combos = Object.values(this.cantCombos()).reduce((a, b) => a + b, 0);
    const canjes = this.recompensas()
      .filter((r) => r.tipo === 'entrada')
      .reduce((a, r) => a + (this.cantRecompensas()[r.id] ?? 0), 0);
    return combos + canjes;
  });
  protected puntosElegidos = computed(() =>
    this.recompensas().reduce((a, r) => a + r.puntos * (this.cantRecompensas()[r.id] ?? 0), 0),
  );
  protected productosVisibles = computed(() =>
    this.productos().filter(
      (p) => !this.categoriaActiva() || p.categoria_id === this.categoriaActiva(),
    ),
  );

  /** Lo que se le pide a la base. Cambia → se vuelve a cotizar. */
  protected solicitud = computed<SolicitudCompra>(() => ({
    funcion_id: Number(this.funcionId()),
    butacas: this.butacas(),
    combos: aLista(this.cantCombos()),
    productos: aLista(this.cantProductos()),
    recompensas: aLista(this.cantRecompensas()),
    cupon: this.cupon(),
    usar_credito: this.usarCredito(),
  }));

  constructor() {
    // Cotización con espera de 350 ms para no llamar en cada clic.
    effect((onCleanup) => {
      const solicitud = this.solicitud();
      if (!solicitud.butacas.length) {
        this.cotizacion.set(null);
        return;
      }
      const t = setTimeout(() => this.cotizar(solicitud), 350);
      onCleanup(() => clearTimeout(t));
    });

    // Si alguien compra una butaca que yo tenía elegida, se quita y se avisa.
    effect(() => {
      const sala = this.sala();
      if (!sala) return;
      const ocupadas = sala.ocupadas();
      const perdidas = untracked(this.butacas).filter((b) => ocupadas.has(b));
      if (perdidas.length) {
        this.butacas.update((l) => l.filter((b) => !ocupadas.has(b)));
        this.avisos.error(`La butaca ${perdidas.join(', ')} se acaba de vender. Elegí otra.`);
      }
    });

    // Comparto mi selección para que otros la vean "en elección" (Presence).
    effect(() => {
      const seleccion = this.butacas();
      untracked(() => this.sala()?.anunciar(seleccion));
    });
  }

  async ngOnInit() {
    try {
      const id = Number(this.funcionId());
      const [funcion, config, combos, productos, categorias, recompensas] = await Promise.all([
        this.catalogo.funcion(id),
        this.catalogo.configuracion(),
        this.catalogo.combosActivos(),
        this.catalogo.productosActivos(),
        this.catalogo.categorias(),
        this.catalogo.recompensasActivas(),
      ]);
      if (!funcion || !funcion.activa) {
        this.errorCarga.set('La función no existe o fue cancelada.');
        return;
      }
      if (new Date(funcion.inicio) <= new Date()) {
        this.errorCarga.set('Esta función ya comenzó. Elegí otro horario.');
        return;
      }
      this.funcion.set(funcion);
      this.config.set(config);
      this.combos.set(combos);
      this.productos.set(productos);
      this.categorias.set(categorias.filter((c) => productos.some((p) => p.categoria_id === c.id)));
      this.recompensas.set(recompensas);

      const sala = this.butacasEnVivo.abrir(id);
      await sala.conectar();
      this.sala.set(sala);
    } catch (e) {
      this.errorCarga.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.sala()?.desconectar();
  }

  // ---------- Paso 1: butacas ----------
  protected alternarButaca(id: string) {
    const actuales = this.butacas();
    if (actuales.includes(id)) {
      this.butacas.set(actuales.filter((b) => b !== id));
      return;
    }
    if (actuales.length >= this.maxButacas()) {
      this.avisos.mostrar(`Podés elegir hasta ${this.maxButacas()} butacas por compra.`);
      return;
    }
    this.butacas.set(ordenarButacas([...actuales, id]));
  }

  // ---------- Paso 2: candy ----------
  protected cambiar(tipo: 'combo' | 'producto' | 'recompensa', id: number, delta: number) {
    const sig =
      tipo === 'combo'
        ? this.cantCombos
        : tipo === 'producto'
          ? this.cantProductos
          : this.cantRecompensas;
    const actual = sig()[id] ?? 0;
    const nuevo = Math.max(0, actual + delta);

    if (delta > 0) {
      const ocupaEntrada =
        tipo === 'combo' ||
        (tipo === 'recompensa' && this.recompensas().find((r) => r.id === id)?.tipo === 'entrada');
      if (ocupaEntrada && this.entradasCubiertas() >= this.butacas().length) {
        this.avisos.mostrar(
          'Cada combo o entrada canjeada usa una de tus butacas. Sumá más butacas primero.',
        );
        return;
      }
      if (tipo === 'recompensa') {
        const r = this.recompensas().find((x) => x.id === id)!;
        if (this.puntosElegidos() + r.puntos > (this.auth.perfil()?.puntos ?? 0)) {
          this.avisos.mostrar('No te alcanzan los puntos para este canje.');
          return;
        }
      }
      if (tipo === 'producto' && nuevo > 20) return;
    }
    sig.update((m) => ({ ...m, [id]: nuevo }));
  }

  protected nombresCombo(c: Combo): string {
    return c.combo_productos
      .map((cp) => `${cp.cantidad > 1 ? cp.cantidad + ' × ' : ''}${cp.productos?.nombre}`)
      .join(' + ');
  }

  // ---------- Paso 3: pago ----------
  protected aplicarCupon() {
    const codigo = this.cuponIngresado.value.trim().toUpperCase();
    this.cupon.set(codigo || null);
  }

  protected quitarCupon() {
    this.cupon.set(null);
    this.cuponIngresado.setValue('');
  }

  protected formatearTarjeta(evento: Event) {
    const el = evento.target as HTMLInputElement;
    const digitos = el.value.replace(/\D/g, '').slice(0, 19);
    el.value = digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
    this.formPago.controls.tarjeta.controls.numero.setValue(el.value);
  }

  protected formatearVencimiento(evento: Event) {
    const el = evento.target as HTMLInputElement;
    const d = el.value.replace(/\D/g, '').slice(0, 4);
    el.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    this.formPago.controls.tarjeta.controls.vencimiento.setValue(el.value);
  }

  protected get marca(): string {
    return marcaTarjeta(this.formPago.controls.tarjeta.controls.numero.value);
  }

  protected irA(paso: Paso) {
    if (paso > 1 && !this.butacas().length) return;
    this.paso.set(paso);
    window.scrollTo({ top: 0 });
  }

  protected async confirmar() {
    const cot = this.cotizacion();
    if (!cot) return;
    const f = this.formPago.controls;
    const anonimo = !this.auth.logueado();

    if (anonimo) {
      f.email.addValidators(Validators.required);
      f.nombre.addValidators(Validators.required);
      f.email.updateValueAndValidity();
      f.nombre.updateValueAndValidity();
    }
    const requiereDeclaracion =
      this.edadMinima() > 0 && (anonimo || !this.auth.perfil()?.fecha_nacimiento);
    const tarjetaOk = cot.a_pagar === 0 || f.tarjeta.valid;

    this.formPago.markAllAsTouched();
    if ((anonimo && (f.email.invalid || f.nombre.invalid)) || !tarjetaOk) {
      this.avisos.error('Revisá los datos marcados en rojo.');
      return;
    }
    if (requiereDeclaracion && !f.declaraEdad.value) {
      this.avisos.error(
        `Tenés que confirmar que todos los asistentes tienen ${this.edadMinima()} años o más.`,
      );
      return;
    }

    this.confirmando.set(true);
    try {
      const resultado = await this.compras.confirmar({
        ...this.solicitud(),
        email: f.email.value.trim(),
        nombre: f.nombre.value.trim(),
        declara_edad: f.declaraEdad.value,
        tarjeta_ultimos4:
          cot.a_pagar > 0
            ? f.tarjeta.controls.numero.value.replace(/\D/g, '').slice(-4)
            : undefined,
      });
      if (this.auth.logueado()) await this.auth.cargarPerfil();
      this.recordarCompraAnonima(resultado.codigo);
      this.router.navigate(['/compra', resultado.codigo], { replaceUrl: true });
    } catch (e) {
      this.avisos.error(mensajeError(e));
      // Si el error fue por una butaca recién vendida, Realtime ya la marcó.
    } finally {
      this.confirmando.set(false);
    }
  }

  private async cotizar(solicitud: SolicitudCompra) {
    this.cotizando.set(true);
    try {
      // Para la vista previa se asume la declaración de edad; al confirmar se exige de verdad.
      this.cotizacion.set(await this.compras.cotizar({ ...solicitud, declara_edad: true }));
      this.errorCotizacion.set(null);
    } catch (e) {
      const msg = mensajeError(e);
      this.errorCotizacion.set(msg);
      if (solicitud.cupon && /cup[oó]n/i.test(msg)) {
        this.cupon.set(null);
        this.avisos.error(msg);
      }
    } finally {
      this.cotizando.set(false);
    }
  }

  /** Las compras sin cuenta se guardan en este dispositivo para volver a verlas. */
  private recordarCompraAnonima(codigo: string) {
    if (this.auth.logueado()) return;
    try {
      const previas = JSON.parse(localStorage.getItem('cinecorn-compras') ?? '[]') as string[];
      localStorage.setItem('cinecorn-compras', JSON.stringify([codigo, ...previas].slice(0, 20)));
    } catch {
      // Sin almacenamiento disponible: no es crítico.
    }
  }
}

function aLista(mapa: Record<number, number>) {
  return Object.entries(mapa)
    .filter(([, c]) => c > 0)
    .map(([id, cantidad]) => ({ id: Number(id), cantidad }));
}
