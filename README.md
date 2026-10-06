# CineCorn 🍿

> No es solo un cine, es el plan perfecto.

Sistema web para un cine de un solo edificio con varias salas: cartelera, compra de entradas con
elección de butacas en tiempo real, candy bar, entrada en PDF con QR, programa de puntos y un panel
de administración completo. Trabajo Práctico N.º 1 de Programación IV (UTN · 2026).

- **Sitio desplegado:** https://agustina-loureiro-tp-1-prog-4-2026.vercel.app/
- **Requerimientos relevados:** [docs/requerimientos.md](docs/requerimientos.md)

---

## Stack

| Capa          | Tecnología                                                                            |
| ------------- | ------------------------------------------------------------------------------------- |
| Front-end     | Angular 22 (standalone, signals, zoneless, OnPush por defecto)                        |
| Back-end      | Supabase: PostgreSQL + RLS, Auth, Realtime, Storage, Edge Functions                   |
| PWA           | `@angular/service-worker` + Web App Manifest + Web Push                               |
| Integraciones | TMDB (datos de películas), jsPDF + qrcode (entrada), jsQR (lector), Chart.js, ExcelJS |
| Hosting       | Vercel                                                                                |

## Cómo correrlo

```bash
npm install
cp .env.example .env        # completar SUPABASE_URL, SUPABASE_KEY y TMDB_API_KEY
npm start                   # genera src/environments y levanta ng serve
npm test                    # tests unitarios (Vitest)
npm run build               # build de producción con service worker
```

**Base de datos:** en Supabase › SQL Editor ejecutar, en orden:

1. `supabase/01_esquema.sql` — tablas, reglas de negocio (funciones PL/pgSQL), RLS, Realtime y Storage.
   Se puede volver a correr: borra y recrea las tablas de la aplicación (las cuentas de usuario se conservan).
2. _(Opcional)_ `supabase/02_datos_ejemplo.sql` — salas, candy, combos, beneficios y cupones. Las películas se cargan desde el panel (importando sus datos de TMDB).

El usuario `administrador@cinecorn.com.ar` recibe el rol **admin** automáticamente al registrarse.
Los empleados se registran normalmente y el admin les asigna el rol desde _Usuarios y roles_.

### Variables de entorno

Las claves **no se suben al repositorio**: `src/environments/environment*.ts` y `.env` están en
`.gitignore`. El script `scripts/generar-environment.mjs` crea esos archivos a partir de variables de
entorno (en Vercel: _Project Settings › Environment Variables_) o del `.env` local. La plantilla sin
claves está en `src/environments/environment.example.ts`.

