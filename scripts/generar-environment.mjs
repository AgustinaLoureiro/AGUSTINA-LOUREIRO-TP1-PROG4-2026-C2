// Genera src/environments/environment*.ts a partir de variables de entorno.
// - En Vercel: las variables se cargan en Project Settings > Environment Variables.
// - En local: se pueden poner en un archivo .env (ver .env.example).
// Si no hay variables pero los archivos ya existen, se usan los archivos locales.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = 'src/environments';
const ARCHIVOS = ['environment.ts', 'environment.development.ts'];

if (existsSync('.env')) {
  for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const { SUPABASE_URL, SUPABASE_KEY, TMDB_API_KEY = '', VAPID_PUBLIC_KEY = '' } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  if (ARCHIVOS.every((a) => existsSync(`${DIR}/${a}`))) {
    console.log(
      '[env] Sin variables de entorno: se usan los archivos locales de src/environments.',
    );
    process.exit(0);
  }
  console.error(
    '[env] Faltan SUPABASE_URL y SUPABASE_KEY. Definilas como variables de entorno ' +
      'o copiá src/environments/environment.example.ts.',
  );
  process.exit(1);
}

const contenido = (
  produccion,
) => `// Archivo generado por scripts/generar-environment.mjs. No editar ni subir a Git.
export const environment = {
  production: ${produccion},
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_KEY: '${SUPABASE_KEY}',
  TMDB_API_KEY: '${TMDB_API_KEY}',
  VAPID_PUBLIC_KEY: '${VAPID_PUBLIC_KEY}',
};
`;

writeFileSync(`${DIR}/environment.ts`, contenido(true));
writeFileSync(`${DIR}/environment.development.ts`, contenido(false));
console.log('[env] environment.ts y environment.development.ts generados.');
