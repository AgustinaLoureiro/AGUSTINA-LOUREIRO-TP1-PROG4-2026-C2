import { inject, Service, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from './supabase';

interface EstadoPresencia {
  butacas: string[];
}

/**
 * Conexión en tiempo real con la ocupación de una función:
 * - Postgres Changes sobre butacas_ocupadas: butacas que se venden o se liberan.
 * - Presence: butacas que otras personas están eligiendo en este momento.
 */
export class SalaEnVivo {
  readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  readonly eligiendoOtros = signal<ReadonlySet<string>>(new Set());
  readonly conectado = signal(false);

  private canal: RealtimeChannel;
  private readonly miClave = crypto.randomUUID();

  constructor(
    private sup: Supabase,
    private funcionId: number,
  ) {
    this.canal = this.sup.Supabase.channel(`funcion-${funcionId}`, {
      config: { presence: { key: this.miClave } },
    });
  }

  async conectar() {
    const { data } = await this.sup.Supabase.from('butacas_ocupadas')
      .select('butaca')
      .eq('funcion_id', this.funcionId);
    this.ocupadas.set(new Set((data ?? []).map((b) => b.butaca as string)));

    this.canal
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'butacas_ocupadas',
          filter: `funcion_id=eq.${this.funcionId}`,
        },
        (evento) => {
          const butaca = (evento.new as { butaca: string }).butaca;
          this.ocupadas.update((s) => new Set(s).add(butaca));
        },
      )
      // Los DELETE no admiten filtro: llega la PK (funcion_id, butaca) y se filtra acá.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'butacas_ocupadas' },
        (evento) => {
          const viejo = evento.old as { funcion_id: number; butaca: string };
          if (viejo.funcion_id !== this.funcionId) return;
          this.ocupadas.update((s) => {
            const nuevo = new Set(s);
            nuevo.delete(viejo.butaca);
            return nuevo;
          });
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const estado = this.canal.presenceState<EstadoPresencia>();
        const otros = new Set<string>();
        for (const [clave, presencias] of Object.entries(estado)) {
          if (clave === this.miClave) continue;
          presencias.forEach((p) => p.butacas?.forEach((b) => otros.add(b)));
        }
        this.eligiendoOtros.set(otros);
      })
      .subscribe((estado) => {
        this.conectado.set(estado === 'SUBSCRIBED');
        if (estado === 'SUBSCRIBED') {
          this.canal.track({ butacas: [] });
        }
      });
  }

  /** Comparte con los demás las butacas que estoy eligiendo. */
  anunciar(butacas: string[]) {
    if (this.conectado()) {
      this.canal.track({ butacas });
    }
  }

  desconectar() {
    this.canal.untrack();
    this.sup.Supabase.removeChannel(this.canal);
  }
}

@Service()
export class ButacasEnVivo {
  private sup = inject(Supabase);

  abrir(funcionId: number): SalaEnVivo {
    return new SalaEnVivo(this.sup, funcionId);
  }
}
