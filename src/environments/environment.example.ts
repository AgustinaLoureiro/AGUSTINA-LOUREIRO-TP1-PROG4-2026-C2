// Plantilla de configuración. Copiar como environment.ts y environment.development.ts
// (o definir las variables de entorno y correr `npm run env`).
// Los archivos reales están en .gitignore: nunca se suben claves al repositorio.
export const environment = {
  production: false,
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_KEY: 'sb_publishable_xxxxxxxxxxxxxxxx',
  TMDB_API_KEY: 'tu-api-key-de-tmdb',
  VAPID_PUBLIC_KEY: '',
};
