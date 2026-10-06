import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom, map, Observable } from 'rxjs';
import { TMDB_URL } from '../interceptors/tmdb-interceptor';
import { Clasificacion } from '../interfaces/catalogo';

export interface ResultadoTmdb {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
}

interface RespuestaBusqueda {
  results: ResultadoTmdb[];
}

interface DetalleTmdb {
  id: number;
  title: string;
  overview: string;
  runtime: number;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name: string }[];
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { certification: string }[] }[];
  };
  videos?: { results: { site: string; type: string; key: string }[] };
}

export interface PeliculaImportada {
  tmdb_id: number;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  fecha_estreno: string;
  poster_url: string | null;
  fondo_url: string | null;
  trailer_youtube: string | null;
  clasificacion: Clasificacion;
  generos: string[];
}

const IMG = 'https://image.tmdb.org/t/p';

/**
 * Importa datos de películas desde TMDB para que el admin no tenga que cargarlos a mano.
 * La API key la agrega tmdbInterceptor.
 */
@Service()
export class Tmdb {
  private http = inject(HttpClient);

  buscar(texto: string): Observable<ResultadoTmdb[]> {
    return this.http
      .get<RespuestaBusqueda>(`${TMDB_URL}/search/movie`, {
        params: { query: texto, region: 'AR' },
      })
      .pipe(map((r) => r.results.slice(0, 8)));
  }

  async detalle(id: number): Promise<PeliculaImportada> {
    const d = await firstValueFrom(
      this.http.get<DetalleTmdb>(`${TMDB_URL}/movie/${id}`, {
        params: { append_to_response: 'release_dates,videos' },
      }),
    );
    const trailer = d.videos?.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
    return {
      tmdb_id: d.id,
      titulo: d.title,
      sinopsis: d.overview,
      duracion_min: d.runtime || 100,
      fecha_estreno: d.release_date,
      poster_url: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
      fondo_url: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
      trailer_youtube: trailer?.key ?? null,
      clasificacion: this.clasificacion(d),
      generos: d.genres.map((g) => g.name),
    };
  }

  /**
   * El cliente solo maneja ATP, +13 y +18. Las calificaciones intermedias (+16 en
   * Argentina, R en EE.UU.) se redondean hacia arriba para no habilitar a menores.
   */
  private clasificacion(d: DetalleTmdb): Clasificacion {
    const paises = d.release_dates?.results ?? [];
    const de = (pais: string) =>
      paises
        .find((p) => p.iso_3166_1 === pais)
        ?.release_dates.map((r) => r.certification)
        .find(Boolean);
    const ar = de('AR');
    if (ar) {
      if (/18|16|C/.test(ar)) return '+18';
      if (/13/.test(ar)) return '+13';
      return 'ATP';
    }
    const us = de('US');
    if (us === 'R' || us === 'NC-17') return '+18';
    if (us === 'PG-13') return '+13';
    return 'ATP';
  }
}
