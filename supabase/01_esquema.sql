-- =====================================================================
--  CINECORN · Esquema de base de datos (Supabase / PostgreSQL)
--  Ejecutar completo en: Supabase > SQL Editor > New query > Run
--  ATENCIÓN: borra y recrea todas las tablas de la aplicación.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Limpieza (permite volver a correr el script desde cero)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.v_peliculas;
drop table if exists
  public.actividad, public.suscripciones_push, public.notificaciones, public.alertas,
  public.movimientos_credito, public.movimientos_puntos, public.butacas_ocupadas,
  public.compra_items, public.entradas, public.compras, public.resenas, public.recompensas,
  public.cupones, public.combo_productos, public.combos, public.productos, public.categorias,
  public.funciones, public.salas, public.pelicula_generos, public.generos, public.peliculas,
  public.formatos, public.configuracion, public.perfiles, public.profiles
cascade;

-- ---------------------------------------------------------------------
-- Utilidades de fecha (el cine opera en hora argentina)
-- ---------------------------------------------------------------------
create or replace function public.hoy_ar() returns date
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

create or replace function public.edad_en(p_nacimiento date, p_fecha date) returns int
language sql immutable as $$
  select extract(year from age(p_fecha, p_nacimiento))::int
$$;

-- Venta abierta: con preventa, N días antes del estreno; sin preventa, el día del estreno.
create or replace function public.apertura_venta(p_estreno date, p_preventa boolean, p_dias int)
returns timestamptz language sql stable as $$
  select ((p_estreno - case when p_preventa then coalesce(p_dias, 7) else 0 end)::timestamp)
         at time zone 'America/Argentina/Buenos_Aires'
$$;

-- Tipo de butaca según la distribución fija de las salas:
--   filas A–I y L–T: 28 butacas (bloques 4 | 20 | 4)
--   fila J (ocupa el espacio de J y K): 14 butacas accesibles (2 | 10 | 2)
--   filas R, S y T: VIP
create or replace function public.tipo_butaca(p_butaca text) returns text
language sql immutable as $$
  select case
    when p_butaca ~ '^J([1-9]|1[0-4])$' then 'accesible'
    when p_butaca ~ '^[A-IL-T]([1-9]|1[0-9]|2[0-8])$' then
      case when left(p_butaca, 1) in ('R', 'S', 'T') then 'vip' else 'estandar' end
    else null
  end
$$;

-- ---------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------
create table public.perfiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text not null default '',
  apellido         text not null default '',
  fecha_nacimiento date,
  -- Datos que el cliente pidió recopilar en el registro (mail del 01/01)
  tipo_sangre      text check (tipo_sangre in ('0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  color_ojos       text check (color_ojos in ('Marrones', 'Negros', 'Verdes', 'Azules', 'Grises', 'Miel', 'Otro')),
  dias_vacaciones  int check (dias_vacaciones between 0 and 365),
  rol              text not null default 'cliente' check (rol in ('cliente', 'empleado', 'admin')),
  puntos           int not null default 0 check (puntos >= 0),
  credito          numeric(12, 2) not null default 0 check (credito >= 0),
  creado_en        timestamptz not null default now()
);

create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'admin', false)
$$;

create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() in ('admin', 'empleado'), false)
$$;

-- Permite correr funciones de admin desde el SQL Editor (datos de ejemplo).
-- Las llamadas desde la app entran por PostgREST con el usuario "authenticator".
create or replace function public.es_admin_o_sistema() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or session_user not in ('authenticator', 'anon', 'authenticated', 'service_role')
$$;

-- Al registrarse un usuario en Auth se crea su perfil con los datos enviados en signUp.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, apellido, fecha_nacimiento,
                               tipo_sangre, color_ojos, dias_vacaciones, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    nullif(new.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
    nullif(new.raw_user_meta_data ->> 'tipo_sangre', ''),
    nullif(new.raw_user_meta_data ->> 'color_ojos', ''),
    nullif(new.raw_user_meta_data ->> 'dias_vacaciones', '')::int,
    case when lower(new.email) = 'administrador@cinecorn.com.ar' then 'admin' else 'cliente' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Usuarios que ya existían en Auth antes de correr este script
insert into public.perfiles (id, email, nombre, apellido, fecha_nacimiento,
                             tipo_sangre, color_ojos, dias_vacaciones, rol)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'nombre', ''),
       coalesce(u.raw_user_meta_data ->> 'apellido', ''),
       nullif(u.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
       nullif(u.raw_user_meta_data ->> 'tipo_sangre', ''),
       nullif(u.raw_user_meta_data ->> 'color_ojos', ''),
       nullif(u.raw_user_meta_data ->> 'dias_vacaciones', '')::int,
       case when lower(u.email) = 'administrador@cinecorn.com.ar' then 'admin' else 'cliente' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Configuración general (una sola fila)
-- ---------------------------------------------------------------------
create table public.configuracion (
  id                        int primary key default 1 check (id = 1),
  descuento_primera_compra  int not null default 20 check (descuento_primera_compra between 0 and 100),
  recargo_vip               numeric(12, 2) not null default 4000 check (recargo_vip >= 0),
  minutos_limpieza          int not null default 30 check (minutos_limpieza >= 30),
  horas_limite_cancelacion  int not null default 2 check (horas_limite_cancelacion >= 0),
  puntos_por_peso           numeric(6, 2) not null default 1 check (puntos_por_peso >= 0),
  max_entradas_por_compra   int not null default 10 check (max_entradas_por_compra between 1 and 30)
);

create table public.formatos (
  codigo text primary key check (codigo in ('2D', '3D', '4D', '5D')),
  nombre text not null,
  precio numeric(12, 2) not null check (precio > 0)
);

-- Datos estructurales: el sistema los necesita para funcionar.
-- Los valores se editan desde el panel admin (Precios y beneficios).
insert into public.configuracion (id) values (1) on conflict (id) do nothing;

insert into public.formatos (codigo, nombre, precio) values
  ('2D', 'Digital 2D', 9000),
  ('3D', 'Digital 3D', 11500),
  ('4D', '4D con butacas en movimiento', 15000),
  ('5D', '5D con efectos ambientales', 17500)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------
-- Películas y géneros
-- ---------------------------------------------------------------------
create table public.peliculas (
  id                   bigint generated always as identity primary key,
  titulo               text not null check (length(trim(titulo)) > 0),
  sinopsis             text not null default '',
  duracion_min         int not null check (duracion_min between 1 and 400),
  poster_url           text,
  fondo_url            text,
  trailer_youtube      text,
  clasificacion        text not null default 'ATP' check (clasificacion in ('ATP', '+13', '+18')),
  fecha_estreno        date not null,
  -- Publicada por el admin. Nace oculta; programarle funciones la publica.
  visible              boolean not null default false,
  preventa_habilitada  boolean not null default false,
  preventa_dias        int not null default 7 check (preventa_dias between 1 and 60),
  preventa_descuento   int not null default 20 check (preventa_descuento between 0 and 90),
  -- Película de TMDB de la que se importaron los datos (evita cargarla dos veces)
  tmdb_id              int unique,
  creado_en            timestamptz not null default now()
);

create table public.generos (
  id     smallint generated always as identity primary key,
  nombre text not null unique
);

-- Géneros estándar (se pueden agregar más desde el panel)
insert into public.generos (nombre) values
  ('Acción'), ('Animación'), ('Aventura'), ('Bélica'), ('Ciencia ficción'), ('Comedia'),
  ('Crimen'), ('Documental'), ('Drama'), ('Familia'), ('Fantasía'), ('Historia'),
  ('Misterio'), ('Música'), ('Romance'), ('Suspense'), ('Terror'), ('Western')
on conflict (nombre) do nothing;

create table public.pelicula_generos (
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  genero_id   smallint not null references public.generos (id) on delete cascade,
  primary key (pelicula_id, genero_id)
);

-- ---------------------------------------------------------------------
-- Salas y funciones
-- ---------------------------------------------------------------------
create table public.salas (
  id                     smallint generated always as identity primary key,
  nombre                 text not null unique,
  activa                 boolean not null default true,
  butacas_inhabilitadas  text[] not null default '{}',
  -- Formatos que la sala puede proyectar. 2D siempre; 3D/4D/5D según su equipamiento.
  formatos               text[] not null default '{2D}'
    check (formatos <@ array['2D', '3D', '4D', '5D'] and '2D' = any (formatos))
);

create table public.funciones (
  id          bigint generated always as identity primary key,
  pelicula_id bigint not null references public.peliculas (id) on delete restrict,
  sala_id     smallint not null references public.salas (id) on delete restrict,
  inicio      timestamptz not null,
  fin         timestamptz not null,
  formato     text not null references public.formatos (codigo),
  idioma      text not null check (idioma in ('CAST', 'SUBT')),
  precio      numeric(12, 2) not null check (precio > 0),
  activa      boolean not null default true,
  -- franja ocupada por la función: inicio → fin + limpieza (calculada por trigger)
  bloque      tstzrange not null,
  creado_en   timestamptz not null default now(),
  -- Tanda: todas las funciones creadas en una misma programación (se pueden quitar juntas)
  tanda       uuid,
  -- Garantía a nivel base de datos: nunca dos funciones activas solapadas en la misma sala.
  constraint funciones_sin_solapamiento
    exclude using gist (sala_id with =, bloque with &&) where (activa)
);
create index funciones_pelicula_inicio_idx on public.funciones (pelicula_id, inicio);
create index funciones_tanda_idx on public.funciones (tanda);

create or replace function public.funciones_antes_guardar() returns trigger
language plpgsql set search_path = public as $$
declare
  v_duracion int;
  v_estreno  date;
  v_limpieza int;
begin
  select duracion_min, fecha_estreno into v_duracion, v_estreno
  from public.peliculas where id = new.pelicula_id;
  select minutos_limpieza into v_limpieza from public.configuracion where id = 1;

  new.fin    := new.inicio + make_interval(mins => v_duracion);
  new.bloque := tstzrange(new.inicio, new.fin + make_interval(mins => coalesce(v_limpieza, 30)), '[)');

  if tg_op = 'INSERT' and new.inicio <= now() then
    raise exception 'No se pueden programar funciones en el pasado';
  end if;
  if (new.inicio at time zone 'America/Argentina/Buenos_Aires')::date < v_estreno then
    raise exception 'La función es anterior al estreno de la película';
  end if;

  if tg_op = 'INSERT'
     or (new.sala_id, new.formato) is distinct from (old.sala_id, old.formato) then
    if not exists (select 1 from public.salas s where s.id = new.sala_id and new.formato = any (s.formatos)) then
      raise exception 'La sala no está equipada para funciones %', new.formato;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (new.inicio, new.sala_id, new.pelicula_id, new.activa)
         is distinct from (old.inicio, old.sala_id, old.pelicula_id, old.activa)
     and exists (select 1 from public.butacas_ocupadas b where b.funcion_id = old.id) then
    raise exception 'La función ya tiene entradas vendidas: solo se puede modificar el precio';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Visibilidad automática: una película que se queda sin funciones próximas
-- (se quitaron o se borraron) pasa a oculta. El admin puede volver a mostrarla.
-- ---------------------------------------------------------------------
create or replace function public.funciones_despues_quitar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.peliculas p
  set visible = false
  where p.id = old.pelicula_id and p.visible
    and not exists (select 1 from public.funciones f
                    where f.pelicula_id = p.id and f.activa and f.inicio > now());
  return null;
end $$;

drop trigger if exists funciones_despues_quitar on public.funciones;
create trigger funciones_despues_quitar
  after delete or update of activa on public.funciones
  for each row execute function public.funciones_despues_quitar();

-- Películas cuya última función ya pasó: se ocultan (se llama al abrir el panel).
-- Las que todavía no abrieron la venta se respetan: pueden estar en Próximamente.
create or replace function public.ocultar_sin_funciones() returns int
language plpgsql security definer set search_path = public as $$
declare v_cant int;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede hacer esto'; end if;
  with ocultadas as (
    update public.peliculas p
    set visible = false
    where p.visible
      and now() >= public.apertura_venta(p.fecha_estreno, p.preventa_habilitada, p.preventa_dias)
      and not exists (select 1 from public.funciones f
                      where f.pelicula_id = p.id and f.activa and f.inicio > now())
    returning 1
  )
  select count(*) into v_cant from ocultadas;
  return v_cant;
end $$;

-- ---------------------------------------------------------------------
-- Candy bar
-- ---------------------------------------------------------------------
create table public.categorias (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  orden  int not null default 0
);

create table public.productos (
  id           bigint generated always as identity primary key,
  categoria_id smallint not null references public.categorias (id) on delete restrict,
  nombre       text not null,
  descripcion  text not null default '',
  precio       numeric(12, 2) not null check (precio > 0),
  imagen_url   text,
  activo       boolean not null default true
);

-- Un combo siempre incluye 1 entrada + los productos listados, a precio fijo.
create table public.combos (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  descripcion text not null default '',
  precio      numeric(12, 2) not null check (precio > 0),
  imagen_url  text,
  activo      boolean not null default true
);

create table public.combo_productos (
  combo_id    bigint not null references public.combos (id) on delete cascade,
  producto_id bigint not null references public.productos (id) on delete restrict,
  cantidad    int not null default 1 check (cantidad > 0),
  primary key (combo_id, producto_id)
);

-- ---------------------------------------------------------------------
-- Cupones y recompensas
-- ---------------------------------------------------------------------
create table public.cupones (
  id          bigint generated always as identity primary key,
  codigo      text not null unique check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9]{4,20}$'),
  descripcion text not null default '',
  porcentaje  int not null check (porcentaje between 1 and 100),
  edad_minima int check (edad_minima between 1 and 120),
  desde       date,
  hasta       date,
  activo      boolean not null default true,
  check (hasta is null or desde is null or hasta >= desde)
);

