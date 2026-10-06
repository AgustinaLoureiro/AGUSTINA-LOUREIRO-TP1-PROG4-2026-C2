export type Clasificacion = 'ATP' | '+13' | '+18';
export type CodigoFormato = '2D' | '3D' | '4D' | '5D';
export type Idioma = 'CAST' | 'SUBT';

export interface Genero {
  id: number;
  nombre: string;
}

/** Fila de la tabla `peliculas` (lo que edita el admin). */
export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  poster_url: string | null;
  fondo_url: string | null;
  trailer_youtube: string | null;
  clasificacion: Clasificacion;
  fecha_estreno: string;
  visible: boolean;
  preventa_habilitada: boolean;
  preventa_dias: number;
  preventa_descuento: number;
  tmdb_id: number | null;
  pelicula_generos?: { genero_id: number }[];
}

export type PeliculaPorGuardar = Omit<Pelicula, 'id' | 'pelicula_generos'>;

/** Fila de la vista pública `v_peliculas` (datos calculados por la base). */
export interface PeliculaPublica {
  id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  poster_url: string | null;
  fondo_url: string | null;
  trailer_youtube: string | null;
  clasificacion: Clasificacion;
  fecha_estreno: string;
  preventa_habilitada: boolean;
  preventa_dias: number;
  preventa_descuento: number;
  venta_desde: string;
  en_preventa: boolean;
  proximamente: boolean;
  promedio: number;
  cantidad_resenas: number;
  vendidas: number;
  generos: string[];
  tiene_funciones: boolean;
}

export interface Formato {
  codigo: CodigoFormato;
  nombre: string;
  precio: number;
}

export interface Sala {
  id: number;
  nombre: string;
  activa: boolean;
  butacas_inhabilitadas: string[];
  /** Formatos que puede proyectar (2D siempre). */
  formatos: CodigoFormato[];
}

export interface Funcion {
  id: number;
  pelicula_id: number;
  sala_id: number;
  inicio: string;
  fin: string;
  formato: CodigoFormato;
  idioma: Idioma;
  precio: number;
  activa: boolean;
  /** Programación en la que se creó (todas las de una misma programación comparten tanda). */
  tanda: string | null;
  creado_en: string;
  salas?: { nombre: string; butacas_inhabilitadas?: string[] };
  peliculas?: Pick<Pelicula, 'id' | 'titulo' | 'poster_url' | 'clasificacion' | 'duracion_min'>;
}

export interface ResultadoProgramacion {
  horario: string;
  sala_asignada: string | null;
  resultado: 'ok' | 'sin_sala' | 'pasado' | 'antes_del_estreno';
}

export interface Resena {
  id: number;
  pelicula_id: number;
  usuario_id: string;
  autor: string;
  estrellas: number;
  comentario: string;
  creado_en: string;
}
