/**
 * Carga la librería de QR bajo demanda.
 * "qrcode" es un paquete CommonJS: en desarrollo sus funciones llegan directo,
 * pero en el build de producción quedan dentro de `default`. Se contemplan los dos casos.
 */
export async function cargarQr() {
  const modulo = await import('qrcode');
  return (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
}
