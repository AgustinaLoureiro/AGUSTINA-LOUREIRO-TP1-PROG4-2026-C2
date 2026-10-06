export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen_url: string | null;
  activo: boolean;
}

export interface ComboProducto {
  producto_id: number;
  cantidad: number;
  productos?: { nombre: string };
}

export interface Combo {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen_url: string | null;
  activo: boolean;
  combo_productos: ComboProducto[];
}

export interface Recompensa {
  id: number;
  nombre: string;
  tipo: 'entrada' | 'producto';
  producto_id: number | null;
  puntos: number;
  activa: boolean;
}

export interface Cupon {
  id: number;
  codigo: string;
  descripcion: string;
  porcentaje: number;
  edad_minima: number | null;
  desde: string | null;
  hasta: string | null;
  activo: boolean;
}

export interface Configuracion {
  id: 1;
  descuento_primera_compra: number;
  recargo_vip: number;
  minutos_limpieza: number;
  horas_limite_cancelacion: number;
  puntos_por_peso: number;
  max_entradas_por_compra: number;
}
