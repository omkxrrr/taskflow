export type NotificationType =
  | 'task'
  | 'leave'
  | 'meeting'
  | 'warning'
  | 'event'
  | 'update'
  | 'chat';

export type NotificationPayload = {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  redirect_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

export async function createNotification(supabase: any, payload: NotificationPayload) {
  if (!payload.user_id) return;
  await supabase.from('notifications').insert({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    redirect_url: payload.redirect_url || null,
    entity_type: payload.entity_type || null,
    entity_id: payload.entity_id || null,
  });
}

export async function createNotifications(supabase: any, payloads: NotificationPayload[]) {
  const rows = payloads
    .filter(payload => payload.user_id)
    .map(payload => ({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      redirect_url: payload.redirect_url || null,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
    }));

  if (rows.length === 0) return;
  await supabase.from('notifications').insert(rows);
}
