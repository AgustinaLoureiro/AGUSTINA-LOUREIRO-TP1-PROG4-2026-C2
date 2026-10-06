export type Rol = 'cliente' | 'empleado' | 'admin';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
  rol: Rol;
  puntos: number;
  credito: number;
  creado_en: string;
}

export interface DatosRegistro {
  nombre: string;
  apellido: string;
  email: string;
  fecha_nacimiento: string;
  password: string;
}

export interface MovimientoPuntos {
  id: number;
  puntos: number;
  tipo: 'compra' | 'canje' | 'anulacion' | 'devolucion';
  detalle: string;
  creado_en: string;
}

export interface MovimientoCredito {
  id: number;
  monto: number;
  tipo: 'cancelacion' | 'uso';
  detalle: string;
  creado_en: string;
}

export interface Notificacion {
  id: number;
  titulo: string;
  cuerpo: string;
  url: string | null;
  leida: boolean;
  creada_en: string;
}

export interface Actividad {
  id: number;
  usuario_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  etiqueta: string | null;
  detalle: Record<string, unknown>;
  creado_en: string;
}

export interface FilaReporte {
  fecha: string;
  compras: number;
  entradas: number;
  facturado: number;
  cobrado_tarjeta: number;
  credito_aplicado: number;
}

export interface RankingPelicula {
  pelicula_id: number;
  titulo: string;
  poster_url: string | null;
  entradas: number;
}

export interface RankingProducto {
  producto_id: number;
  nombre: string;
  unidades: number;
}
