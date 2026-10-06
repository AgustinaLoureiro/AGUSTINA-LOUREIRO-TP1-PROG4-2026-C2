# CineCorn · Documento de requerimientos

Relevamiento de los pedidos del cliente (intercambio de mails del 01/01/2020 al 10/03/2020),
ordenado por tema. Cada requerimiento indica su origen, cómo se resolvió y, cuando corresponde,
qué se interpretó o descartó y por qué.

**Estados:** ✅ implementado · 🔄 implementado con interpretación · ⛔ descartado (con motivo)

---

## 1. Usuarios y acceso

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| U1 | Registro de usuarios | 01/01 | 🔄 | Se piden **email, nombre, apellido, fecha de nacimiento y contraseña**. |
| U2 | Datos: tipo de sangre, color de ojos, días de vacaciones | 01/01 | ⛔ | No tienen relación con el negocio de un cine. Pedirlos expone datos personales sensibles (el tipo de sangre es un dato de salud) sin finalidad, contrario al principio de minimización de la Ley 25.326 de Protección de Datos Personales. |
| U3 | Comprar sin registrarse ("anónimos") | 01/01 | ✅ | Compra como invitado indicando nombre y email. No suma puntos ni puede cancelar (no hay cuenta donde acreditar). |
| U4 | Beneficio por registrarse: 20 % en la primera compra | 01/01 | ✅ | Se aplica solo en la primera compra del usuario. |
| U5 | El porcentaje del cupón de primera compra es configurable | 30/01 | ✅ | Admin › Precios y beneficios. |
| U6 | Usuario administrador que controla todo | 06/02 | ✅ | `administrador@cinecorn.com.ar` recibe el rol admin al registrarse. Panel en `/admin` con estética propia. |
| U7 | Usuarios empleados que escanean QR (sala y candy bar) | 06/02 | ✅ | Rol `empleado`, asignado por el admin. Pantalla `/staff`. |
| U8 | Interfaces fáciles de navegar para clientes y empleados | 28/02 | ✅ | Ver sección 9. |

## 2. Películas y cartelera

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| P1 | Toda película tiene nombre, imagen, sinopsis y duración | 01/01 | ✅ | Se agregan fecha de estreno, clasificación, géneros, fondo y tráiler. Importación desde TMDB que completa el formulario; los datos se guardan en Supabase. La sinopsis y el póster son obligatorios. |
| P2 | Elegir qué películas aparecen en la página | 01/01 | ✅ | Interruptor "visible" por película. |
| P3 | Cada película puede tener varios géneros | 16/01 | ✅ | Relación muchos a muchos. |
| P4 | Buscador en el listado de películas | 16/01 | ✅ | Búsqueda por título y sinopsis, sin distinguir tildes ni mayúsculas. |
| P5 | El buscador filtra por género | 16/01 | ✅ | Filtro por uno o varios géneros (la película debe tener todos los elegidos); también por calificación. |
| P6 | En la página principal, primero las 3 más vendidas | 16/01 | ✅ | Podio con las 3 películas en cartelera con más entradas vendidas. |
| P7 | Restricción de edad: +18, +13 o sin restricción | 12/02 | ✅ | Clasificaciones ATP, +13 y +18. |
| P8 | Menores no pueden comprar esas entradas | 12/02 | 🔄 | Usuarios registrados: se valida con su fecha de nacimiento (no editable). Invitados: deben declarar que todos los asistentes cumplen la edad. |
| P9 | La entrada debe aclarar que debe ir un adulto | 12/02 | ✅ | Leyenda en la entrada, el PDF y la pantalla del empleado. |
| P10 | Sección "Próximamente" con estrenos de las próximas semanas | 08/03 | ✅ | `/proximamente`. |
| P11 | Alerta para avisar cuando salen las entradas | 08/03 | ✅ | Notificación dentro de la app (tiempo real) y Web Push si el usuario lo habilita. |
| P12 | Preventa 7 días antes del estreno con precio especial, configurable por película | 08/03 | 🔄 | Por película: habilitar, cantidad de días y **porcentaje** de descuento (así aplica a cualquier formato). Desde el estreno vuelve el precio normal. |
| P13 | Reseñas con estrellas y comentario corto, visibles antes de comprar | 16/01 | ✅ | 1 a 5 estrellas y hasta 280 caracteres, una por persona y película. |
| P14 | Puntuación promedio de la película | 16/01 | ✅ | Promedio y distribución por estrellas. |
| P15 | "Mis películas": historial visual con pósters, fechas y calificación propia | 08/03 | ✅ | Funciones vistas (ingreso validado o ya terminadas), calificables desde ahí. |

## 3. Salas, butacas y funciones

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| S1 | Varias salas, todas iguales: 20 filas (letras) × columnas de 4, 20 y 4 | 01/01 | ✅ | Filas A–T con bloques 4 · 20 · 4. |
| S2 | Filas J y K reemplazadas por una fila accesible de 2, 10 y 2 | 12/02 | 🔄 | Una única fila rotulada "J" con butacas más anchas. Total: 518 butacas por sala. |
| S3 | Butacas accesibles resaltadas visualmente | 12/02 | ✅ | Color propio e ícono ♿. |
| S4 | Butacas VIP en filas R, S y T, con precio más alto y bien marcadas | 10/03 | ✅ | Recargo configurable; aviso explícito antes de pagar y en la entrada. |
| S5 | Butacas en tiempo real: ver las ocupadas por otra compra | 12/02 | ✅ | Supabase Realtime. Además se muestran las que otra persona está eligiendo en ese momento. |
| S6 | Controlar la distribución de las butacas | 06/02 | 🔄 | La forma es fija (así lo definió el cliente); el admin puede dar de baja butacas puntuales y activar/desactivar salas. |
| S7 | Horarios, formato (2D/3D/4D/5D) e idioma (castellano/subtitulada) por función | 01/01 | ✅ | |
| S8 | No puede haber funciones antes de que pase media hora del final de la anterior | 01/01 | ✅ | Cada función ocupa duración + 30 min de limpieza. Garantizado con una restricción de exclusión en PostgreSQL. |
| S9 | Asignación de sala automática; nunca dos funciones en la misma sala a la vez | 06/02 | ✅ | El admin elige película, período y una grilla por franjas (por ejemplo, de lunes a jueves y de viernes a domingo) indicando solo la primera función: el resto se calcula encadenando duración + limpieza. La sala se asigna sola: cada película ocupa una única sala por día (un solo cartel en la entrada) y se priorizan las salas ya ocupadas para maximizar el uso del edificio. |
| S10 | Mapa del cine indicando la sala | 30/01 | ⛔ | El cliente aclaró que "no tenemos luz verde aún". Queda como mejora futura. |

