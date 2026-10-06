// Traduce errores de Supabase/PostgreSQL a mensajes entendibles para el usuario.
// Las RPC de negocio ya lanzan mensajes en castellano (raise exception), así que
// solo se traducen los códigos genéricos de la base y de Auth.

interface ErrorConCodigo {
  code?: string;
  message?: string;
}

const POR_CODIGO: Record<string, string> = {
  '23P01': 'Ya hay otra función en esa sala en ese horario.',
  '23505': 'Ya existe un registro con esos datos.',
  '23503': 'No se puede eliminar: hay datos que dependen de este registro (por ejemplo, ventas).',
  '23514': 'Algún dato no cumple las reglas permitidas.',
  '42501': 'No tenés permisos para hacer esta acción.',
  PGRST116: 'No se encontró el registro.',
};

const POR_MENSAJE: [RegExp, string][] = [
  [/Invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/Email not confirmed/i, 'Tenés que confirmar tu email antes de ingresar.'],
  [/User already registered/i, 'Ya existe una cuenta con ese email.'],
  [/Password should be at least/i, 'La contraseña es demasiado corta.'],
  [/rate limit/i, 'Demasiados intentos. Esperá unos minutos.'],
  [/Failed to fetch|NetworkError/i, 'No hay conexión. Revisá tu internet e intentá de nuevo.'],
];

export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string {
  if (!error) return porDefecto;
  const e = error as ErrorConCodigo;
  if (e.code && e.code in POR_CODIGO && e.code !== 'P0001') return POR_CODIGO[e.code];
  const msg = e.message ?? String(error);
  for (const [regex, texto] of POR_MENSAJE) {
    if (regex.test(msg)) return texto;
  }
  return msg || porDefecto;
}
