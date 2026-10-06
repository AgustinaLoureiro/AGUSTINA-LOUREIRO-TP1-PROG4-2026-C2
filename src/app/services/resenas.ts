import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';
import { Resena } from '../interfaces/catalogo';

@Service()
export class Resenas {
  private sup = inject(Supabase);
  private tabla = () => this.sup.Supabase.from('resenas');

  async dePelicula(peliculaId: number): Promise<Resena[]> {
    const { data, error } = await this.tabla()
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return data as Resena[];
  }

  async misCalificaciones(usuarioId: string): Promise<Resena[]> {
    const { data, error } = await this.tabla().select('*').eq('usuario_id', usuarioId);
    if (error) throw error;
    return data as Resena[];
  }

  /** Una reseña por persona y película: si ya existe, se actualiza. */
  async guardar(peliculaId: number, usuarioId: string, estrellas: number, comentario: string) {
    const { error } = await this.tabla().upsert(
      { pelicula_id: peliculaId, usuario_id: usuarioId, estrellas, comentario },
      { onConflict: 'pelicula_id,usuario_id' },
    );
    if (error) throw error;
  }

  async eliminar(id: number) {
    const { error } = await this.tabla().delete().eq('id', id);
    if (error) throw error;
  }
}
