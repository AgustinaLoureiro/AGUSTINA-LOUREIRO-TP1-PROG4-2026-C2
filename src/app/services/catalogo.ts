import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';
import { Formato, Funcion, Genero, PeliculaPublica } from '../interfaces/catalogo';
import { Combo, Configuracion, Producto, Categoria, Recompensa } from '../interfaces/candy';

/** Lecturas públicas: cartelera, funciones y candy bar. */
@Service()
export class Catalogo {
  private sup = inject(Supabase);

  async peliculas(): Promise<PeliculaPublica[]> {
    const { data, error } = await this.sup.Supabase.from('v_peliculas')
      .select('*')
      .order('fecha_estreno', { ascending: false });
    if (error) throw error;
    return data as PeliculaPublica[];
  }

  async pelicula(id: number): Promise<PeliculaPublica | null> {
    const { data, error } = await this.sup.Supabase.from('v_peliculas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as PeliculaPublica | null;
  }

  /** Las más vendidas entre las que hoy están en cartelera. */
  async masVendidas(cantidad = 3): Promise<PeliculaPublica[]> {
    const { data, error } = await this.sup.Supabase.from('v_peliculas')
      .select('*')
      .eq('proximamente', false)
      .eq('tiene_funciones', true)
      .order('vendidas', { ascending: false })
      .order('promedio', { ascending: false })
      .limit(cantidad);
    if (error) throw error;
    return data as PeliculaPublica[];
  }

  async generos(): Promise<Genero[]> {
    const { data, error } = await this.sup.Supabase.from('generos').select('*').order('nombre');
    if (error) throw error;
    return data as Genero[];
  }

  async funcionesDe(peliculaId: number): Promise<Funcion[]> {
    const { data, error } = await this.sup.Supabase.from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId)
      .eq('activa', true)
      .gt('inicio', new Date().toISOString())
      .order('inicio');
    if (error) throw error;
    return data as Funcion[];
  }

  async funcion(id: number): Promise<Funcion | null> {
    const { data, error } = await this.sup.Supabase.from('funciones')
      .select(
        '*, salas(nombre, butacas_inhabilitadas), peliculas(id, titulo, poster_url, clasificacion, duracion_min)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as Funcion | null;
  }

  async formatos(): Promise<Formato[]> {
    const { data, error } = await this.sup.Supabase.from('formatos').select('*').order('precio');
    if (error) throw error;
    return data as Formato[];
  }

  async configuracion(): Promise<Configuracion> {
    const { data, error } = await this.sup.Supabase.from('configuracion').select('*').single();
    if (error) throw error;
    return data as Configuracion;
  }

  async categorias(): Promise<Categoria[]> {
    const { data, error } = await this.sup.Supabase.from('categorias').select('*').order('orden');
    if (error) throw error;
    return data as Categoria[];
  }

  async productosActivos(): Promise<Producto[]> {
    const { data, error } = await this.sup.Supabase.from('productos')
      .select('*')
      .eq('activo', true)
      .order('precio');
    if (error) throw error;
    return data as Producto[];
  }

  async combosActivos(): Promise<Combo[]> {
    const { data, error } = await this.sup.Supabase.from('combos')
      .select('*, combo_productos(producto_id, cantidad, productos(nombre))')
      .eq('activo', true)
      .order('precio');
    if (error) throw error;
    return data as Combo[];
  }

  async recompensasActivas(): Promise<Recompensa[]> {
    const { data, error } = await this.sup.Supabase.from('recompensas')
      .select('*')
      .eq('activa', true)
      .order('puntos');
    if (error) throw error;
    return data as Recompensa[];
  }
}
