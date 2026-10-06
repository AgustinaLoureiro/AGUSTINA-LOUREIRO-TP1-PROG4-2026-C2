import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';

const BUCKET = 'imagenes';
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 3;

/** Subida de imágenes (pósters, productos) al bucket público de Supabase Storage. */
@Service()
export class Storage {
  private sup = inject(Supabase);

  async subirImagen(
    archivo: File,
    carpeta: 'posters' | 'fondos' | 'productos' | 'combos',
  ): Promise<string> {
    if (!TIPOS.includes(archivo.type)) {
      throw new Error('Formato no permitido. Usá JPG, PNG o WEBP.');
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      throw new Error(`La imagen supera los ${MAX_MB} MB.`);
    }
    const extension = archivo.type.split('/')[1];
    const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.sup.Stg.from(BUCKET).upload(ruta, archivo, {
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw error;
    return this.sup.Stg.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  }
}
