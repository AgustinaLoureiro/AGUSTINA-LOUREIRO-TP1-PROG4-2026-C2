import { computed, effect, inject, Service, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from './supabase';
import { Auth } from './auth';
import { Notificacion } from '../interfaces/usuario';
import { environment } from '../../environments/environment';
import { Avisos } from './ui';

/**
 * Alertas de "Próximamente" y notificaciones del usuario.
 * - En la app: tabla notificaciones + Realtime (llegan al instante).
 * - Fuera de la app: Web Push con el service worker (si hay clave VAPID configurada).
 */
@Service()
export class Notificaciones {
  private sup = inject(Supabase);
  private auth = inject(Auth);
  private swPush = inject(SwPush);
  private avisos = inject(Avisos);

  readonly lista = signal<Notificacion[]>([]);
  readonly alertas = signal<ReadonlySet<number>>(new Set());
  readonly noLeidas = computed(() => this.lista().filter((n) => !n.leida).length);
  readonly pushDisponible = this.swPush.isEnabled && !!environment.VAPID_PUBLIC_KEY;
  /** true si este navegador ya está suscripto a las notificaciones push. */
  readonly suscripto = signal(false);

  private canal?: RealtimeChannel;

  constructor() {
    // Genera las notificaciones pendientes (ventas que abrieron desde la última visita).
    this.sup.Supabase.rpc('procesar_alertas').then(() => this.cargar());

    effect(() => {
      const usuario = this.auth.usuario();
      this.canal && this.sup.Supabase.removeChannel(this.canal);
      this.canal = undefined;
      if (!usuario) {
        this.lista.set([]);
        this.alertas.set(new Set());
        return;
      }
      this.cargar();
      this.canal = this.sup.Supabase.channel(`notificaciones-${usuario.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${usuario.id}`,
          },
          (evento) => {
            const n = evento.new as Notificacion;
            this.lista.update((l) => [n, ...l]);
            this.avisos.mostrar(`${n.titulo} ${n.cuerpo}`, 'info', 8000);
          },
        )
        .subscribe();
    });

    this.swPush.subscription.subscribe((s) => this.suscripto.set(!!s));

    // Al tocar una notificación push, abrir la película correspondiente.
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) window.open(url, '_self');
    });
  }

  async cargar() {
    const id = this.auth.usuario()?.id;
    if (!id) return;
    const [notifs, alertas] = await Promise.all([
      this.sup.Supabase.from('notificaciones')
        .select('*')
        .order('creada_en', { ascending: false })
        .limit(30),
      this.sup.Supabase.from('alertas').select('pelicula_id').is('notificada_en', null),
    ]);
    this.lista.set((notifs.data ?? []) as Notificacion[]);
    this.alertas.set(new Set((alertas.data ?? []).map((a) => a.pelicula_id as number)));
  }

  async marcarLeidas() {
    const ids = this.lista()
      .filter((n) => !n.leida)
      .map((n) => n.id);
    if (!ids.length) return;
    await this.sup.Supabase.from('notificaciones').update({ leida: true }).in('id', ids);
    this.lista.update((l) => l.map((n) => ({ ...n, leida: true })));
  }

  async alternarAlerta(peliculaId: number) {
    const activa = this.alertas().has(peliculaId);
    const tabla = this.sup.Supabase.from('alertas');
    const { error } = activa
      ? await tabla.delete().eq('pelicula_id', peliculaId)
      : await tabla.upsert({ pelicula_id: peliculaId, notificada_en: null });
    if (error) throw error;
    this.alertas.update((s) => {
      const nuevo = new Set(s);
      activa ? nuevo.delete(peliculaId) : nuevo.add(peliculaId);
      return nuevo;
    });
    if (!activa && this.pushDisponible) {
      await this.suscribirPush().catch(() => undefined);
    }
    return !activa;
  }

  /** Pide permiso de notificaciones y guarda la suscripción (clase 10). */
  async suscribirPush() {
    if (!this.pushDisponible) return false;
    const suscripcion = await this.swPush.requestSubscription({
      serverPublicKey: environment.VAPID_PUBLIC_KEY,
    });
    const json = suscripcion.toJSON();
    // La base guarda el dispositivo a nombre de la cuenta actual (aunque antes lo usara otra)
    const { error } = await this.sup.Supabase.rpc('registrar_suscripcion', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.['p256dh'],
      p_auth: json.keys?.['auth'],
    });
    if (error) throw error;
    return true;
  }

  /** Se manda una notificación a sí mismo: llega a la campanita y, si está suscripto, como push. */
  async probar() {
    const { error } = await this.sup.Supabase.rpc('probar_notificacion');
    if (error) throw error;
  }
}
