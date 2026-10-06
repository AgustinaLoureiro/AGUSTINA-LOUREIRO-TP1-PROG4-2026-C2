import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { esFechaValida, hoyISO, sumarDias } from '../../utils/fechas';

export interface AtajoFecha {
  texto: string;
  dias: number;
}

/** Valida que el valor 'YYYY-MM-DD' sea una fecha real (descarta 31/02, etc.). */
export const fechaValida: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v = control.value as string | null;
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m && esFechaValida(+m[1], +m[2], +m[3]) ? null : { fechaInvalida: true };
};

/**
 * Ingreso de fechas sin calendario desplegable (pedido explícito del cliente):
 * tres casilleros DD / MM / AAAA que avanzan solos y, opcionalmente, atajos
 * ("Hoy", "+7 días"). Recibe el FormControl por input, como en la clase de formularios.
 */
@Component({
  selector: 'app-campo-fecha',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './campo-fecha.html',
  styleUrl: './campo-fecha.css',
})
export class CampoFecha implements OnInit {
  control = input.required<FormControl<string | null>>();
  etiqueta = input('Fecha');
  idCampo = input('fecha');
  atajos = input<AtajoFecha[]>([]);
  /** Fecha desde la que se cuentan los atajos (por defecto, hoy). */
  base = input<string | null>(null);

  protected dia = signal('');
  protected mes = signal('');
  protected anio = signal('');

  private refMes = viewChild<ElementRef<HTMLInputElement>>('refMes');
  private refAnio = viewChild<ElementRef<HTMLInputElement>>('refAnio');

  ngOnInit() {
    this.desdeValor(this.control().value);
    this.control().valueChanges.subscribe((v) => {
      if (v !== this.componer()) this.desdeValor(v);
    });
  }

  protected escribir(parte: 'dia' | 'mes' | 'anio', evento: Event) {
    const el = evento.target as HTMLInputElement;
    const limpio = el.value.replace(/\D/g, '').slice(0, parte === 'anio' ? 4 : 2);
    el.value = limpio;
    this[parte].set(limpio);

    if (parte === 'dia' && limpio.length === 2) this.refMes()?.nativeElement.focus();
    if (parte === 'mes' && limpio.length === 2) this.refAnio()?.nativeElement.focus();

    this.control().setValue(this.componer());
    this.control().markAsDirty();
  }

  /** Borrar con el casillero vacío vuelve al anterior. */
  protected retroceder(evento: KeyboardEvent, anterior: HTMLInputElement | null) {
    const el = evento.target as HTMLInputElement;
    if (evento.key === 'Backspace' && !el.value && anterior) {
      anterior.focus();
    }
  }

  protected tocar() {
    this.control().markAsTouched();
  }

  protected aplicarAtajo(atajo: AtajoFecha) {
    const iso = sumarDias(this.base() || hoyISO(), atajo.dias);
    this.desdeValor(iso);
    this.control().setValue(iso);
    this.control().markAsTouched();
    this.control().markAsDirty();
  }

  protected atajoActivo(atajo: AtajoFecha): boolean {
    return this.control().value === sumarDias(this.base() || hoyISO(), atajo.dias);
  }

  private componer(): string {
    const d = this.dia();
    const m = this.mes();
    const a = this.anio();
    if (!d || !m || a.length !== 4) return '';
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  private desdeValor(v: string | null) {
    const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
    this.anio.set(m?.[1] ?? '');
    this.mes.set(m?.[2] ?? '');
    this.dia.set(m?.[3] ?? '');
  }
}
