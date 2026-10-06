import { computed, Service, signal } from '@angular/core';

/** Indicador global de carga para las peticiones HTTP (lo maneja un interceptor). */
@Service()
export class Carga {
  private pendientes = signal(0);
  readonly activa = computed(() => this.pendientes() > 0);

  iniciar() {
    this.pendientes.update((n) => n + 1);
  }

  terminar() {
    this.pendientes.update((n) => Math.max(0, n - 1));
  }
}

export type TipoAviso = 'ok' | 'error' | 'info';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

/** Mensajes flotantes ("toasts") para confirmar acciones o informar errores. */
@Service()
export class Avisos {
  readonly lista = signal<Aviso[]>([]);
  private proximoId = 1;

  mostrar(texto: string, tipo: TipoAviso = 'info', duracionMs = 4500) {
    const id = this.proximoId++;
    this.lista.update((l) => [...l, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), duracionMs);
  }

  ok(texto: string) {
    this.mostrar(texto, 'ok');
  }

  error(texto: string) {
    this.mostrar(texto, 'error', 7000);
  }

  cerrar(id: number) {
    this.lista.update((l) => l.filter((a) => a.id !== id));
  }
}
