export type Rol = 'cliente' | 'empleado' | 'admin';

export const TIPOS_SANGRE = ['0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
export const COLORES_OJOS = [
  'Marrones',
  'Negros',
  'Verdes',
  'Azules',
  'Grises',
  'Miel',
  'Otro',
] as const;

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
  tipo_sangre: string | null;
  color_ojos: string | null;
  dias_vacaciones: number | null;
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
  tipo_sangre: string;
  color_ojos: string;
  dias_vacaciones: number;
  password: string;
}

/** Datos que el cliente puede completar o cambiar desde su perfil. */
export interface DatosPerfil {
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
  tipo_sangre: string | null;
  color_ojos: string | null;
  dias_vacaciones: number | null;
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
