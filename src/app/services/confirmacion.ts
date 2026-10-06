import { Service, signal } from '@angular/core';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  aceptar?: string;
  cancelar?: string;
  /** Acción destructiva: el botón de aceptar se muestra en rojo. */
  peligro?: boolean;
}

interface Pedido extends OpcionesConfirmacion {
  resolver: (respuesta: boolean) => void;
}

/**
 * Reemplaza al confirm() del navegador por un diálogo con la estética de la app.
 * Uso: if (!(await this.confirmacion.pedir({ titulo, mensaje }))) return;
 */
@Service()
export class Confirmacion {
  readonly actual = signal<Pedido | null>(null);

  pedir(opciones: OpcionesConfirmacion): Promise<boolean> {
    return new Promise((resolver) => {
      this.actual()?.resolver(false);
      this.actual.set({ ...opciones, resolver });
    });
  }

  responder(respuesta: boolean) {
    const pedido = this.actual();
    this.actual.set(null);
    pedido?.resolver(respuesta);
  }
}
