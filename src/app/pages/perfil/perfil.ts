import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { Compras } from '../../services/compras';
import { Catalogo } from '../../services/catalogo';
import { TicketPdf } from '../../services/ticket-pdf';
import { Notificaciones } from '../../services/notificaciones';
import { Avisos } from '../../services/ui';
import { CompraResumen } from '../../interfaces/compra';
import { MovimientoCredito, MovimientoPuntos } from '../../interfaces/usuario';
import { Recompensa } from '../../interfaces/candy';
import { CodigoQr } from '../../components/codigo-qr/codigo-qr';
import { ErroresCampo } from '../../components/errores-campo/errores-campo';
import { ImagenRespaldo } from '../../directives/imagen-respaldo';
import { CodigoPipe } from '../../pipes/codigo-pipe';
import { PrecioPipe } from '../../pipes/precio-pipe';
import { IdiomaPipe } from '../../pipes/idioma-pipe';
import { mensajeError } from '../../utils/errores';
import { edadMaxima, fechaNoFutura, soloLetras, textoRequerido } from '../../utils/validadores';
import { CampoFecha, fechaValida } from '../../components/campo-fecha/campo-fecha';
import { Confirmacion } from '../../services/confirmacion';
import {
  DatosPersonales,
  grupoDatosPersonales,
} from '../../components/datos-personales/datos-personales';

type Pestania = 'entradas' | 'puntos' | 'credito' | 'datos';