## 4. Compra, entrada y QR

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| C1 | Sacar entradas en línea | 01/01 | ✅ | Flujo en 3 pasos: butacas → candy → pago. Precios calculados en la base. |
| C2 | PDF con los datos de la entrada y el QR | 01/01 | ✅ | Descargable al confirmar y desde "Mi cuenta". |
| C3 | Pago | 01/01 | 🔄 | Pago **simulado** (TP académico): validación real del número (Luhn) y vencimiento; solo se guardan los últimos 4 dígitos. |
| C4 | Cancelar hasta 2 h antes; sin devolución de dinero, crédito en la cuenta | 10/03 | ✅ | Plazo configurable. Se devuelven también los puntos canjeados y se descuentan los ganados. |
| C5 | El crédito se ve en el perfil y se combina con otros medios de pago | 10/03 | ✅ | |

## 5. Candy bar

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| K1 | Crear productos y categorías | 30/01 | ✅ | Con imagen (Supabase Storage) y activación. |
| K2 | Comprarlos junto con la entrada | 30/01 | ✅ | Paso 2 de la compra. |
| K3 | Retirar con el mismo QR | 30/01 | ✅ | El QR se valida por separado para sala y candy. |
| K4 | Combos entrada + pochoclos + bebida a precio fijo configurable, destacados | 03/03 | ✅ | Los combos aparecen primero y destacados en la compra. |

## 6. Validación por empleados

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| E1 | Escanear el QR | 06/02 | ✅ | Cámara del celular o la PC. |
| E2 | Ingresar el código a mano si falla el lector | 06/02 | ✅ | Código legible en la entrada (`CC-XXXXX-XXXXX`). |
| E3 | Una vez validado, el QR deja de funcionar | 06/02 | ✅ | Por sector: un ingreso a sala y una entrega de candy. Además, el ingreso se habilita 1 h antes de la función. |

## 7. Cupones y fidelización

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| F1 | Cupones solo para mayores de 50 años | 30/01 | ✅ | Cupones con edad mínima opcional, validada con la fecha de nacimiento. Cada persona usa un cupón una vez. Si coincide con el de primera compra, se aplica el mayor. |
| F2 | 1 punto por cada peso gastado (usuarios registrados) | 03/03 | 🔄 | Sobre lo pagado con tarjeta: el crédito proviene de compras ya puntuadas. Relación configurable. |
| F3 | Canjear puntos por entradas o productos; costo configurable | 03/03 | ✅ | Se canjean al comprar. Los valores del mail (500/150) eran ejemplos: con 1 punto por peso darían una entrada gratis por compra, por eso los valores iniciales son mayores y el admin los ajusta. |
| F4 | Ver puntos e historial de canjes en el perfil | 03/03 | ✅ | |
| F5 | Puntos intransferibles | 03/03 | ✅ | No existe ninguna operación de transferencia y el saldo no es editable desde el cliente. |

## 8. Administración y reportes

| ID | Requerimiento | Origen | Estado | Resolución |
| --- | --- | --- | --- | --- |
| A1 | Controlar salas, funciones, butacas, productos, etc. | 06/02 | ✅ | |
| A2 | Reporte de facturación diaria y entradas vendidas | 28/02 | ✅ | Por rango de fechas, con indicadores y gráficos. |
| A3 | Exportar el reporte a PDF y Excel | 10/03 | ✅ | |
| A4 | Gráfico de películas más vistas por semana y por mes | 10/03 | ✅ | Navegable entre semanas y meses. |
| A5 | Producto del candy más vendido | 10/03 | ✅ | Ranking que incluye los productos vendidos dentro de combos. |
| A6 | Log de actividad: quién creó qué función, modificó un precio o validó un QR, con fecha y hora | 10/03 | ✅ | Registrado por triggers en la base, con valor anterior y nuevo. |

## 9. Requerimientos no funcionales

| ID | Requerimiento | Resolución |
| --- | --- | --- |
| N1 | Interfaces fáciles de entender | Pasos numerados en la compra, estados vacíos y de error claros, mensajes en castellano rioplatense. |
| N2 | No usar selectores de fecha con mucho scroll | Tiras de días, chips de atajos y casilleros DD/MM/AAAA; horarios con chips de hora y minutos. |
| N3 | Estilo visual único y producido | Identidad "marquesina de cine"; el panel admin y el de empleados tienen estéticas propias. |
| N4 | Integración con Supabase | Auth, base con RLS, Realtime, Storage y Edge Functions. |
| N5 | PWA | Instalable, service worker con caché, íconos, aviso de nueva versión y notificaciones push. |
| N6 | Desplegada con URL funcional, código en GitHub, README | Vercel + GitHub; claves fuera del repositorio. |
| N7 | Responsive | Diseñado para celular y escritorio. |