create table public.recompensas (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  tipo        text not null check (tipo in ('entrada', 'producto')),
  producto_id bigint references public.productos (id) on delete cascade,
  puntos      int not null check (puntos > 0),
  activa      boolean not null default true,
  check ((tipo = 'producto') = (producto_id is not null))
);

-- ---------------------------------------------------------------------
-- Compras, entradas y butacas
-- ---------------------------------------------------------------------
create table public.compras (
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique,
  usuario_id            uuid references public.perfiles (id) on delete set null,
  email_contacto        text not null,
  nombre_contacto       text not null default '',
  funcion_id            bigint not null references public.funciones (id) on delete restrict,
  subtotal_entradas     numeric(12, 2) not null default 0,
  subtotal_candy        numeric(12, 2) not null default 0,
  descuento_porcentaje  int not null default 0,
  descuento_origen      text,
  cupon_id              bigint references public.cupones (id) on delete set null,
  descuento             numeric(12, 2) not null default 0,
  total                 numeric(12, 2) not null default 0,
  credito_usado         numeric(12, 2) not null default 0,
  total_pagado          numeric(12, 2) not null default 0,
  puntos_usados         int not null default 0,
  puntos_ganados        int not null default 0,
  tarjeta_ultimos4      text,
  estado                text not null default 'pagada' check (estado in ('pagada', 'cancelada')),
  entrada_validada_en   timestamptz,
  entrada_validada_por  uuid references public.perfiles (id) on delete set null,
  candy_entregado_en    timestamptz,
  candy_entregado_por   uuid references public.perfiles (id) on delete set null,
  cancelada_en          timestamptz,
  creada_en             timestamptz not null default now()
);
create index compras_usuario_idx on public.compras (usuario_id);
create index compras_funcion_idx on public.compras (funcion_id);
create index compras_fecha_idx on public.compras (creada_en);

create table public.entradas (
  id           bigint generated always as identity primary key,
  compra_id    uuid not null references public.compras (id) on delete cascade,
  butaca       text not null,
  tipo         text not null check (tipo in ('estandar', 'vip', 'accesible')),
  precio       numeric(12, 2) not null,
  es_preventa  boolean not null default false,
  por_combo    boolean not null default false,
  por_puntos   boolean not null default false
);
create index entradas_compra_idx on public.entradas (compra_id);

create table public.compra_items (
  id              bigint generated always as identity primary key,
  compra_id       uuid not null references public.compras (id) on delete cascade,
  producto_id     bigint references public.productos (id) on delete set null,
  combo_id        bigint references public.combos (id) on delete set null,
  nombre          text not null,
  cantidad        int not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null,
  por_puntos      boolean not null default false
);
create index compra_items_compra_idx on public.compra_items (compra_id);

-- Ocupación pública de butacas (sin datos personales). Se emite por Realtime.
-- La PK impide vender dos veces la misma butaca para la misma función.
create table public.butacas_ocupadas (
  funcion_id bigint not null references public.funciones (id) on delete cascade,
  butaca     text not null,
  compra_id  uuid not null references public.compras (id) on delete cascade,
  primary key (funcion_id, butaca)
);


-- No se puede quitar un formato a una sala que tiene funciones futuras en ese formato.
create or replace function public.salas_antes_actualizar() returns trigger
language plpgsql set search_path = public as $$
declare v_formato text;
begin
  select f.formato into v_formato
  from public.funciones f
  where f.sala_id = new.id and f.activa and f.inicio > now() and not (f.formato = any (new.formatos))
  limit 1;
  if v_formato is not null then
    raise exception '% tiene funciones % programadas: quitalas antes de sacarle ese formato', new.nombre, v_formato;
  end if;
  return new;
end $$;

create trigger salas_antes_actualizar
  before update of formatos on public.salas
  for each row execute function public.salas_antes_actualizar();

-- Ahora que existe butacas_ocupadas, se crea el trigger de funciones
create trigger funciones_antes_guardar
  before insert or update on public.funciones
  for each row execute function public.funciones_antes_guardar();

-- ---------------------------------------------------------------------
-- Fidelización: historial de puntos y crédito
-- ---------------------------------------------------------------------
create table public.movimientos_puntos (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  compra_id  uuid references public.compras (id) on delete set null,
  puntos     int not null,
  tipo       text not null check (tipo in ('compra', 'canje', 'anulacion', 'devolucion')),
  detalle    text not null default '',
  creado_en  timestamptz not null default now()
);