@Component({
  selector: 'app-perfil',
  imports: [
    CampoFecha,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    CodigoQr,
    ErroresCampo,
    ImagenRespaldo,
    CodigoPipe,
    PrecioPipe,
    IdiomaPipe,
    DatosPersonales,
  ],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  protected auth = inject(Auth);
  protected notis = inject(Notificaciones);
  private compras = inject(Compras);
  private catalogo = inject(Catalogo);
  private pdf = inject(TicketPdf);
  private avisos = inject(Avisos);
  private confirmacion = inject(Confirmacion);
  private fb = inject(FormBuilder);

  protected pestania = signal<Pestania>('entradas');
  protected cargando = signal(true);
  protected lista = signal<CompraResumen[]>([]);
  protected puntos = signal<MovimientoPuntos[]>([]);
  protected credito = signal<MovimientoCredito[]>([]);
  protected recompensas = signal<Recompensa[]>([]);
  protected horasLimite = signal(2);
  protected qrAbierto = signal<CompraResumen | null>(null);
  protected procesando = signal<string | null>(null);

  protected proximas = computed(() =>
    this.lista()
      .filter((c) => c.estado === 'pagada' && new Date(c.funciones.fin) > new Date())
      .sort((a, b) => a.funciones.inicio.localeCompare(b.funciones.inicio)),
  );
  protected historial = computed(() =>
    this.lista().filter((c) => c.estado === 'cancelada' || new Date(c.funciones.fin) <= new Date()),
  );
  protected canjes = computed(() => this.puntos().filter((m) => m.tipo === 'canje'));

  /** ?tab=datos abre directamente "Mis datos" (lo usa el aviso de perfil incompleto). */
  tab = input<string>();

  protected datos = this.fb.group({
    nombre: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.minLength(2),
      soloLetras,
    ]),
    apellido: this.fb.nonNullable.control('', [
      Validators.required,
      textoRequerido,
      Validators.minLength(2),
      soloLetras,
    ]),
    personales: grupoDatosPersonales(),
    // Solo se usa si el perfil todavía no tiene fecha de nacimiento.
    fechaNacimiento: this.fb.control<string | null>(null, [
      fechaValida,
      fechaNoFutura,
      edadMaxima(110),
    ]),
  });

  protected faltaFecha = computed(() => !this.auth.perfil()?.fecha_nacimiento);

  async ngOnInit() {
    const p = this.auth.perfil();
    if (p) {
      this.datos.patchValue({
        nombre: p.nombre,
        apellido: p.apellido,
        personales: {
          tipoSangre: p.tipo_sangre,
          colorOjos: p.color_ojos,
          diasVacaciones: p.dias_vacaciones,
        },
      });
    }
    if (this.faltaFecha()) this.datos.controls.fechaNacimiento.addValidators(Validators.required);
    if (this.tab() === 'datos' || this.auth.perfilIncompleto()) {
      this.pestania.set('datos');
      this.datos.markAllAsTouched();
    }
    await this.cargar();
  }

  private async cargar() {
    const id = this.auth.usuario()!.id;
    try {
      const [lista, puntos, credito, recompensas, config] = await Promise.all([
        this.compras.misCompras(id),
        this.compras.movimientosPuntos(id),
        this.compras.movimientosCredito(id),
        this.catalogo.recompensasActivas(),
        this.catalogo.configuracion(),
      ]);
      this.lista.set(lista);
      this.puntos.set(puntos);
      this.credito.set(credito);
      this.recompensas.set(recompensas);
      this.horasLimite.set(config.horas_limite_cancelacion);
    } finally {
      this.cargando.set(false);
    }
  }

  protected cancelable(c: CompraResumen): boolean {
    const limite = new Date(c.funciones.inicio).getTime() - this.horasLimite() * 3_600_000;
    return (
      c.estado === 'pagada' &&
      !c.entrada_validada_en &&
      !c.candy_entregado_en &&
      Date.now() < limite
    );
  }

  protected async cancelar(c: CompraResumen) {
    const ok = await this.confirmacion.pedir({
      titulo: `¿Cancelar tu compra para ${c.funciones.peliculas.titulo}?`,
      mensaje:
        'El importe vuelve como crédito en tu cuenta para usar en otra compra. No se reintegra dinero.',
      aceptar: 'Cancelar compra',
      cancelar: 'Volver',
      peligro: true,
    });
    if (!ok) return;
    this.procesando.set(c.id);
    try {
      const credito = await this.compras.cancelar(c.id);
      this.avisos.ok(`Compra cancelada. Sumaste $ ${credito.toLocaleString('es-AR')} de crédito.`);
      await Promise.all([this.auth.cargarPerfil(), this.cargar()]);
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.procesando.set(null);
    }
  }

  protected async descargar(c: CompraResumen) {
    this.procesando.set(c.id);
    try {
      const detalle = await this.compras.obtener(c.codigo);
      if (detalle) await this.pdf.descargar(detalle);
    } catch {
      this.avisos.error('No se pudo generar el PDF.');
    } finally {
      this.procesando.set(null);
    }
  }

  protected async guardarDatos() {
    if (this.datos.invalid) {
      this.datos.markAllAsTouched();
      return;
    }
    try {
      const { nombre, apellido, fechaNacimiento, personales } = this.datos.getRawValue();
      await this.auth.actualizarDatos({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fecha_nacimiento: this.faltaFecha() ? fechaNacimiento : null,
        tipo_sangre: personales.tipoSangre,
        color_ojos: personales.colorOjos,
        dias_vacaciones:
          personales.diasVacaciones === null ? null : Number(personales.diasVacaciones),
      });
      this.datos.controls.fechaNacimiento.clearValidators();
      this.datos.controls.fechaNacimiento.updateValueAndValidity();
      this.avisos.ok('Datos actualizados.');
      this.datos.markAsPristine();
    } catch (e) {
      this.avisos.error(mensajeError(e));
    }
  }

  protected probando = signal(false);

  /** Manda una notificación de prueba a este usuario (campanita y, si está activo, push). */
  protected async probarNotificacion() {
    this.probando.set(true);
    try {
      await this.notis.probar();
      this.avisos.ok('Notificación enviada: tiene que llegar en unos segundos.');
    } catch (e) {
      this.avisos.error(mensajeError(e));
    } finally {
      this.probando.set(false);
    }
  }

  protected async activarPush() {
    try {
      await this.notis.suscribirPush();
      this.avisos.ok('Listo: vas a recibir notificaciones en este dispositivo.');
    } catch {
      this.avisos.error('No se pudo activar. Revisá los permisos de notificaciones del navegador.');
    }
  }

  protected butacasDe(c: CompraResumen): string {
    return c.entradas.map((e) => e.butaca).join(', ');
  }

  protected etiquetaTipo(tipo: MovimientoPuntos['tipo']): string {
    return { compra: 'Compra', canje: 'Canje', anulacion: 'Anulación', devolucion: 'Devolución' }[
      tipo
    ];
  }
}
