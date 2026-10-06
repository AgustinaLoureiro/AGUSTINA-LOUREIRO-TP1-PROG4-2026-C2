import { Component, computed, input, output } from '@angular/core';
import { Butaca, generarSala } from '../../utils/butacas';

type EstadoButaca = 'libre' | 'elegida' | 'ocupada' | 'eligiendo' | 'inhabilitada';

/**
 * Plano de la sala. Se usa en la compra (elegir butacas en vivo) y en el admin
 * (marcar butacas fuera de servicio). No conoce Supabase: recibe estados por
 * input() y avisa los clics por output().
 */
@Component({
  selector: 'app-mapa-butacas',
  templateUrl: './mapa-butacas.html',
  styleUrl: './mapa-butacas.css',
})
export class MapaButacas {
  modo = input<'compra' | 'edicion'>('compra');
  ocupadas = input<ReadonlySet<string>>(new Set());
  eligiendoOtros = input<ReadonlySet<string>>(new Set());
  inhabilitadas = input<string[]>([]);
  seleccionadas = input<string[]>([]);

  alternar = output<string>();

  protected readonly filas = generarSala();
  private inhabilitadasSet = computed(() => new Set(this.inhabilitadas()));
  private seleccionadasSet = computed(() => new Set(this.seleccionadas()));

  protected estado(b: Butaca): EstadoButaca {
    if (this.inhabilitadasSet().has(b.id)) return 'inhabilitada';
    if (this.modo() === 'edicion') return 'libre';
    if (this.ocupadas().has(b.id)) return 'ocupada';
    if (this.seleccionadasSet().has(b.id)) return 'elegida';
    if (this.eligiendoOtros().has(b.id)) return 'eligiendo';
    return 'libre';
  }

  protected deshabilitada(b: Butaca): boolean {
    if (this.modo() === 'edicion') return false;
    const e = this.estado(b);
    return e === 'ocupada' || e === 'inhabilitada';
  }

  protected descripcion(b: Butaca): string {
    const tipo = b.tipo === 'vip' ? ' · VIP' : b.tipo === 'accesible' ? ' · Accesible' : '';
    const estados: Record<EstadoButaca, string> = {
      libre: 'libre',
      elegida: 'elegida',
      ocupada: 'vendida',
      eligiendo: 'otra persona la está eligiendo',
      inhabilitada: 'fuera de servicio',
    };
    return `Fila ${b.fila}, butaca ${b.numero}${tipo}: ${estados[this.estado(b)]}`;
  }

  protected clic(b: Butaca) {
    if (!this.deshabilitada(b)) this.alternar.emit(b.id);
  }
}
