import { Clasificacion, CodigoFormato, Idioma } from './catalogo';
import { TipoButaca } from '../utils/butacas';

export interface Cantidad {
  id: number;
  cantidad: number;
}

/** Lo que el cliente pide comprar. Nunca incluye precios: los calcula la base. */
export interface SolicitudCompra {
  funcion_id: number;
  butacas: string[];
  productos: Cantidad[];
  combos: Cantidad[];
  recompensas: Cantidad[];
  cupon?: string | null;
  usar_credito?: boolean;
  email?: string;
  nombre?: string;
  declara_edad?: boolean;
  tarjeta_ultimos4?: string;
}

export interface EntradaCotizada {
  butaca: string;
  tipo: TipoButaca;
  precio: number;
  es_preventa: boolean;
  por_combo: boolean;
  por_puntos: boolean;
}

export interface ItemCotizado {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  por_puntos: boolean;
  combo_id?: number | null;
  producto_id?: number | null;
}

export interface Cotizacion {
  entradas: EntradaCotizada[];
  items: ItemCotizado[];
  canjes: { nombre: string; cantidad: number; puntos: number }[];
  subtotal_entradas: number;
  subtotal_candy: number;
  descuento_porcentaje: number;
  descuento_origen: string | null;
  descuento: number;
  total: number;
  credito_usado: number;
  a_pagar: number;
  puntos_usados: number;
  puntos_a_ganar: number;
  preventa: boolean;
  precio_base: number;
  aviso_edad: string | null;
  credito_disponible: number;
  puntos_disponibles: number;
}

export interface CompraConfirmada {
  compra_id: string;
  codigo: string;
  total: number;
  a_pagar: number;
  puntos_ganados: number;
}

/** Resultado de la RPC obtener_compra (confirmación, PDF y validación). */
export interface CompraDetalle {
  id: string;
  codigo: string;
  estado: 'pagada' | 'cancelada';
  email: string;
  nombre: string;
  creada_en: string;
  subtotal_entradas: number;
  subtotal_candy: number;
  descuento: number;
  descuento_origen: string | null;
  total: number;
  credito_usado: number;
  total_pagado: number;
  puntos_ganados: number;
  puntos_usados: number;
  entrada_validada_en: string | null;
  candy_entregado_en: string | null;
  funcion: {
    id: number;
    inicio: string;
    fin: string;
    formato: CodigoFormato;
    idioma: Idioma;
    sala: string;
  };
  pelicula: {
    id: number;
    titulo: string;
    poster_url: string | null;
    clasificacion: Clasificacion;
    duracion_min: number;
  };
  entradas: EntradaCotizada[];
  items: ItemCotizado[];
}

/** Compra listada en el perfil del usuario. */
export interface CompraResumen {
  id: string;
  codigo: string;
  estado: 'pagada' | 'cancelada';
  total: number;
  creada_en: string;
  entrada_validada_en: string | null;
  candy_entregado_en: string | null;
  funciones: {
    inicio: string;
    fin: string;
    formato: CodigoFormato;
    idioma: Idioma;
    salas: { nombre: string };
    peliculas: { id: number; titulo: string; poster_url: string | null };
  };
  entradas: { butaca: string; tipo: TipoButaca }[];
}

export interface ResultadoValidacion {
  ok: boolean;
  motivo: string;
  compra?: CompraDetalle;
}

/** Función del día vista por el personal de sala y candy. */
export interface FuncionDelDia {
  id: number;
  inicio: string;
  fin: string;
  formato: string;
  idioma: string;
  salas: { nombre: string };
  peliculas: { titulo: string; poster_url: string | null; clasificacion: string };
  compras: number;
  ingresaron: number;
  conCandy: number;
  candyEntregado: number;
}
