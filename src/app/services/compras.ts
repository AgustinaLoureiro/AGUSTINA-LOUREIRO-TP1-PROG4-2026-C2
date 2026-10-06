import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';
import {
  CompraConfirmada,
  CompraDetalle,
  CompraResumen,
  FuncionDelDia,
  Cotizacion,
  SolicitudCompra,
} from '../interfaces/compra';
import { MovimientoCredito, MovimientoPuntos } from '../interfaces/usuario';

/**
 * Compras de entradas y candy. Toda la lógica de precios, descuentos, puntos,
 * crédito y validaciones vive en la RPC procesar_compra (PostgreSQL), así el
 * cliente no puede manipular montos.
 */
@Service()
export class Compras {
  private sup = inject(Supabase);

  async cotizar(solicitud: SolicitudCompra): Promise<Cotizacion> {
    const { data, error } = await this.sup.Supabase.rpc('procesar_compra', {
      p: solicitud,
      p_confirmar: false,
    });
    if (error) throw error;
    return data as Cotizacion;
  }

  async confirmar(solicitud: SolicitudCompra): Promise<CompraConfirmada> {
    const { data, error } = await this.sup.Supabase.rpc('procesar_compra', {
      p: solicitud,
      p_confirmar: true,
    });
    if (error) throw error;
    return data as CompraConfirmada;
  }

  async obtener(codigo: string): Promise<CompraDetalle | null> {
    const { data, error } = await this.sup.Supabase.rpc('obtener_compra', { p_codigo: codigo });
    if (error) throw error;
    return data as CompraDetalle | null;
  }

  async misCompras(usuarioId: string): Promise<CompraResumen[]> {
    const { data, error } = await this.sup.Supabase.from('compras')
      .select(
        'id, codigo, estado, total, creada_en, entrada_validada_en, candy_entregado_en, ' +
          'funciones(inicio, fin, formato, idioma, salas(nombre), peliculas(id, titulo, poster_url)), ' +
          'entradas(butaca, tipo)',
      )
      .eq('usuario_id', usuarioId)
      .order('creada_en', { ascending: false });
    if (error) throw error;
    return data as unknown as CompraResumen[];
  }

  async cancelar(compraId: string): Promise<number> {
    const { data, error } = await this.sup.Supabase.rpc('cancelar_compra', {
      p_compra_id: compraId,
    });
    if (error) throw error;
    return (data as { credito_devuelto: number }).credito_devuelto;
  }

  async movimientosPuntos(usuarioId: string): Promise<MovimientoPuntos[]> {
    const { data, error } = await this.sup.Supabase.from('movimientos_puntos')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data as MovimientoPuntos[];
  }

  /**
   * Para el personal: funciones del día de cine (06:00 a 06:00) con cuántas compras
   * ya ingresaron a la sala y cuántas retiraron el candy.
   */
  async funcionesDeHoy(): Promise<FuncionDelDia[]> {
    const desde = new Date();
    if (desde.getHours() < 6) desde.setDate(desde.getDate() - 1);
    desde.setHours(6, 0, 0, 0);
    const hasta = new Date(desde.getTime() + 86_400_000);
    const { data, error } = await this.sup.Supabase.from('funciones')
      .select(
        'id, inicio, fin, formato, idioma, salas(nombre), peliculas(titulo, poster_url, clasificacion), ' +
          'compras(estado, entrada_validada_en, candy_entregado_en, compra_items(count))',
      )
      .eq('activa', true)
      .gte('inicio', desde.toISOString())
      .lt('inicio', hasta.toISOString())
      .order('inicio');
    if (error) throw error;
    type Fila = Omit<FuncionDelDia, 'compras' | 'ingresaron' | 'conCandy' | 'candyEntregado'> & {
      compras: {
        estado: string;
        entrada_validada_en: string | null;
        candy_entregado_en: string | null;
        compra_items: { count: number }[];
      }[];
    };
    return (data as unknown as Fila[]).map((f) => {
      const pagadas = f.compras.filter((c) => c.estado === 'pagada');
      return {
        ...f,
        compras: pagadas.length,
        ingresaron: pagadas.filter((c) => c.entrada_validada_en).length,
        conCandy: pagadas.filter((c) => c.compra_items?.[0]?.count).length,
        candyEntregado: pagadas.filter((c) => c.candy_entregado_en).length,
      };
    });
  }

  async movimientosCredito(usuarioId: string): Promise<MovimientoCredito[]> {
    const { data, error } = await this.sup.Supabase.from('movimientos_credito')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data as MovimientoCredito[];
  }
}