create table public.movimientos_credito (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  compra_id  uuid references public.compras (id) on delete set null,
  monto      numeric(12, 2) not null,
  tipo       text not null check (tipo in ('cancelacion', 'uso')),
  detalle    text not null default '',
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reseñas
-- ---------------------------------------------------------------------
create table public.resenas (
  id          bigint generated always as identity primary key,
  pelicula_id bigint not null references public.peliculas (id) on delete cascade,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  autor       text not null default '',
  estrellas   smallint not null check (estrellas between 1 and 5),
  comentario  text not null default '' check (length(comentario) <= 280),
  creado_en   timestamptz not null default now(),
  unique (pelicula_id, usuario_id)
);

create or replace function public.resenas_antes_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.usuario_id := auth.uid();
  select trim(nombre || ' ' || left(apellido, 1) || '.') into new.autor
  from public.perfiles where id = auth.uid();
  new.creado_en := now();
  return new;
end $$;

create trigger resenas_antes_guardar
  before insert or update on public.resenas
  for each row execute function public.resenas_antes_guardar();

-- ---------------------------------------------------------------------
-- Próximamente: alertas y notificaciones
-- ---------------------------------------------------------------------
create table public.alertas (
  usuario_id    uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  pelicula_id   bigint not null references public.peliculas (id) on delete cascade,
  creada_en     timestamptz not null default now(),
  notificada_en timestamptz,
  primary key (usuario_id, pelicula_id)
);

create table public.notificaciones (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  titulo     text not null,
  cuerpo     text not null,
  url        text,
  leida      boolean not null default false,
  creada_en  timestamptz not null default now()
);

create table public.suscripciones_push (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  creada_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Log de actividad
-- ---------------------------------------------------------------------
create table public.actividad (
  id            bigint generated always as identity primary key,
  usuario_id    uuid,
  usuario_email text,
  accion        text not null,
  entidad       text not null,
  entidad_id    text,
  etiqueta      text,
  detalle       jsonb not null default '{}',
  creado_en     timestamptz not null default now()
);
create index actividad_fecha_idx on public.actividad (creado_en desc);

create or replace function public.log_actividad(
  p_accion text, p_entidad text, p_entidad_id text, p_etiqueta text, p_detalle jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.actividad (usuario_id, usuario_email, accion, entidad, entidad_id, etiqueta, detalle)
  values (auth.uid(), (select email from public.perfiles where id = auth.uid()),
          p_accion, p_entidad, p_entidad_id, p_etiqueta, coalesce(p_detalle, '{}'));
$$;

-- Trigger genérico: registra altas, bajas y modificaciones (con valor anterior y nuevo).
create or replace function public.registrar_actividad() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_det jsonb := '{}';
  v_ref jsonb;
  k     text;
begin
  if current_setting('cinecorn.omitir_log', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - 'bloque';
    v_det := v_new;
    v_ref := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old) - 'bloque';
    v_new := to_jsonb(new) - 'bloque';
    for k in select jsonb_object_keys(v_new) loop
      if v_new -> k is distinct from v_old -> k then
        v_det := v_det || jsonb_build_object(k, jsonb_build_object('antes', v_old -> k, 'despues', v_new -> k));
      end if;
    end loop;
    if v_det = '{}'::jsonb then
      return new;
    end if;
    v_ref := v_new;
  else
    v_old := to_jsonb(old) - 'bloque';
    v_det := v_old;
    v_ref := v_old;
  end if;

  perform public.log_actividad(
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    tg_table_name,
    v_ref ->> 'id',
    coalesce(v_ref ->> 'titulo', v_ref ->> 'nombre', v_ref ->> 'codigo', v_ref ->> 'inicio'),
    v_det
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['peliculas', 'salas', 'funciones', 'formatos', 'configuracion',
                           'categorias', 'productos', 'combos', 'cupones', 'recompensas'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.registrar_actividad()', t || '_actividad', t);
  end loop;
end $$;

-- =====================================================================
--  LÓGICA DE NEGOCIO (RPC)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Programación automática de funciones con asignación de sala
-- p_dias: 0 = domingo … 6 = sábado. p_horarios: ['18:00', '21:30'] (antes de 06:00 = trasnoche)
-- p_tanda: identifica la programación completa (todas sus franjas) para poder quitarla junta.
--
-- Criterio de asignación, día por día:
--   1. Todas las funciones del día de una película van a UNA sala (un solo cartel):
--      se elige la sala donde entran más de los horarios pedidos.
--   0. Solo salas equipadas para el formato (3D/4D/5D no están en todas).
--   2. A igualdad, la sala donde esa versión ya está programada (el cartel no cambia).
--   3. A igualdad, la sala más ocupada ese día: así quedan salas enteras libres
--      para otras películas y se aprovecha mejor el edificio.
--   4. Solo si en ninguna sala entran todos, los horarios sobrantes van a una segunda sala.
-- ---------------------------------------------------------------------
drop function if exists public.programar_funciones(bigint, text, text, date, date, int[], text[], numeric);
drop function if exists public.programar_funciones(bigint, text, text, date, date, int[], text[], numeric, smallint);
drop function if exists public.programar_funciones(bigint, text, text, date, date, int[], text[], numeric, uuid);
create or replace function public.programar_funciones(
  p_pelicula_id bigint,
  p_formato     text,
  p_idioma      text,
  p_desde       date,
  p_hasta       date,
  p_dias        int[],
  p_horarios    text[],
  p_precio      numeric default null,
  p_tanda       uuid default null
) returns table (horario timestamptz, sala_asignada text, resultado text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  c_tz        constant text := 'America/Argentina/Buenos_Aires';
  v_peli      public.peliculas;
  v_limpieza  int;
  v_ocupa     interval;
  v_precio    numeric;
  v_fecha     date;
  v_hora      text;
  v_inicio    timestamptz;
  v_pend      timestamptz[];
  v_resto     timestamptz[];
  v_dia_ini   timestamptz;
  v_dia_fin   timestamptz;
  v_sala_pref smallint;
  v_sala_id   smallint;
  v_sala_nom  text;
  v_ok        int := 0;
  v_fallas    int := 0;
  v_tanda     uuid := coalesce(p_tanda, gen_random_uuid());
begin
  if not public.es_admin_o_sistema() then
    raise exception 'Solo un administrador puede programar funciones';
  end if;
  if p_hasta < p_desde then raise exception 'La fecha "hasta" es anterior a "desde"'; end if;
  if p_hasta - p_desde > 90 then raise exception 'El rango máximo es de 90 días'; end if;
  if coalesce(array_length(p_dias, 1), 0) = 0 then raise exception 'Elegí al menos un día de la semana'; end if;
  if coalesce(array_length(p_horarios, 1), 0) = 0 then raise exception 'Elegí al menos un horario'; end if;

  select * into v_peli from public.peliculas where id = p_pelicula_id;
  if not found then raise exception 'La película no existe'; end if;
  select minutos_limpieza into v_limpieza from public.configuracion where id = 1;
  v_ocupa := make_interval(mins => v_peli.duracion_min + v_limpieza);
  v_precio := coalesce(p_precio, (select precio from public.formatos where codigo = p_formato));
  if v_precio is null then raise exception 'Formato inválido'; end if;
  if not exists (select 1 from public.salas where activa and p_formato = any (formatos)) then
    raise exception 'Ninguna sala activa está equipada para %', p_formato;
  end if;

  -- Serializa programaciones concurrentes; la restricción EXCLUDE es la garantía final.
  perform pg_advisory_xact_lock(hashtext('programar_funciones'));
  perform set_config('cinecorn.omitir_log', 'on', true);

  -- Sala "de esta versión" (película + formato + idioma): donde ya tiene más funciones próximas.
  select f.sala_id into v_sala_pref
  from public.funciones f
  where f.pelicula_id = p_pelicula_id and f.formato = p_formato and f.idioma = p_idioma
    and f.activa and f.inicio > now()
  group by f.sala_id
  order by count(*) desc, f.sala_id
  limit 1;

  for v_fecha in select d::date from generate_series(p_desde, p_hasta, interval '1 day') d loop
    continue when not (extract(dow from v_fecha)::int = any (p_dias));

    -- El "día de cine" va de 06:00 a 06:00 (incluye la trasnoche).
    v_dia_ini := (v_fecha + time '06:00') at time zone c_tz;
    v_dia_fin := v_dia_ini + interval '1 day';
    v_pend := '{}';

    foreach v_hora in array (
      select array_agg(h order by h::time < time '06:00', h::time) from unnest(p_horarios) h) loop
      v_inicio := (v_fecha + v_hora::time
                   + case when v_hora::time < time '06:00' then interval '1 day' else interval '0' end)
                  at time zone c_tz;
      if v_inicio <= now() then
        horario := v_inicio; sala_asignada := null; resultado := 'pasado';
        v_fallas := v_fallas + 1;
        return next;
      elsif v_fecha < v_peli.fecha_estreno then
        horario := v_inicio; sala_asignada := null; resultado := 'antes_del_estreno';
        v_fallas := v_fallas + 1;
        return next;
      else
        v_pend := v_pend || v_inicio;
      end if;
    end loop;

    while coalesce(array_length(v_pend, 1), 0) > 0 loop
      select s.id, s.nombre into v_sala_id, v_sala_nom
      from public.salas s
      cross join lateral (
        select count(*) as entran
        from unnest(v_pend) i
        where not exists (
          select 1 from public.funciones f
          where f.sala_id = s.id and f.activa and f.bloque && tstzrange(i, i + v_ocupa, '[)'))
      ) c
      cross join lateral (
        select coalesce(sum(upper(f.bloque) - lower(f.bloque)), interval '0') as ocupado
        from public.funciones f
        where f.sala_id = s.id and f.activa and f.bloque && tstzrange(v_dia_ini, v_dia_fin, '[)')
      ) o
      where s.activa and p_formato = any (s.formatos) and c.entran > 0
      order by c.entran desc, (s.id = v_sala_pref) desc, o.ocupado desc, s.id
      limit 1;

      if not found then
        foreach v_inicio in array v_pend loop
          horario := v_inicio; sala_asignada := null; resultado := 'sin_sala';
          v_fallas := v_fallas + 1;
          return next;
        end loop;
        exit;
      end if;

      v_resto := '{}';
      foreach v_inicio in array v_pend loop
        begin
          insert into public.funciones (pelicula_id, sala_id, inicio, formato, idioma, precio, tanda)
          values (p_pelicula_id, v_sala_id, v_inicio, p_formato, p_idioma, v_precio, v_tanda);
          horario := v_inicio; sala_asignada := v_sala_nom; resultado := 'ok';
          v_ok := v_ok + 1;
          return next;
        exception when exclusion_violation then
          v_resto := v_resto || v_inicio;  -- no entra en esta sala: se prueba en otra
        end;
      end loop;

      v_sala_pref := coalesce(v_sala_pref, v_sala_id);
      v_pend := v_resto;
    end loop;
  end loop;

  -- Con funciones programadas, la película pasa a estar en cartelera: se publica
  if v_ok > 0 and not v_peli.visible then
    update public.peliculas set visible = true where id = p_pelicula_id;
  end if;

  perform set_config('cinecorn.omitir_log', 'off', true);
  perform public.log_actividad('programar', 'funciones', p_pelicula_id::text, v_peli.titulo,
    jsonb_build_object('formato', p_formato, 'idioma', p_idioma, 'desde', p_desde, 'hasta', p_hasta,
                       'dias', p_dias, 'horarios', p_horarios, 'precio', v_precio,
                       'creadas', v_ok, 'no_creadas', v_fallas));
end $$;
-- ---------------------------------------------------------------------
-- Quitar en bloque las funciones de una película desde una fecha.
-- Las que no tienen ventas se eliminan; las que ya vendieron entradas se
-- conservan (hay clientes con QR) y se informan para decidir caso por caso.
-- ---------------------------------------------------------------------
create or replace function public.quitar_funciones(
  p_pelicula_id bigint,
  p_desde       timestamptz default now(),
  p_hasta       timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_eliminadas int;
  v_con_ventas int;
  v_titulo     text;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede quitar funciones'; end if;
  select titulo into v_titulo from public.peliculas where id = p_pelicula_id;

  perform set_config('cinecorn.omitir_log', 'on', true);
  with borradas as (
    delete from public.funciones f
    where f.pelicula_id = p_pelicula_id
      and f.inicio >= greatest(p_desde, now())
      and (p_hasta is null or f.inicio < p_hasta)
      and not exists (select 1 from public.compras c where c.funcion_id = f.id)
    returning 1
  )
  select count(*) into v_eliminadas from borradas;
  perform set_config('cinecorn.omitir_log', 'off', true);

  select count(*) into v_con_ventas
  from public.funciones f
  where f.pelicula_id = p_pelicula_id and f.activa
    and f.inicio >= greatest(p_desde, now())
    and (p_hasta is null or f.inicio < p_hasta);

  perform public.log_actividad('quitar', 'funciones', p_pelicula_id::text, v_titulo,
    jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'eliminadas', v_eliminadas,
                       'conservadas_con_ventas', v_con_ventas));
  return jsonb_build_object('eliminadas', v_eliminadas, 'con_ventas', v_con_ventas);
end $$;


-- ---------------------------------------------------------------------
-- Deshacer una tanda: quita sus funciones futuras. Las que tienen entradas
-- vendidas se conservan (hay clientes con su QR).
-- ---------------------------------------------------------------------
create or replace function public.quitar_tanda(p_tanda uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_eliminadas int;
  v_con_ventas int;
  v_pelicula   bigint;
  v_titulo     text;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede quitar funciones'; end if;
  select f.pelicula_id, p.titulo into v_pelicula, v_titulo
  from public.funciones f join public.peliculas p on p.id = f.pelicula_id
  where f.tanda = p_tanda limit 1;
  if v_pelicula is null then raise exception 'La tanda no existe'; end if;

  perform set_config('cinecorn.omitir_log', 'on', true);
  with borradas as (
    delete from public.funciones f
    where f.tanda = p_tanda and f.inicio > now()
      and not exists (select 1 from public.compras c where c.funcion_id = f.id)
    returning 1
  )
  select count(*) into v_eliminadas from borradas;
  perform set_config('cinecorn.omitir_log', 'off', true);

  select count(*) into v_con_ventas
  from public.funciones f
  where f.tanda = p_tanda and f.activa and f.inicio > now();

  perform public.log_actividad('quitar', 'funciones', v_pelicula::text, v_titulo,
    jsonb_build_object('tanda', p_tanda, 'eliminadas', v_eliminadas,
                       'conservadas_con_ventas', v_con_ventas));
  return jsonb_build_object('eliminadas', v_eliminadas, 'con_ventas', v_con_ventas);
end $$;

-- ---------------------------------------------------------------------
-- Cotizar / confirmar una compra. Todos los precios se calculan acá:
-- el cliente nunca envía montos, solo lo que quiere comprar.
--
-- p = {
--   funcion_id, butacas: ["A1"], productos: [{id, cantidad}],
--   combos: [{id, cantidad}], recompensas: [{id, cantidad}],
--   cupon, usar_credito, email, nombre, declara_edad, tarjeta_ultimos4
-- }
-- ---------------------------------------------------------------------
create or replace function public.procesar_compra(p jsonb, p_confirmar boolean default false)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid          uuid := auth.uid();
  v_perfil       public.perfiles;
  v_func         public.funciones;
  v_peli         public.peliculas;
  v_sala         public.salas;
  v_conf         public.configuracion;
  v_butacas      text[];
  v_b            text;
  v_tipo         text;
  v_ocupadas     text[];
  v_edad_min     int := 0;
  v_preventa     boolean;
  v_base         numeric;
  v_precio       numeric;
  v_entradas     jsonb := '[]';
  v_items        jsonb := '[]';
  v_sub_ent      numeric := 0;
  v_sub_candy    numeric := 0;
  v_combos_cant  int := 0;
  v_canje_ent    int := 0;
  v_puntos_usar  int := 0;
  v_canjes       jsonb := '[]';
  v_pct          int := 0;
  v_origen       text;
  v_cupon        public.cupones;
  v_cupon_id     bigint;
  v_cod_cupon    text := upper(nullif(trim(coalesce(p ->> 'cupon', '')), ''));
  v_descuento    numeric := 0;
  v_total        numeric;
  v_credito      numeric := 0;
  v_pagar        numeric;
  v_puntos_ganar int := 0;
  v_email        text;
  v_nombre       text;
  v_compra_id    uuid;
  v_codigo       text;
  v_aviso_edad   text;
  v_idx          int := 0;
  v_cant         int;
  r              record;
  v_ent          jsonb;
  v_it           jsonb;
begin
  -- Función, película, sala y configuración
  select * into v_func from public.funciones where id = (p ->> 'funcion_id')::bigint;
  if not found or not v_func.activa then raise exception 'La función no existe o fue cancelada'; end if;
  if v_func.inicio <= now() then raise exception 'La función ya comenzó'; end if;
  select * into v_peli from public.peliculas where id = v_func.pelicula_id;
  select * into v_sala from public.salas where id = v_func.sala_id;
  select * into v_conf from public.configuracion where id = 1;

  if not v_peli.visible then raise exception 'La película no está disponible'; end if;
  if now() < public.apertura_venta(v_peli.fecha_estreno, v_peli.preventa_habilitada, v_peli.preventa_dias) then
    raise exception 'La venta de entradas para esta película todavía no está abierta';
  end if;

  if v_uid is not null then
    select * into v_perfil from public.perfiles where id = v_uid;
  end if;

  -- Butacas
  select coalesce(array_agg(distinct upper(trim(x))), '{}') into v_butacas
  from jsonb_array_elements_text(coalesce(p -> 'butacas', '[]')) x;
  if array_length(v_butacas, 1) is null then raise exception 'Elegí al menos una butaca'; end if;
  if array_length(v_butacas, 1) > v_conf.max_entradas_por_compra then
    raise exception 'Máximo % entradas por compra', v_conf.max_entradas_por_compra;
  end if;
  foreach v_b in array v_butacas loop
    if public.tipo_butaca(v_b) is null or v_b = any (v_sala.butacas_inhabilitadas) then
      raise exception 'La butaca % no existe o está inhabilitada', v_b;
    end if;
  end loop;
  select array_agg(butaca order by butaca) into v_ocupadas
  from public.butacas_ocupadas where funcion_id = v_func.id and butaca = any (v_butacas);
  if v_ocupadas is not null then
    raise exception 'Las butacas % ya fueron vendidas', array_to_string(v_ocupadas, ', ');
  end if;

  -- Restricción de edad
  v_edad_min := case v_peli.clasificacion when '+18' then 18 when '+13' then 13 else 0 end;
  if v_edad_min > 0 then
    if v_uid is not null and v_perfil.fecha_nacimiento is not null then
      if public.edad_en(v_perfil.fecha_nacimiento, (v_func.inicio at time zone 'America/Argentina/Buenos_Aires')::date) < v_edad_min then
        raise exception 'Esta película es apta para mayores de % años', v_edad_min;
      end if;
    elsif coalesce((p ->> 'declara_edad')::boolean, false) = false then
      raise exception 'Tenés que declarar que todos los asistentes cumplen la edad mínima (% años)', v_edad_min;
    end if;
    v_aviso_edad := case v_edad_min
      when 18 then 'Película +18: el ingreso es exclusivo para adultos. Se solicitará DNI.'
      else 'Película +13: menores de 13 años no pueden ingresar. Debe asistir un adulto responsable.' end;
  end if;

  -- Precio base (con preventa si corresponde)
  v_preventa := v_peli.preventa_habilitada and public.hoy_ar() < v_peli.fecha_estreno;
  v_base := case when v_preventa
                 then round(v_func.precio * (100 - v_peli.preventa_descuento) / 100.0, 2)
                 else v_func.precio end;

  -- Combos (cada combo incluye 1 entrada)
  for r in
    select c.id, c.nombre, c.precio, sum((x ->> 'cantidad')::int)::int as cantidad
    from jsonb_array_elements(coalesce(p -> 'combos', '[]')) x
    join public.combos c on c.id = (x ->> 'id')::bigint and c.activo
    where (x ->> 'cantidad')::int > 0
    group by c.id
  loop
    v_combos_cant := v_combos_cant + r.cantidad;
    v_sub_candy := v_sub_candy + r.precio * r.cantidad;
    v_items := v_items || jsonb_build_object('combo_id', r.id, 'producto_id', null, 'nombre', 'Combo ' || r.nombre,
      'cantidad', r.cantidad, 'precio_unitario', r.precio, 'por_puntos', false);
  end loop;

  -- Productos sueltos
  for r in
    select pr.id, pr.nombre, pr.precio, sum((x ->> 'cantidad')::int)::int as cantidad
    from jsonb_array_elements(coalesce(p -> 'productos', '[]')) x
    join public.productos pr on pr.id = (x ->> 'id')::bigint and pr.activo
    where (x ->> 'cantidad')::int > 0
    group by pr.id
  loop
    if r.cantidad > 20 then raise exception 'Cantidad máxima por producto: 20'; end if;
    v_sub_candy := v_sub_candy + r.precio * r.cantidad;
    v_items := v_items || jsonb_build_object('combo_id', null, 'producto_id', r.id, 'nombre', r.nombre,
      'cantidad', r.cantidad, 'precio_unitario', r.precio, 'por_puntos', false);
  end loop;

  -- Canje de puntos (solo usuarios registrados)
  if jsonb_array_length(coalesce(p -> 'recompensas', '[]')) > 0 then
    if v_uid is null then raise exception 'Iniciá sesión para canjear puntos'; end if;
    for r in
      select rc.id, rc.nombre, rc.tipo, rc.puntos, rc.producto_id, sum((x ->> 'cantidad')::int)::int as cantidad
      from jsonb_array_elements(p -> 'recompensas') x
      join public.recompensas rc on rc.id = (x ->> 'id')::bigint and rc.activa
      where (x ->> 'cantidad')::int > 0
      group by rc.id
    loop
      v_puntos_usar := v_puntos_usar + r.puntos * r.cantidad;
      v_canjes := v_canjes || jsonb_build_object('nombre', r.nombre, 'cantidad', r.cantidad, 'puntos', r.puntos * r.cantidad);
      if r.tipo = 'entrada' then
        v_canje_ent := v_canje_ent + r.cantidad;
      else
        v_items := v_items || jsonb_build_object('combo_id', null, 'producto_id', r.producto_id,
          'nombre', r.nombre || ' (canje)', 'cantidad', r.cantidad, 'precio_unitario', 0, 'por_puntos', true);
      end if;
    end loop;
    if v_puntos_usar > v_perfil.puntos then
      raise exception 'Puntos insuficientes: tenés % y el canje requiere %', v_perfil.puntos, v_puntos_usar;
    end if;
  end if;

  if v_combos_cant + v_canje_ent > array_length(v_butacas, 1) then
    raise exception 'Combos y entradas canjeadas no pueden superar la cantidad de butacas (%)', array_length(v_butacas, 1);
  end if;

  -- Precio de cada entrada: primero las canjeadas, luego las de combo, el resto a precio base.
  -- El recargo VIP se cobra siempre.
  foreach v_b in array (select array_agg(b order by b) from unnest(v_butacas) b) loop
    v_idx := v_idx + 1;
    v_tipo := public.tipo_butaca(v_b);
    v_precio := case when v_idx <= v_canje_ent + v_combos_cant then 0 else v_base end
              + case when v_tipo = 'vip' then v_conf.recargo_vip else 0 end;
    v_sub_ent := v_sub_ent + v_precio;
    v_entradas := v_entradas || jsonb_build_object(
      'butaca', v_b, 'tipo', v_tipo, 'precio', v_precio,
      'es_preventa', v_preventa and v_idx > v_canje_ent + v_combos_cant,
      'por_puntos', v_idx <= v_canje_ent,
      'por_combo', v_idx > v_canje_ent and v_idx <= v_canje_ent + v_combos_cant);
  end loop;

  -- Descuento: el mayor entre cupón de primera compra y cupón ingresado
  if v_uid is not null and v_conf.descuento_primera_compra > 0
     and not exists (select 1 from public.compras where usuario_id = v_uid) then
    v_pct := v_conf.descuento_primera_compra;
    v_origen := 'Primera compra';
  end if;

  if v_cod_cupon is not null then
    select * into v_cupon from public.cupones where codigo = v_cod_cupon;
    if not found or not v_cupon.activo
       or (v_cupon.desde is not null and public.hoy_ar() < v_cupon.desde)
       or (v_cupon.hasta is not null and public.hoy_ar() > v_cupon.hasta) then
      raise exception 'El cupón % no es válido o está vencido', v_cod_cupon;
    end if;
    if v_cupon.edad_minima is not null then
      if v_uid is null or v_perfil.fecha_nacimiento is null then
        raise exception 'El cupón % es exclusivo para usuarios registrados de % años o más', v_cod_cupon, v_cupon.edad_minima;
      end if;
      if public.edad_en(v_perfil.fecha_nacimiento, public.hoy_ar()) < v_cupon.edad_minima then
        raise exception 'El cupón % es exclusivo para mayores de % años', v_cod_cupon, v_cupon.edad_minima;
      end if;
    end if;
    if v_uid is not null and exists (
      select 1 from public.compras where usuario_id = v_uid and cupon_id = v_cupon.id and estado = 'pagada') then
      raise exception 'Ya usaste el cupón %', v_cod_cupon;
    end if;
    -- Los descuentos no se suman: el cupón solo sirve si mejora el que ya se tiene
    if v_cupon.porcentaje <= v_pct then
      raise exception 'El cupón % (% %%) no se aplica: ya tenés un descuento mayor por % (% %%). Los descuentos no se suman.',
        v_cod_cupon, v_cupon.porcentaje, lower(v_origen), v_pct;
    end if;
    v_pct := v_cupon.porcentaje;
    v_origen := 'Cupón ' || v_cupon.codigo;
    v_cupon_id := v_cupon.id;
  end if;

  v_descuento := round((v_sub_ent + v_sub_candy) * v_pct / 100.0, 2);
  v_total := v_sub_ent + v_sub_candy - v_descuento;

  if v_uid is not null and coalesce((p ->> 'usar_credito')::boolean, false) then
    v_credito := least(v_perfil.credito, v_total);
  end if;
  v_pagar := v_total - v_credito;
  if v_uid is not null then
    v_puntos_ganar := floor(v_pagar * v_conf.puntos_por_peso);
  end if;

  if not p_confirmar then
    return jsonb_build_object(
      'entradas', v_entradas, 'items', v_items, 'canjes', v_canjes,
      'subtotal_entradas', v_sub_ent, 'subtotal_candy', v_sub_candy,
      'descuento_porcentaje', v_pct, 'descuento_origen', v_origen, 'descuento', v_descuento,
      'total', v_total, 'credito_usado', v_credito, 'a_pagar', v_pagar,
      'puntos_usados', v_puntos_usar, 'puntos_a_ganar', v_puntos_ganar,
      'preventa', v_preventa, 'precio_base', v_base, 'aviso_edad', v_aviso_edad,
      'credito_disponible', coalesce(v_perfil.credito, 0), 'puntos_disponibles', coalesce(v_perfil.puntos, 0));
  end if;

  -- ===== Confirmación =====
  v_email := coalesce(v_perfil.email, nullif(trim(p ->> 'email'), ''));
  v_nombre := coalesce(nullif(trim(v_perfil.nombre || ' ' || v_perfil.apellido), ''), trim(coalesce(p ->> 'nombre', '')));
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ingresá un email válido para recibir la entrada';
  end if;
  if v_pagar > 0 and coalesce(p ->> 'tarjeta_ultimos4', '') !~ '^\d{4}$' then
    raise exception 'Falta el medio de pago';
  end if;

  perform pg_advisory_xact_lock(v_func.id);

  loop
    v_codigo := 'CC' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.compras where codigo = v_codigo);
  end loop;

  insert into public.compras (
    codigo, usuario_id, email_contacto, nombre_contacto, funcion_id,
    subtotal_entradas, subtotal_candy, descuento_porcentaje, descuento_origen, cupon_id, descuento,
    total, credito_usado, total_pagado, puntos_usados, puntos_ganados, tarjeta_ultimos4)
  values (
    v_codigo, v_uid, v_email, v_nombre, v_func.id,
    v_sub_ent, v_sub_candy, v_pct, v_origen, v_cupon_id, v_descuento,
    v_total, v_credito, v_pagar, v_puntos_usar, v_puntos_ganar,
    case when v_pagar > 0 then p ->> 'tarjeta_ultimos4' end)
  returning id into v_compra_id;

  for v_ent in select * from jsonb_array_elements(v_entradas) loop
    begin
      insert into public.butacas_ocupadas (funcion_id, butaca, compra_id)
      values (v_func.id, v_ent ->> 'butaca', v_compra_id);
    exception when unique_violation then
      raise exception 'La butaca % acaba de ser vendida. Elegí otra.', v_ent ->> 'butaca';
    end;
    insert into public.entradas (compra_id, butaca, tipo, precio, es_preventa, por_combo, por_puntos)
    values (v_compra_id, v_ent ->> 'butaca', v_ent ->> 'tipo', (v_ent ->> 'precio')::numeric,
            (v_ent ->> 'es_preventa')::boolean, (v_ent ->> 'por_combo')::boolean, (v_ent ->> 'por_puntos')::boolean);
  end loop;

  for v_it in select * from jsonb_array_elements(v_items) loop
    insert into public.compra_items (compra_id, producto_id, combo_id, nombre, cantidad, precio_unitario, por_puntos)
    values (v_compra_id, (v_it ->> 'producto_id')::bigint, (v_it ->> 'combo_id')::bigint, v_it ->> 'nombre',
            (v_it ->> 'cantidad')::int, (v_it ->> 'precio_unitario')::numeric, (v_it ->> 'por_puntos')::boolean);
  end loop;

  if v_uid is not null then
    update public.perfiles
    set puntos = puntos - v_puntos_usar + v_puntos_ganar,
        credito = credito - v_credito
    where id = v_uid;

    if v_puntos_usar > 0 then
      insert into public.movimientos_puntos (usuario_id, compra_id, puntos, tipo, detalle)
      select v_uid, v_compra_id, -(c ->> 'puntos')::int, 'canje', (c ->> 'cantidad') || ' × ' || (c ->> 'nombre')
      from jsonb_array_elements(v_canjes) c;
    end if;
    if v_puntos_ganar > 0 then
      insert into public.movimientos_puntos (usuario_id, compra_id, puntos, tipo, detalle)
      values (v_uid, v_compra_id, v_puntos_ganar, 'compra', 'Compra ' || v_codigo);
    end if;
    if v_credito > 0 then
      insert into public.movimientos_credito (usuario_id, compra_id, monto, tipo, detalle)
      values (v_uid, v_compra_id, -v_credito, 'uso', 'Usado en la compra ' || v_codigo);
    end if;
  end if;

  return jsonb_build_object('compra_id', v_compra_id, 'codigo', v_codigo, 'total', v_total, 'a_pagar', v_pagar,
                            'puntos_ganados', v_puntos_ganar);
end $$;

-- ---------------------------------------------------------------------
-- Detalle de una compra por código (para la confirmación y el PDF,
-- también para compras anónimas: el código actúa como comprobante)
-- ---------------------------------------------------------------------
create or replace function public.obtener_compra(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'codigo', c.codigo, 'estado', c.estado, 'email', c.email_contacto, 'nombre', c.nombre_contacto,
    'creada_en', c.creada_en, 'subtotal_entradas', c.subtotal_entradas, 'subtotal_candy', c.subtotal_candy,
    'descuento', c.descuento, 'descuento_origen', c.descuento_origen, 'total', c.total,
    'credito_usado', c.credito_usado, 'total_pagado', c.total_pagado, 'puntos_ganados', c.puntos_ganados,
    'puntos_usados', c.puntos_usados, 'entrada_validada_en', c.entrada_validada_en,
    'candy_entregado_en', c.candy_entregado_en,
    'funcion', jsonb_build_object('id', f.id, 'inicio', f.inicio, 'fin', f.fin, 'formato', f.formato,
                                  'idioma', f.idioma, 'sala', s.nombre),
    'pelicula', jsonb_build_object('id', pe.id, 'titulo', pe.titulo, 'poster_url', pe.poster_url,
                                   'clasificacion', pe.clasificacion, 'duracion_min', pe.duracion_min),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('butaca', e.butaca, 'tipo', e.tipo, 'precio', e.precio,
                                   'por_combo', e.por_combo, 'por_puntos', e.por_puntos, 'es_preventa', e.es_preventa)
                                   order by e.butaca) from public.entradas e where e.compra_id = c.id), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad,
                                   'precio_unitario', i.precio_unitario, 'por_puntos', i.por_puntos) order by i.id)
                       from public.compra_items i where i.compra_id = c.id), '[]'))
  from public.compras c
  join public.funciones f on f.id = c.funcion_id
  join public.salas s on s.id = f.sala_id
  join public.peliculas pe on pe.id = f.pelicula_id
  where c.codigo = upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g'))
