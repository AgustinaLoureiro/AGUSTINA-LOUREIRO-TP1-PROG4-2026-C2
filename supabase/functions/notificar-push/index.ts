// Edge Function: envía una notificación Web Push cuando se inserta una fila en
// public.notificaciones (por ejemplo, "abrió la venta de un estreno").
//
// Despliegue:
//   1. npx web-push generate-vapid-keys   → par de claves VAPID
//   2. Supabase > Edge Functions > Secrets: VAPID_PUBLIC, VAPID_SECRET, VAPID_MAIL
//   3. Supabase > Edge Functions > Deploy a new function > Via editor (pegar este archivo)
//   4. Supabase > Database > Webhooks: tabla notificaciones, evento INSERT,
//      tipo "Supabase Edge Functions" → notificar-push
//   5. En Vercel: VAPID_PUBLIC_KEY con la clave pública (la usa el front para suscribirse)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

webpush.setVapidDetails(
  'mailto:' + Deno.env.get('VAPID_MAIL'),
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_SECRET')!,
);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface Notificacion {
  usuario_id: string;
  titulo: string;
  cuerpo: string;
  url: string | null;
}

Deno.serve(async (req) => {
  const { record } = (await req.json()) as { record: Notificacion };

  const { data: suscripciones, error } = await supabase
    .from('suscripciones_push')
    .select('id, endpoint, p256dh, auth')
    .eq('usuario_id', record.usuario_id);
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({
    notification: {
      title: record.titulo,
      body: record.cuerpo,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        url: record.url ?? '/',
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: record.url ?? '/' },
        },
      },
    },
  });

  let enviadas = 0;
  for (const s of suscripciones ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      enviadas++;
    } catch (e) {
      // 404/410: la suscripción ya no existe (el usuario desinstaló o revocó el permiso)
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('suscripciones_push').delete().eq('id', s.id);
      }
    }
  }
  return new Response(JSON.stringify({ enviadas }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
