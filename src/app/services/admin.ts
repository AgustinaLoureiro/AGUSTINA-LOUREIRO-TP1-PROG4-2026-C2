import { inject, Service } from '@angular/core';
import { Supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import {
  CodigoFormato,
  Formato,
  Funcion,
  Genero,
  Idioma,
  Pelicula,
  PeliculaPorGuardar,
  ResultadoProgramacion,
  Sala,
} from '../interfaces/catalogo';
import { Categoria, Combo, Configuracion, Cupon, Producto, Recompensa } from '../interfaces/candy';
import { Actividad, Perfil, Rol } from '../interfaces/usuario';

/**
 * Operaciones del panel de administración. La autorización real la hace la base:
 * las políticas RLS solo permiten escribir a quien tiene rol 'admin', y cada cambio
 * queda registrado en el log de actividad por triggers.
 */
@Service()
export class AdminDatos {
  private sup = inject(Supabase);
  private db = () => this.sup.Supabase;

  // ---------------- Películas ----------------
  async peliculas(): Promise<Pelicula[]> {
    const { data, error } = await this.db()
      .from('peliculas')
      .select('*, pelicula_generos(genero_id)')
      .order('fecha_estreno', { ascending: false });
    if (error) throw error;
    return data as Pelicula[];
  }

  async pelicula(id: number): Promise<Pelicula> {
    const { data, error } = await this.db()
      .from('peliculas')
      .select('*, pelicula_generos(genero_id)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Pelicula;
  }

  async guardarPelicula(
    datos: PeliculaPorGuardar,
    generoIds: number[],
    id?: number,
  ): Promise<number> {
    const consulta = id
      ? this.db().from('peliculas').update(datos).eq('id', id).select('id').single()
      : this.db().from('peliculas').insert(datos).select('id').single();
    const { data, error } = await consulta;
    if (error) throw error;
    const peliculaId = (data as { id: number }).id;

    await this.db().from('pelicula_generos').delete().eq('pelicula_id', peliculaId);
    if (generoIds.length) {
      const { error: e2 } = await this.db()
        .from('pelicula_generos')
        .insert(generoIds.map((genero_id) => ({ pelicula_id: peliculaId, genero_id })));
      if (e2) throw e2;
    }
    return peliculaId;
  }

  async cambiarVisibilidad(id: number, visible: boolean) {
    const { error } = await this.db().from('peliculas').update({ visible }).eq('id', id);
    if (error) throw error;
  }

  /** Oculta las películas cuya última función ya pasó. Devuelve cuántas ocultó. */
  async ocultarSinFunciones(): Promise<number> {
    const { data, error } = await this.db().rpc('ocultar_sin_funciones');
    if (error) throw error;
    return data as number;
  }

  async eliminarPelicula(id: number) {
    const { error } = await this.db().from('peliculas').delete().eq('id', id);
    if (error) throw error;
  }

  async generos(): Promise<Genero[]> {
    const { data, error } = await this.db().from('generos').select('*').order('nombre');
    if (error) throw error;
    return data as Genero[];
  }

  /** Devuelve los ids de los géneros, creando los que no existan (importación desde TMDB). */
  async asegurarGeneros(nombres: string[]): Promise<number[]> {
    if (!nombres.length) return [];
    await this.db()
      .from('generos')
      .upsert(
        nombres.map((nombre) => ({ nombre })),
        { onConflict: 'nombre', ignoreDuplicates: true },
      );
    const { data, error } = await this.db()
      .from('generos')
      .select('id, nombre')
      .in('nombre', nombres);
    if (error) throw error;
    return (data as Genero[]).map((g) => g.id);
  }

  // ---------------- Salas y funciones ----------------
  async salas(): Promise<Sala[]> {
    const { data, error } = await this.db().from('salas').select('*').order('id');
    if (error) throw error;
    return data as Sala[];
  }

  async crearSala(nombre: string, formatos: CodigoFormato[]) {
    const { error } = await this.db().from('salas').insert({ nombre, activa: true, formatos });
    if (error) throw error;
  }

  /** Solo se puede eliminar una sala sin funciones (la base lo impide si tiene). */
  async eliminarSala(id: number) {
    const { error } = await this.db().from('salas').delete().eq('id', id);
    if (error) throw error;
  }

  async actualizarSala(
    id: number,
    cambios: Partial<Pick<Sala, 'nombre' | 'activa' | 'butacas_inhabilitadas' | 'formatos'>>,
  ) {
    const { error } = await this.db().from('salas').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async formatos(): Promise<Formato[]> {
    const { data, error } = await this.db().from('formatos').select('*').order('precio');
    if (error) throw error;
    return data as Formato[];
  }

  async actualizarPrecioFormato(codigo: CodigoFormato, precio: number) {
    const { error } = await this.db().from('formatos').update({ precio }).eq('codigo', codigo);
    if (error) throw error;
  }

  /** Programación con asignación automática de sala (RPC en la base). */
  async programarFunciones(p: {
    peliculaId: number;
    formato: CodigoFormato;
    idioma: Idioma;
    desde: string;
    hasta: string;
    dias: number[];
    horarios: string[];
    tanda: string;
  }): Promise<ResultadoProgramacion[]> {
    const { data, error } = await this.db().rpc('programar_funciones', {
      p_pelicula_id: p.peliculaId,
      p_formato: p.formato,
      p_idioma: p.idioma,
      p_desde: p.desde,
      p_hasta: p.hasta,
      p_dias: p.dias,
      p_horarios: p.horarios,
      p_tanda: p.tanda,
    });
    if (error) throw error;
    return data as ResultadoProgramacion[];
  }

  async funcionesDelDia(
    desdeISO: string,
    hastaISO: string,
  ): Promise<(Funcion & { vendidas: number })[]> {
    const { data, error } = await this.db()
      .from('funciones')
      .select(
        '*, salas(nombre), peliculas(id, titulo, poster_url, clasificacion, duracion_min), butacas_ocupadas(count)',
      )
      .gte('inicio', desdeISO)
      .lt('inicio', hastaISO)
      .order('inicio');
    if (error) throw error;
    return (data as (Funcion & { butacas_ocupadas: { count: number }[] })[]).map((f) => ({
      ...f,
      vendidas: f.butacas_ocupadas?.[0]?.count ?? 0,
    }));
  }

  /** Funciones activas de acá en adelante, con la cantidad de butacas vendidas. */
  async funcionesProximas(): Promise<(Funcion & { vendidas: number })[]> {
    return this.funcionesFuturas(
      '*, salas(nombre), peliculas(id, titulo, poster_url, clasificacion, duracion_min), butacas_ocupadas(count)',
    );
  }

  /** Funciones próximas de una película, con sala y entradas vendidas. */
  async funcionesDePelicula(peliculaId: number): Promise<(Funcion & { vendidas: number })[]> {
    return this.funcionesFuturas('*, salas(nombre), butacas_ocupadas(count)', peliculaId);
  }

  /**
   * Supabase devuelve como máximo 1000 filas por consulta: las funciones se piden
   * de a páginas hasta traerlas todas.
   */
  private async funcionesFuturas(
    columnas: string,
    peliculaId?: number,
  ): Promise<(Funcion & { vendidas: number })[]> {
    const PAGINA = 1000;
    const ahora = new Date().toISOString();
    const todas: (Funcion & { butacas_ocupadas: { count: number }[] })[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      let consulta = this.db()
        .from('funciones')
        .select(columnas)
        .eq('activa', true)
        .gt('inicio', ahora);
      if (peliculaId) consulta = consulta.eq('pelicula_id', peliculaId);
      const { data, error } = await consulta
        .order('inicio')
        .order('id')
        .range(desde, desde + PAGINA - 1);
      if (error) throw error;
      todas.push(...(data as unknown as typeof todas));
      if (data.length < PAGINA) break;
    }
    return todas.map((f) => ({ ...f, vendidas: f.butacas_ocupadas?.[0]?.count ?? 0 }));
  }

  /** Cantidad de funciones próximas de cada película (id → cantidad), contadas por la base. */
  async funcionesProximasPorPelicula(): Promise<Map<number, number>> {
    const { data, error } = await this.db()
      .from('peliculas')
      .select('id, funciones(count)')
      .eq('funciones.activa', true)
      .gt('funciones.inicio', new Date().toISOString());
    if (error) throw error;
    return new Map(
      (data as { id: number; funciones: { count: number }[] }[]).map((p) => [
        p.id,
        p.funciones?.[0]?.count ?? 0,
      ]),
    );
  }

  async quitarFunciones(
    peliculaId: number,
    desdeISO: string,
  ): Promise<{ eliminadas: number; con_ventas: number }> {
    const { data, error } = await this.db().rpc('quitar_funciones', {
      p_pelicula_id: peliculaId,
      p_desde: desdeISO,
    });
    if (error) throw error;
    return data as { eliminadas: number; con_ventas: number };
  }

  /** Deshace una programación: quita sus funciones futuras sin entradas vendidas. */
  async quitarTanda(tanda: string): Promise<{ eliminadas: number; con_ventas: number }> {
    const { data, error } = await this.db().rpc('quitar_tanda', { p_tanda: tanda });
    if (error) throw error;
    return data as { eliminadas: number; con_ventas: number };
  }

  /** Avisa a quienes activaron la alerta de una película si ya abrió su venta. */
  async procesarAlertas() {
    await this.db().rpc('procesar_alertas');
  }

  /** Envía un aviso: destino = 'clientes', 'todos' o el email de un usuario. Devuelve cuántos se enviaron. */
  async enviarNotificacion(
    destino: string,
    titulo: string,
    cuerpo: string,
    url: string,
  ): Promise<number> {
    const { data, error } = await this.db().rpc('enviar_notificacion', {
      p_destino: destino,
      p_titulo: titulo,
      p_cuerpo: cuerpo,
      p_url: url,
    });
    if (error) throw error;
    return data as number;
  }

  async actualizarFuncion(id: number, cambios: Partial<Pick<Funcion, 'precio' | 'activa'>>) {
    const { error } = await this.db().from('funciones').update(cambios).eq('id', id);
    if (error) throw error;
  }

  async eliminarFuncion(id: number) {
    const { error } = await this.db().from('funciones').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------------- Candy ----------------
  async categorias(): Promise<Categoria[]> {
    const { data, error } = await this.db().from('categorias').select('*').order('orden');
    if (error) throw error;
    return data as Categoria[];
  }

  async guardarCategoria(c: Omit<Categoria, 'id'>, id?: number) {
    const { error } = id
      ? await this.db().from('categorias').update(c).eq('id', id)
      : await this.db().from('categorias').insert(c);
    if (error) throw error;
  }

  async eliminarCategoria(id: number) {
    const { error } = await this.db().from('categorias').delete().eq('id', id);
    if (error) throw error;
  }

  async productos(): Promise<Producto[]> {
    const { data, error } = await this.db().from('productos').select('*').order('nombre');
    if (error) throw error;
    return data as Producto[];
  }

  async guardarProducto(p: Omit<Producto, 'id'>, id?: number) {
    const { error } = id
      ? await this.db().from('productos').update(p).eq('id', id)
      : await this.db().from('productos').insert(p);
    if (error) throw error;
  }

  async eliminarProducto(id: number) {
    const { error } = await this.db().from('productos').delete().eq('id', id);
    if (error) throw error;
  }

  async combos(): Promise<Combo[]> {
    const { data, error } = await this.db()
      .from('combos')
      .select('*, combo_productos(producto_id, cantidad, productos(nombre))')
      .order('precio');
    if (error) throw error;
    return data as Combo[];
  }

  async guardarCombo(
    c: Omit<Combo, 'id' | 'combo_productos'>,
    items: { producto_id: number; cantidad: number }[],
    id?: number,
  ) {
    const consulta = id
      ? this.db().from('combos').update(c).eq('id', id).select('id').single()
      : this.db().from('combos').insert(c).select('id').single();
    const { data, error } = await consulta;
    if (error) throw error;
    const comboId = (data as { id: number }).id;
    await this.db().from('combo_productos').delete().eq('combo_id', comboId);
    const { error: e2 } = await this.db()
      .from('combo_productos')
      .insert(items.map((i) => ({ ...i, combo_id: comboId })));
    if (e2) throw e2;
  }

  async eliminarCombo(id: number) {
    const { error } = await this.db().from('combos').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------------- Fidelización ----------------
  async configuracion(): Promise<Configuracion> {
    const { data, error } = await this.db().from('configuracion').select('*').single();
    if (error) throw error;
    return data as Configuracion;
  }

  async guardarConfiguracion(c: Partial<Configuracion>) {
    const { error } = await this.db().from('configuracion').update(c).eq('id', 1);
    if (error) throw error;
  }

  async cupones(): Promise<Cupon[]> {
    const { data, error } = await this.db()
      .from('cupones')
      .select('*')
      .order('id', { ascending: false });
    if (error) throw error;
    return data as Cupon[];
  }

  async guardarCupon(c: Omit<Cupon, 'id'>, id?: number) {
    const { error } = id
      ? await this.db().from('cupones').update(c).eq('id', id)
      : await this.db().from('cupones').insert(c);
    if (error) throw error;
  }

  async eliminarCupon(id: number) {
    const { error } = await this.db().from('cupones').delete().eq('id', id);
    if (error) throw error;
  }

  async recompensas(): Promise<Recompensa[]> {
    const { data, error } = await this.db().from('recompensas').select('*').order('puntos');
    if (error) throw error;
    return data as Recompensa[];
  }

  async guardarRecompensa(r: Omit<Recompensa, 'id'>, id?: number) {
    const { error } = id
      ? await this.db().from('recompensas').update(r).eq('id', id)
      : await this.db().from('recompensas').insert(r);
    if (error) throw error;
  }

  async eliminarRecompensa(id: number) {
    const { error } = await this.db().from('recompensas').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------------- Usuarios y actividad ----------------
  /** Personal (roles 'admin' y 'empleado') o clientes, con búsqueda por nombre o email. */
  async usuarios(filtro: string, grupo: 'personal' | 'clientes' = 'clientes'): Promise<Perfil[]> {
    let consulta = this.db()
      .from('perfiles')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(50);
    consulta =
      grupo === 'personal'
        ? consulta.in('rol', ['admin', 'empleado'])
        : consulta.eq('rol', 'cliente');
    const f = filtro.trim();
    if (f) consulta = consulta.or(`email.ilike.%${f}%,nombre.ilike.%${f}%,apellido.ilike.%${f}%`);
    const { data, error } = await consulta;
    if (error) throw error;
    return data as Perfil[];
  }

  async asignarRol(email: string, rol: Rol) {
    const { error } = await this.db().rpc('asignar_rol', { p_email: email, p_rol: rol });
    if (error) throw error;
  }

  /**
   * Alta de un empleado. Si el email ya tiene cuenta, solo se le da el rol.
   * Si no, se crea la cuenta con un cliente de Supabase aparte que no guarda
   * sesión: así el administrador no pierde la suya al registrar a otra persona.
   */
  async agregarEmpleado(d: { nombre: string; apellido: string; email: string; password: string }) {
    const { data: existente } = await this.db()
      .from('perfiles')
      .select('id')
      .ilike('email', d.email)
      .maybeSingle();

    if (!existente) {
      const temporal = createClient(environment.SUPABASE_URL, environment.SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: 'cinecorn-alta-personal',
        },
      });
      const { error } = await temporal.auth.signUp({
        email: d.email,
        password: d.password,
        options: { data: { nombre: d.nombre, apellido: d.apellido } },
      });
      if (error) throw error;
    }
    await this.asignarRol(d.email, 'empleado');
    return { cuentaNueva: !existente };
  }

  async actividad(p: { entidad?: string; texto?: string; pagina: number; porPagina: number }) {
    let consulta = this.db()
      .from('actividad')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(p.pagina * p.porPagina, (p.pagina + 1) * p.porPagina - 1);
    if (p.entidad) consulta = consulta.eq('entidad', p.entidad);
    if (p.texto)
      consulta = consulta.or(`usuario_email.ilike.%${p.texto}%,etiqueta.ilike.%${p.texto}%`);
    const { data, error, count } = await consulta;
    if (error) throw error;
    return { filas: data as Actividad[], total: count ?? 0 };
  }
}
