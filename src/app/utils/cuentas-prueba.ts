/**
 * Cuentas de prueba para que los docentes recorran la app con cada rol
 * y prueben las restricciones de edad (+13 / +18).
 * Son cuentas de demostración, por eso sus credenciales pueden estar en el código.
 */
export const CUENTAS_PRUEBA = [
  { etiqueta: 'ADMINISTRADOR', email: 'administrador@cinecorn.com.ar', password: 'MessiGoat10' },
  { etiqueta: 'EMPLEADO', email: 'aloureiro@cinecorn.com.ar', password: 'Loureiro800' },
  { etiqueta: 'CLIENTE +18', email: 'agusloureiro@hotmail.com', password: 'Aaaa1234' },
  { etiqueta: 'CLIENTE +13', email: 'luliconosciuto@hotmail.com', password: 'Lucia1234' },
  { etiqueta: 'CLIENTE MENOR', email: 'feliferrero@hotmail.com', password: 'Felipe1234' },
] as const;
