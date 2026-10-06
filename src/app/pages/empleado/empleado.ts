import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { Auth } from '../../services/auth';
import { Compras } from '../../services/compras';
import { FuncionDelDia, ResultadoValidacion } from '../../interfaces/compra';
import { SiRol } from '../../directives/si-rol';
import { CodigoPipe, formatearCodigo } from '../../pipes/codigo-pipe';
import { mensajeError } from '../../utils/errores';
import { DialogoConfirmacion } from '../../components/dialogo-confirmacion/dialogo-confirmacion';

type Sector = 'entrada' | 'candy';

interface Registro {
  hora: Date;
  codigo: string;
  sector: Sector;
  ok: boolean;
  motivo: string;
}

/**
 * Validación de QR para el personal. Cada QR sirve una vez para la sala y una
 * vez para el candy bar; la regla la aplica la RPC validar_codigo en la base.
 * Si la cámara no funciona, el código se puede ingresar a mano.
 */
@Component({
  imports: [DialogoConfirmacion, DatePipe, RouterLink, SiRol, CodigoPipe],
  selector: 'app-empleado',
  styleUrl: './empleado.css',
  templateUrl: './empleado.html',
  host: { class: 'tema-staff' },
})
export class Empleado implements OnInit, OnDestroy {
  private sup = inject(Supabase);
  private router = inject(Router);
  private compras = inject(Compras);
  protected auth = inject(Auth);

  protected sector = signal<Sector>('entrada');
  protected camaraActiva = signal(false);
  protected errorCamara = signal<string | null>(null);
  protected validando = signal(false);
  protected resultado = signal<ResultadoValidacion | null>(null);
  protected historial = signal<Registro[]>([]);
  protected codigoManual = signal('');
  protected funciones = signal<FuncionDelDia[]>([]);
  protected ahora = signal(new Date());

  protected nombre = computed(() => {
    const p = this.auth.perfil();
    return [p?.nombre, p?.apellido].filter(Boolean).join(' ') || p?.email || '';
  });
  protected iniciales = computed(() => {
    const p = this.auth.perfil();
    return ((p?.nombre?.[0] ?? '') + (p?.apellido?.[0] ?? '') || 'C').toUpperCase();
  });
  protected aceptados = computed(
    () => this.historial().filter((h) => h.ok && h.sector === this.sector()).length,
  );
  protected rechazados = computed(
    () => this.historial().filter((h) => !h.ok && h.sector === this.sector()).length,
  );
  protected codigoCompleto = computed(
    () => this.codigoManual().replace(/[^A-Z0-9]/g, '').length === 12,
  );

  /** Funciones de hoy que todavía no terminaron. */
  protected proximas = computed(() =>
    this.funciones().filter((f) => new Date(f.fin) > this.ahora()),
  );

  private video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private flujo?: MediaStream;
  private bucle?: number;
  private reloj?: ReturnType<typeof setInterval>;
  private ultimoLeido = '';

  async ngOnInit() {
    await this.cargarFunciones();
    this.reloj = setInterval(() => this.ahora.set(new Date()), 60_000);
  }

  ngOnDestroy() {
    this.detenerCamara();
    clearInterval(this.reloj);
  }

  protected cambiarSector(s: Sector) {
    this.sector.set(s);
    this.resultado.set(null);
  }

  protected enCurso(f: FuncionDelDia): boolean {
    const t = this.ahora().getTime();
    return new Date(f.inicio).getTime() - 60 * 60_000 <= t && t <= new Date(f.fin).getTime();
  }

  private async cargarFunciones() {
    try {
      this.funciones.set(await this.compras.funcionesDeHoy());
    } catch {
      // La lista es informativa: si falla, el lector sigue funcionando.
    }
  }

  // ---------- Cámara ----------
  protected async iniciarCamara() {
    this.errorCamara.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no permite usar la cámara. Ingresá el código a mano.');
      return;
    }
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.camaraActiva.set(true);
      await new Promise((r) => setTimeout(r));
      const video = this.video()!.nativeElement;
      video.srcObject = this.flujo;
      await video.play();
      this.escanear();
    } catch {
      this.errorCamara.set(
        'No se pudo usar la cámara. Revisá los permisos o ingresá el código a mano.',
      );
      this.detenerCamara();
    }
  }

  protected detenerCamara() {
    if (this.bucle) cancelAnimationFrame(this.bucle);
    this.flujo?.getTracks().forEach((t) => t.stop());
    this.flujo = undefined;
    this.camaraActiva.set(false);
  }

  /** Lee cuadros del video y busca un QR con jsQR (cargado bajo demanda). */
  private async escanear() {
    const { default: jsQR } = await import('jsqr');
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;

    const cuadro = () => {
      const video = this.video()?.nativeElement;
      if (!this.camaraActiva() || !video) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && !this.validando() && !this.resultado()) {
        lienzo.width = video.videoWidth;
        lienzo.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imagen = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        const qr = jsQR(imagen.data, imagen.width, imagen.height, {
          inversionAttempts: 'dontInvert',
        });
        if (qr?.data && qr.data !== this.ultimoLeido) {
          this.ultimoLeido = qr.data;
          navigator.vibrate?.(80);
          this.validar(qr.data);
          setTimeout(() => (this.ultimoLeido = ''), 4000);
        }
      }
      this.bucle = requestAnimationFrame(cuadro);
    };
    this.bucle = requestAnimationFrame(cuadro);
  }

  // ---------- Código manual ----------
  /** Formatea mientras se escribe: "cc1a2b3c4d5e" → "CC-1A2B3-C4D5E". */
  protected escribirCodigo(evento: Event) {
    const el = evento.target as HTMLInputElement;
    let limpio = el.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    if (limpio.length >= 2 && !limpio.startsWith('CC')) limpio = ('CC' + limpio).slice(0, 12);
    const visible =
      limpio.length > 7
        ? `${limpio.slice(0, 2)}-${limpio.slice(2, 7)}-${limpio.slice(7)}`
        : limpio.length > 2
          ? `${limpio.slice(0, 2)}-${limpio.slice(2)}`
          : limpio;
    el.value = visible;
    this.codigoManual.set(visible);
  }

  protected validarManual() {
    if (!this.codigoCompleto()) return;
    this.validar(this.codigoManual());
    this.codigoManual.set('');
  }

  // ---------- Validación ----------
  private async validar(codigo: string) {
    this.validando.set(true);
    try {
      const { data, error } = await this.sup.Supabase.rpc('validar_codigo', {
        p_codigo: codigo,
        p_sector: this.sector(),
      });
      if (error) throw error;
      const r = data as ResultadoValidacion;
      this.resultado.set(r);
      this.registrar(codigo, r.ok, r.motivo);
      if (r.ok) this.cargarFunciones();
    } catch (e) {
      const motivo = mensajeError(e);
      this.resultado.set({ ok: false, motivo });
      this.registrar(codigo, false, motivo);
    } finally {
      this.validando.set(false);
    }
  }

  protected siguiente() {
    this.resultado.set(null);
  }

  private registrar(codigo: string, ok: boolean, motivo: string) {
    this.historial.update((h) =>
      [
        { hora: new Date(), codigo: formatearCodigo(codigo), sector: this.sector(), ok, motivo },
        ...h,
      ].slice(0, 30),
    );
  }

  protected async salir() {
    this.detenerCamara();
    await this.auth.salir();
    this.router.navigateByUrl('/ingresar');
  }
}