| Variable                       | Uso                                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_KEY` | Cliente de Supabase (clave _publishable_: la seguridad la da RLS) |
| `VAPID_PUBLIC_KEY`             | Opcional: notificaciones push fuera de la app                     |

---

## Arquitectura

```
src/app
├── layouts/publico        Layout del sitio (barra, campana de notificaciones, pie)
├── pages/                 Una carpeta por pantalla (cada una se carga en forma diferida)
│   ├── home, cartelera, proximamente, pelicula, comprar, compra-confirmada,
│   │   login, register, perfil, mis-peliculas, no-encontrada
│   ├── admin/             Módulo de administración (admin.routes.ts, layout propio)
│   │   └── reportes, peliculas, pelicula-form, funciones, salas, candy,
│   │       fidelizacion, usuarios, actividad
│   └── empleado/          Validación de QR para el personal
├── components/            Piezas reutilizables: mapa-butacas, estrellas, campo-fecha,
│                          tira-dias, tarjeta-pelicula, codigo-qr, grafico-barras, errores-campo, avisos
├── services/              Acceso a datos (Supabase, TMDB) y servicios de UI
├── guards/                authGuard, invitadoGuard, roleGuard(roles)
├── interceptors/          tmdbInterceptor (API key) y cargaInterceptor (barra de carga)
├── pipes/                 precio, duracion, codigo, idioma, tiempoRelativo, youtube
├── directives/            *appSiRol (estructural), appSoloNumeros, appImagenRespaldo
├── interfaces/            Tipos del dominio
└── utils/                 Distribución de butacas, fechas, validadores, errores
supabase/
├── 01_esquema.sql         Modelo de datos + lógica de negocio + seguridad
├── 02_datos_ejemplo.sql   Datos de ejemplo
└── functions/notificar-push   Edge Function de Web Push
```

### La lógica de negocio vive en la base

Las reglas críticas no pueden depender del navegador, porque cualquiera puede modificar el
JavaScript. Por eso están en funciones de PostgreSQL (`security definer`) que la app invoca vía RPC:

| RPC                                | Qué garantiza                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `programar_funciones`              | Asigna sala automáticamente entre las salas equipadas para el formato (2D en todas; 3D, 4D y 5D según cada sala): todas las funciones del día de una versión en **una sola sala** (un cartel), priorizando la sala donde ya está y las más ocupadas para dejar salas libres. Nunca superpone funciones (duración + 30 min de limpieza) y respeta la fecha de estreno |
| `procesar_compra`                  | Calcula **todos** los precios (preventa, VIP, combos, cupones, crédito, canjes de puntos), valida edad y butacas, y confirma en una transacción                                                                                                                                                                                                                      |
| `cancelar_compra`                  | Hasta 2 h antes; devuelve el importe como crédito y revierte puntos                                                                                                                                                                                                                                                                                                  |
| `validar_codigo`                   | Valida el QR para sala o candy una sola vez, en la franja horaria correcta                                                                                                                                                                                                                                                                                           |
| `procesar_alertas`                 | Genera notificaciones cuando abre la venta de un estreno                                                                                                                                                                                                                                                                                                             |
| `reporte_facturacion`, `ranking_*` | Reportes del admin                                                                                                                                                                                                                                                                                                                                                   |

El cliente nunca envía montos: manda _qué_ quiere comprar y la base devuelve la cotización. La misma
función cotiza (`p_confirmar = false`) y confirma, así lo que se muestra es exactamente lo que se cobra.

**"Bajo ningún término dos funciones en la misma sala al mismo tiempo"** se garantiza con una
restricción de exclusión de PostgreSQL sobre el rango horario de cada función:

```sql
exclude using gist (sala_id with =, bloque with &&) where (activa)
```

Aunque dos administradores programen a la vez, la base rechaza cualquier superposición.

### Seguridad

- **RLS en todas las tablas.** Catálogo de lectura pública y escritura solo para `admin`; compras
  visibles solo para su dueño y el personal; cupones y log solo para el admin.
- Los usuarios solo pueden editar su nombre y apellido (permisos por columna): puntos, crédito, rol y
  fecha de nacimiento no se pueden alterar desde el cliente.
- Los guards de Angular mejoran la experiencia, pero la autorización real está en la base.
- La ocupación de butacas se publica en una tabla aparte (`butacas_ocupadas`) sin datos personales,
  para poder emitirla por Realtime a cualquier visitante.

### Tiempo real

- **Postgres Changes** sobre `butacas_ocupadas`: una butaca vendida desaparece al instante del plano de
  todos los que están comprando. Si alguien vende una butaca que yo tenía elegida, se quita y se avisa.
- **Presence**: cada cliente comparte las butacas que está eligiendo; los demás las ven "en elección".
- **Notificaciones**: la campana se actualiza sola cuando abre la venta de un estreno con alerta.

### Log de actividad

Un trigger genérico (`registrar_actividad`) registra altas, bajas y modificaciones de películas,
funciones, salas, precios, configuración, candy, cupones y recompensas, guardando valor anterior y
nuevo. Las RPC registran además validaciones de QR, cambios de rol, cancelaciones y programaciones.

---

## Decisiones de diseño y de producto

### Requerimientos interpretados

El cliente se comunica por mail y algunos pedidos no tienen sentido para un cine. Se tomaron estas
decisiones (detalle en [docs/requerimientos.md](docs/requerimientos.md)):

- **Registro mínimo:** email, nombre, apellido y fecha de nacimiento. La fecha es necesaria para las
  restricciones +13/+18 y los cupones para mayores de 50. **Tipo de sangre, color de ojos y días de
  vacaciones no se piden**: no aportan al negocio y serían datos personales innecesarios.
- **Pago simulado** con validación real de tarjeta (Luhn y vencimiento); solo se guardan los últimos 4 dígitos.
- **Clasificación:** el cliente usa ATP, +13 y +18. Al importar desde TMDB, +16 y "R" se redondean a +18
  para nunca habilitar a menores.
- **Películas desde TMDB, guardadas en Supabase:** la API solo completa el formulario del admin
  (HttpClient + interceptor que agrega la clave). Al guardar, la película queda en la base y el sitio
  la lee siempre desde Supabase; sinopsis y póster son obligatorios.
- **Filas J y K:** se fusionaron en una única fila accesible rotulada "J" (2 · 10 · 2 butacas, más anchas).
- **Mapa del cine:** el cliente dijo que no tenía luz verde; no se implementó.
- **Puntos:** 1 punto por peso efectivamente pagado (no por el crédito usado, para evitar ganar dos veces
  con una compra cancelada). Los valores de canje son configurables.
- **Combos:** siempre incluyen una entrada; el recargo VIP se cobra igual si la butaca es VIP.
- **Preventa:** configurable por película (días antes del estreno y porcentaje de descuento). Sin
  preventa, la venta abre el día del estreno.

### Interfaz

- **Tres estéticas** sobre el mismo sistema de componentes (variables CSS):
  público "Marquesina" (telón, rayos y luces de marquesina, sin animaciones), admin "Cabina de proyección" (claro,
  técnico, tipografía mono) y empleados "Boletería" (alto contraste, botones grandes, pensado para celular).
- **Sin calendarios desplegables** (pedido explícito): las fechas se eligen con tiras de días, chips de
  atajos ("Hoy", "+1 semana") o casilleros DD/MM/AAAA que avanzan solos; los horarios, tocando hora y minutos.
- Accesibilidad: foco visible, `aria-*` en los controles personalizados,
  estados vacíos y de carga en todas las pantallas.

## Temas de la cursada aplicados

| Clase                       | Dónde                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Componentes, bindeos, ruteo | Toda la app; `withComponentInputBinding` para parámetros de ruta                               |
| Lazy loading y rutas hijas  | `loadComponent` por página y `loadChildren` para `/admin`                                      |
| Ciclo de vida               | `ngOnInit` / `ngOnDestroy` (conexión y desconexión de canales Realtime y cámara)               |
| Signals                     | Estado de todas las pantallas (`signal`, `computed`, `effect`, `input`, `output`, `viewChild`) |
| input / output              | `mapa-butacas`, `estrellas`, `tira-dias`, `campo-fecha`, `tarjeta-pelicula`                    |
| Servicios e HttpClient      | `@Service()` + `inject()`; TMDB con HttpClient y RxJS (`debounceTime`, `switchMap`)            |
| Formularios reactivos       | Registro, compra, admin; `FormGroup` anidados, `FormArray` (horarios y combos)                 |
| Validaciones propias        | Luhn, vencimiento, fecha real, edad, contraseñas iguales, solo letras                          |
| Supabase Auth               | Registro con metadata, login, `onAuthStateChange`, guards por rol                              |
| Base de datos y RLS         | Ver _Seguridad_                                                                                |
| Realtime                    | Butacas en vivo (Postgres Changes + Presence) y notificaciones                                 |
| Storage                     | Subida de pósters e imágenes de productos                                                      |
| Pipes                       | 6 pipes propios + `date` con locale es-AR                                                      |
| Directivas                  | Estructural `*appSiRol`, `appSoloNumeros` (bloquea negativos y letras), `appImagenRespaldo`    |
| Interceptors                | API key de TMDB y barra de carga global                                                        |
| PWA                         | Service worker con caché de pósters, manifest, íconos maskable, aviso de nueva versión         |
| Notificaciones push         | `SwPush` + Edge Function `notificar-push` disparada por webhook                                |

## Tests

`npm test` corre 26 tests unitarios (Vitest): distribución de butacas, validadores propios, pipes y
creación de componentes. Las reglas de negocio de la base (edad, preventa, cupones, combos, canjes,
crédito, doble venta y solapamiento de funciones) se verificaron ejecutando las RPC sobre PostgreSQL.
