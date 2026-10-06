-- =====================================================================
--  CINECORN · Datos iniciales (opcional)
--  Ejecutar DESPUÉS de 01_esquema.sql. Carga salas, candy bar, beneficios
--  y cupones de ejemplo. Las películas se cargan desde el panel de
--  administración (importando sus datos de TMDB) y ahí se programan.
-- =====================================================================



insert into public.salas (nombre) values
  ('Sala 1'), ('Sala 2'), ('Sala 3'), ('Sala 4'), ('Sala 5'), ('Sala 6');

-- Dos butacas fuera de servicio en la Sala 3 (distribución configurable desde el admin)
update public.salas set butacas_inhabilitadas = '{E14,E15}' where nombre = 'Sala 3';

update public.salas set formatos = '{2D,3D}' where nombre in ('Sala 3', 'Sala 4');
update public.salas set formatos = '{2D,3D,4D}' where nombre = 'Sala 5';
update public.salas set formatos = '{2D,3D,4D,5D}' where nombre = 'Sala 6';

insert into public.generos (nombre) values
  ('Acción'),
  ('Animación'),
  ('Aventura'),
  ('Ciencia ficción'),
  ('Comedia'),
  ('Crimen'),
  ('Drama'),
  ('Familia'),
  ('Fantasía'),
  ('Historia'),
  ('Misterio'),
  ('Música'),
  ('Romance'),
  ('Suspense'),
  ('Terror')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- Candy bar
-- ---------------------------------------------------------------------
insert into public.categorias (nombre, orden) values
  ('Pochoclos', 1), ('Bebidas', 2), ('Golosinas', 3), ('Snacks', 4);

insert into public.productos (categoria_id, nombre, descripcion, precio)
select c.id, v.nombre, v.descripcion, v.precio
from (values
  ('Pochoclos', 'Pochoclo chico', 'Dulce o salado, 80 g', 4500),
  ('Pochoclos', 'Pochoclo mediano', 'Dulce o salado, 130 g', 6200),
  ('Pochoclos', 'Pochoclo grande', 'Dulce o salado, 200 g', 7800),
  ('Bebidas', 'Gaseosa mediana', 'Línea cola, lima-limón o naranja, 500 ml', 3800),
  ('Bebidas', 'Gaseosa grande', 'Línea cola, lima-limón o naranja, 750 ml', 4600),
  ('Bebidas', 'Agua mineral', 'Con o sin gas, 500 ml', 2600),
  ('Golosinas', 'Confites de chocolate', 'Bolsa de 90 g', 3200),
  ('Golosinas', 'Barra de chocolate', 'Con maní, 100 g', 2900),
  ('Snacks', 'Nachos con cheddar', 'Porción con dip de queso', 6900),
  ('Snacks', 'Pancho clásico', 'Con aderezos a elección', 4200)
) as v(categoria, nombre, descripcion, precio)
join public.categorias c on c.nombre = v.categoria;

insert into public.combos (nombre, descripcion, precio) values
  ('Clásico', 'Entrada + pochoclo mediano + gaseosa mediana', 16500),
  ('Gran pantalla', 'Entrada + pochoclo grande + gaseosa grande + confites', 21900),
  ('Nachero', 'Entrada + nachos con cheddar + gaseosa mediana', 17200);

insert into public.combo_productos (combo_id, producto_id, cantidad)
select co.id, pr.id, 1
from (values
  ('Clásico', 'Pochoclo mediano'), ('Clásico', 'Gaseosa mediana'),
  ('Gran pantalla', 'Pochoclo grande'), ('Gran pantalla', 'Gaseosa grande'),
  ('Gran pantalla', 'Confites de chocolate'),
  ('Nachero', 'Nachos con cheddar'), ('Nachero', 'Gaseosa mediana')
) as v(combo, producto)
join public.combos co on co.nombre = v.combo
join public.productos pr on pr.nombre = v.producto;

-- ---------------------------------------------------------------------
-- Fidelización y cupones
-- ---------------------------------------------------------------------
insert into public.recompensas (nombre, tipo, producto_id, puntos)
values ('Entrada gratis', 'entrada', null, 20000);
insert into public.recompensas (nombre, tipo, producto_id, puntos)
select 'Pochoclo grande', 'producto', id, 7000 from public.productos where nombre = 'Pochoclo grande';
insert into public.recompensas (nombre, tipo, producto_id, puntos)
select 'Gaseosa grande', 'producto', id, 4500 from public.productos where nombre = 'Gaseosa grande';

insert into public.cupones (codigo, descripcion, porcentaje, edad_minima) values
  ('MAYORES50', 'Beneficio para mayores de 50 años', 30, 50),
  ('CINEFAN10', 'Descuento promocional', 10, null);

-- La carga inicial no cuenta como actividad de ningún usuario
delete from public.actividad;

select nombre, formatos from public.salas order by nombre;