$$;

-- ---------------------------------------------------------------------
-- Cancelación: hasta N horas antes, devuelve el importe como crédito
-- ---------------------------------------------------------------------
create or replace function public.cancelar_compra(p_compra_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_c       public.compras;
  v_inicio  timestamptz;
  v_horas   int;
  v_credito numeric;
  v_quitar  int;
begin
  select * into v_c from public.compras where id = p_compra_id for update;
  if not found or v_c.usuario_id is distinct from auth.uid() then
    raise exception 'Compra inexistente';
  end if;
  if v_c.estado <> 'pagada' then raise exception 'La compra ya estaba cancelada'; end if;
  if v_c.entrada_validada_en is not null or v_c.candy_entregado_en is not null then
    raise exception 'La compra ya fue utilizada y no puede cancelarse';
  end if;

  select inicio into v_inicio from public.funciones where id = v_c.funcion_id;
  select horas_limite_cancelacion into v_horas from public.configuracion where id = 1;
  if now() > v_inicio - make_interval(hours => v_horas) then
    raise exception 'Solo se puede cancelar hasta % horas antes de la función', v_horas;
  end if;

  v_credito := v_c.total_pagado + v_c.credito_usado;

  update public.compras set estado = 'cancelada', cancelada_en = now() where id = v_c.id;
  delete from public.butacas_ocupadas where compra_id = v_c.id;

  select least(puntos, v_c.puntos_ganados) into v_quitar from public.perfiles where id = v_c.usuario_id;
  update public.perfiles
  set credito = credito + v_credito,
      puntos  = puntos - v_quitar + v_c.puntos_usados
  where id = v_c.usuario_id;

  if v_credito > 0 then
    insert into public.movimientos_credito (usuario_id, compra_id, monto, tipo, detalle)
    values (v_c.usuario_id, v_c.id, v_credito, 'cancelacion', 'Cancelación de la compra ' || v_c.codigo);
  end if;
  if v_quitar > 0 then
    insert into public.movimientos_puntos (usuario_id, compra_id, puntos, tipo, detalle)
    values (v_c.usuario_id, v_c.id, -v_quitar, 'anulacion', 'Puntos de la compra cancelada ' || v_c.codigo);
  end if;
  if v_c.puntos_usados > 0 then
    insert into public.movimientos_puntos (usuario_id, compra_id, puntos, tipo, detalle)
    values (v_c.usuario_id, v_c.id, v_c.puntos_usados, 'devolucion', 'Canje devuelto por cancelación ' || v_c.codigo);
  end if;

  perform public.log_actividad('cancelar', 'compras', v_c.id::text, v_c.codigo,
    jsonb_build_object('credito_devuelto', v_credito));
  return jsonb_build_object('credito_devuelto', v_credito);
end $$;

-- ---------------------------------------------------------------------
-- Validación de QR (empleados). Cada sector se puede usar una sola vez.
-- ---------------------------------------------------------------------
create or replace function public.validar_codigo(p_codigo text, p_sector text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_c       public.compras;
  v_f       public.funciones;
  v_detalle jsonb;
  v_codigo  text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.es_staff() then raise exception 'Acceso solo para personal del cine'; end if;
  if p_sector not in ('entrada', 'candy') then raise exception 'Sector inválido'; end if;

  select * into v_c from public.compras where codigo = v_codigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Código inexistente');
  end if;
  v_detalle := public.obtener_compra(v_codigo);
  select * into v_f from public.funciones where id = v_c.funcion_id;

  if v_c.estado = 'cancelada' then
    return jsonb_build_object('ok', false, 'motivo', 'La compra fue cancelada', 'compra', v_detalle);
  end if;

  if p_sector = 'entrada' then
    if v_c.entrada_validada_en is not null then
      return jsonb_build_object('ok', false, 'motivo', 'Este QR ya fue usado para ingresar', 'compra', v_detalle);
    end if;
    if now() < v_f.inicio - interval '60 minutes' then
      return jsonb_build_object('ok', false, 'motivo', 'El ingreso se habilita 1 hora antes de la función', 'compra', v_detalle);
    end if;
    if now() > v_f.fin then
      return jsonb_build_object('ok', false, 'motivo', 'La función ya terminó', 'compra', v_detalle);
    end if;
    update public.compras set entrada_validada_en = now(), entrada_validada_por = auth.uid() where id = v_c.id;
  else
    if not exists (select 1 from public.compra_items where compra_id = v_c.id) then
      return jsonb_build_object('ok', false, 'motivo', 'La compra no incluye productos del candy', 'compra', v_detalle);
    end if;
    if v_c.candy_entregado_en is not null then
      return jsonb_build_object('ok', false, 'motivo', 'Los productos ya fueron entregados', 'compra', v_detalle);
    end if;
    if now() < v_f.inicio - interval '3 hours' or now() > v_f.fin + interval '1 hour' then
      return jsonb_build_object('ok', false, 'motivo', 'El retiro se habilita el día de la función, desde 3 horas antes', 'compra', v_detalle);
    end if;
    update public.compras set candy_entregado_en = now(), candy_entregado_por = auth.uid() where id = v_c.id;
  end if;

  perform public.log_actividad(case p_sector when 'entrada' then 'validar_entrada' else 'entregar_candy' end,
    'compras', v_c.id::text, v_c.codigo, jsonb_build_object('funcion_id', v_c.funcion_id));
  return jsonb_build_object('ok', true, 'motivo',
    case p_sector when 'entrada' then 'Ingreso habilitado' else 'Entregar productos' end,
    'compra', public.obtener_compra(v_codigo));
end $$;

-- ---------------------------------------------------------------------
-- Completar el perfil (la fecha de nacimiento solo si estaba vacía)
-- ---------------------------------------------------------------------
drop function if exists public.completar_perfil(text, text, date);
create or replace function public.completar_perfil(
  p_nombre           text,
  p_apellido         text,
  p_fecha_nacimiento date default null,
  p_tipo_sangre      text default null,
  p_color_ojos       text default null,
  p_dias_vacaciones  int  default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para completar tus datos'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 or length(trim(coalesce(p_apellido, ''))) < 2 then
    raise exception 'Completá nombre y apellido';
  end if;
  if p_fecha_nacimiento is not null
     and (p_fecha_nacimiento > public.hoy_ar() or p_fecha_nacimiento < public.hoy_ar() - interval '110 years') then
    raise exception 'La fecha de nacimiento no es válida';
  end if;

  update public.perfiles
  set nombre = trim(p_nombre),
      apellido = trim(p_apellido),
      fecha_nacimiento = coalesce(fecha_nacimiento, p_fecha_nacimiento),
      tipo_sangre = coalesce(p_tipo_sangre, tipo_sangre),
      color_ojos = coalesce(p_color_ojos, color_ojos),
      dias_vacaciones = coalesce(p_dias_vacaciones, dias_vacaciones)
  where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Gestión de roles (solo admin)
-- ---------------------------------------------------------------------
create or replace function public.asignar_rol(p_email text, p_rol text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ant text;
begin
  if not public.es_admin() then raise exception 'Solo un administrador puede cambiar roles'; end if;
  if p_rol not in ('cliente', 'empleado', 'admin') then raise exception 'Rol inválido'; end if;
  select id, rol into v_id, v_ant from public.perfiles where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'No existe un usuario registrado con ese email'; end if;
  if v_id = auth.uid() then raise exception 'No podés cambiar tu propio rol'; end if;
  update public.perfiles set rol = p_rol where id = v_id;
  perform public.log_actividad('cambiar_rol', 'perfiles', v_id::text, p_email,
    jsonb_build_object('rol', jsonb_build_object('antes', v_ant, 'despues', p_rol)));
end $$;

-- ---------------------------------------------------------------------
-- Alertas de "Próximamente": genera notificaciones cuando abre la venta.
-- Idempotente: la app la llama al iniciar y también puede correr por cron.
-- ---------------------------------------------------------------------
create or replace function public.procesar_alertas() returns int
language plpgsql security definer set search_path = public as $$
declare v_cant int;
begin
  with listas as (
    select a.usuario_id, a.pelicula_id, p.titulo, p.preventa_habilitada
    from public.alertas a
    join public.peliculas p on p.id = a.pelicula_id
    where a.notificada_en is null
      and p.visible
      and now() >= public.apertura_venta(p.fecha_estreno, p.preventa_habilitada, p.preventa_dias)
      and exists (select 1 from public.funciones f where f.pelicula_id = p.id and f.activa and f.inicio > now())
    for update of a skip locked
  ), marcadas as (
    update public.alertas a set notificada_en = now()
    from listas l where a.usuario_id = l.usuario_id and a.pelicula_id = l.pelicula_id
    returning a.usuario_id, a.pelicula_id
  )
  insert into public.notificaciones (usuario_id, titulo, cuerpo, url)
  select l.usuario_id,
         '¡Ya podés sacar entradas!',
         l.titulo || case when l.preventa_habilitada then ' está en preventa con precio especial.' else ' ya tiene entradas a la venta.' end,
         '/pelicula/' || l.pelicula_id
  from listas l join marcadas m using (usuario_id, pelicula_id);
  get diagnostics v_cant = row_count;
  return v_cant;
end $$;

-- ---------------------------------------------------------------------
-- Reportes (solo admin)
-- ---------------------------------------------------------------------
create or replace function public.reporte_facturacion(p_desde date, p_hasta date)
returns table (fecha date, compras bigint, entradas bigint, facturado numeric, cobrado_tarjeta numeric, credito_aplicado numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select d::date,
         count(c.id),
         coalesce(sum((select count(*) from public.entradas e where e.compra_id = c.id)), 0)::bigint,
         coalesce(sum(c.total), 0),
         coalesce(sum(c.total_pagado), 0),
         coalesce(sum(c.credito_usado), 0)
  from generate_series(p_desde, p_hasta, interval '1 day') d
  left join public.compras c
    on c.estado = 'pagada'
   and (c.creada_en at time zone 'America/Argentina/Buenos_Aires')::date = d::date
  group by d
  order by d;
end $$;

create or replace function public.ranking_peliculas(p_desde date, p_hasta date, p_limite int default 8)
returns table (pelicula_id bigint, titulo text, poster_url text, entradas bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  return query
  select pe.id, pe.titulo, pe.poster_url, count(e.id)
  from public.entradas e
  join public.compras c on c.id = e.compra_id and c.estado = 'pagada'
  join public.funciones f on f.id = c.funcion_id
  join public.peliculas pe on pe.id = f.pelicula_id
  where (f.inicio at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  group by pe.id
  order by count(e.id) desc, pe.titulo
  limit p_limite;
end $$;

-- Unidades vendidas por producto, sumando las que forman parte de combos.
create or replace function public.ranking_productos(p_desde date, p_hasta date)
returns table (producto_id bigint, nombre text, unidades bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo administradores'; end if;
  return query
  with ventas as (
    select i.producto_id, i.cantidad::bigint as unidades
    from public.compra_items i
    join public.compras c on c.id = i.compra_id and c.estado = 'pagada'
    where i.producto_id is not null
      and (c.creada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    union all
    select cp.producto_id, (i.cantidad * cp.cantidad)::bigint
    from public.compra_items i
    join public.compras c on c.id = i.compra_id and c.estado = 'pagada'
    join public.combo_productos cp on cp.combo_id = i.combo_id
    where (c.creada_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
  )
  select pr.id, pr.nombre, sum(v.unidades)::bigint
  from ventas v join public.productos pr on pr.id = v.producto_id
  group by pr.id
  order by sum(v.unidades) desc;
end $$;

-- ---------------------------------------------------------------------
-- Vista pública de películas con datos calculados
-- (corre con permisos del dueño: expone solo agregados y películas visibles)
-- Una película publicada se muestra mientras tenga funciones próximas (cartelera)
-- o mientras todavía no abrió la venta (próximamente). Si abre la venta y no tiene
-- funciones, o ya pasó su última función, deja de mostrarse sola.
-- Los usuarios registrados menores de 18 (o de 13) no ven las películas +18 (o +13).
-- ---------------------------------------------------------------------
create view public.v_peliculas as
select p.id, p.titulo, p.sinopsis, p.duracion_min, p.poster_url, p.fondo_url, p.trailer_youtube,
       p.clasificacion, p.fecha_estreno, p.preventa_habilitada, p.preventa_dias, p.preventa_descuento,
       public.apertura_venta(p.fecha_estreno, p.preventa_habilitada, p.preventa_dias) as venta_desde,
       (p.preventa_habilitada and public.hoy_ar() < p.fecha_estreno
        and now() >= public.apertura_venta(p.fecha_estreno, true, p.preventa_dias)) as en_preventa,
       (p.fecha_estreno > public.hoy_ar()) as proximamente,
       coalesce(rs.promedio, 0) as promedio,
       coalesce(rs.cantidad, 0) as cantidad_resenas,
       coalesce(vs.vendidas, 0) as vendidas,
       coalesce(g.generos, '{}') as generos,
       exists (select 1 from public.funciones f
               where f.pelicula_id = p.id and f.activa and f.inicio > now()) as tiene_funciones
from public.peliculas p
left join lateral (
  select round(avg(r.estrellas)::numeric, 1) as promedio, count(*) as cantidad
  from public.resenas r where r.pelicula_id = p.id) rs on true
left join lateral (
  select count(*) as vendidas
  from public.entradas e
  join public.compras c on c.id = e.compra_id and c.estado = 'pagada'
  join public.funciones f on f.id = c.funcion_id
  where f.pelicula_id = p.id) vs on true
left join lateral (
  select array_agg(gn.nombre order by gn.nombre) as generos
  from public.pelicula_generos pg join public.generos gn on gn.id = pg.genero_id
  where pg.pelicula_id = p.id) g on true
where p.visible
  and (exists (select 1 from public.funciones f
               where f.pelicula_id = p.id and f.activa and f.inicio > now())
       or now() < public.apertura_venta(p.fecha_estreno, p.preventa_habilitada, p.preventa_dias))
  and (p.clasificacion = 'ATP'
       or not exists (select 1 from public.perfiles pf
                      where pf.id = auth.uid() and pf.fecha_nacimiento is not null
                        and public.edad_en(pf.fecha_nacimiento, public.hoy_ar())
                            < case p.clasificacion when '+18' then 18 else 13 end));

-- =====================================================================
--  SEGURIDAD: Row Level Security
-- =====================================================================
alter table public.perfiles            enable row level security;
alter table public.configuracion       enable row level security;
alter table public.formatos            enable row level security;
alter table public.peliculas           enable row level security;
alter table public.generos             enable row level security;
alter table public.pelicula_generos    enable row level security;
alter table public.salas               enable row level security;
alter table public.funciones           enable row level security;
alter table public.categorias          enable row level security;
alter table public.productos           enable row level security;
alter table public.combos              enable row level security;
alter table public.combo_productos     enable row level security;
alter table public.cupones             enable row level security;
alter table public.recompensas         enable row level security;
alter table public.compras             enable row level security;
alter table public.entradas            enable row level security;
alter table public.compra_items        enable row level security;
alter table public.butacas_ocupadas    enable row level security;
alter table public.movimientos_puntos  enable row level security;
alter table public.movimientos_credito enable row level security;
alter table public.resenas             enable row level security;
alter table public.alertas             enable row level security;
alter table public.notificaciones      enable row level security;
alter table public.suscripciones_push  enable row level security;
alter table public.actividad           enable row level security;

-- Perfiles: cada uno ve el suyo; el admin ve todos.
create policy perfiles_select on public.perfiles for select
  using (id = auth.uid() or public.es_admin());
create policy perfiles_update on public.perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- Solo nombre y apellido son editables por el usuario (puntos, crédito, rol y fecha de nacimiento no).
revoke update on public.perfiles from anon, authenticated;
grant update (nombre, apellido) on public.perfiles to authenticated;

-- Catálogo público: lectura para todos, escritura solo admin.
do $$
declare t text;
begin
  foreach t in array array['configuracion', 'formatos', 'generos', 'pelicula_generos', 'salas', 'funciones',
                           'categorias', 'productos', 'combos', 'combo_productos', 'recompensas'] loop
    execute format('create policy %I on public.%I for select using (true)', t || '_lectura', t);
    execute format('create policy %I on public.%I for all using (public.es_admin()) with check (public.es_admin())',
                   t || '_admin', t);
  end loop;
end $$;

create policy peliculas_lectura on public.peliculas for select using (visible or public.es_admin());
create policy peliculas_admin on public.peliculas for all
  using (public.es_admin()) with check (public.es_admin());

create policy cupones_admin on public.cupones for all
  using (public.es_admin()) with check (public.es_admin());

-- Compras: el dueño y el personal pueden leer. Se escriben solo vía RPC.
create policy compras_lectura on public.compras for select
  using (usuario_id = auth.uid() or public.es_staff());
create policy entradas_lectura on public.entradas for select
  using (exists (select 1 from public.compras c where c.id = compra_id
                 and (c.usuario_id = auth.uid() or public.es_staff())));
create policy compra_items_lectura on public.compra_items for select
  using (exists (select 1 from public.compras c where c.id = compra_id
                 and (c.usuario_id = auth.uid() or public.es_staff())));

create policy butacas_lectura on public.butacas_ocupadas for select using (true);

create policy mov_puntos_lectura on public.movimientos_puntos for select
  using (usuario_id = auth.uid() or public.es_admin());
create policy mov_credito_lectura on public.movimientos_credito for select
  using (usuario_id = auth.uid() or public.es_admin());

create policy resenas_lectura on public.resenas for select using (true);
create policy resenas_insert on public.resenas for insert to authenticated with check (usuario_id = auth.uid());
create policy resenas_update on public.resenas for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy resenas_delete on public.resenas for delete to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

create policy alertas_propias on public.alertas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy notificaciones_lectura on public.notificaciones for select using (usuario_id = auth.uid());
create policy notificaciones_marcar on public.notificaciones for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy push_propias on public.suscripciones_push for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy actividad_admin on public.actividad for select using (public.es_admin());

-- Funciones de admin/staff: no exponerlas a usuarios anónimos.
revoke execute on function public.programar_funciones(bigint, text, text, date, date, int[], text[], numeric, uuid) from public, anon;
revoke execute on function public.quitar_tanda(uuid) from public, anon;
revoke execute on function public.ocultar_sin_funciones() from public, anon;
revoke execute on function public.quitar_funciones(bigint, timestamptz, timestamptz) from public, anon;
grant execute on function public.quitar_funciones(bigint, timestamptz, timestamptz) to authenticated;
revoke execute on function public.completar_perfil(text, text, date, text, text, int) from public, anon;
grant execute on function public.completar_perfil(text, text, date, text, text, int) to authenticated;
revoke execute on function public.asignar_rol(text, text) from public, anon;
revoke execute on function public.validar_codigo(text, text) from public, anon;
revoke execute on function public.cancelar_compra(uuid) from public, anon;
revoke execute on function public.reporte_facturacion(date, date) from public, anon;
revoke execute on function public.ranking_peliculas(date, date, int) from public, anon;
revoke execute on function public.ranking_productos(date, date) from public, anon;
grant execute on function public.programar_funciones(bigint, text, text, date, date, int[], text[], numeric, uuid) to authenticated;
grant execute on function public.quitar_tanda(uuid) to authenticated;
grant execute on function public.ocultar_sin_funciones() to authenticated;
grant execute on function public.asignar_rol(text, text) to authenticated;
grant execute on function public.validar_codigo(text, text) to authenticated;
grant execute on function public.cancelar_compra(uuid) to authenticated;
grant execute on function public.reporte_facturacion(date, date) to authenticated;
grant execute on function public.ranking_peliculas(date, date, int) to authenticated;
grant execute on function public.ranking_productos(date, date) to authenticated;

-- =====================================================================
--  REALTIME: butacas en vivo y notificaciones
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table public.butacas_ocupadas;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.notificaciones;
exception when duplicate_object then null;
end $$;

-- =====================================================================
--  STORAGE: bucket público para pósters e imágenes de productos
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = true;

drop policy if exists imagenes_lectura on storage.objects;
drop policy if exists imagenes_admin_alta on storage.objects;
drop policy if exists imagenes_admin_modif on storage.objects;
drop policy if exists imagenes_admin_baja on storage.objects;

create policy imagenes_lectura on storage.objects for select
  using (bucket_id = 'imagenes');
create policy imagenes_admin_alta on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes' and public.es_admin());
create policy imagenes_admin_modif on storage.objects for update to authenticated
  using (bucket_id = 'imagenes' and public.es_admin());
create policy imagenes_admin_baja on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes' and public.es_admin());
