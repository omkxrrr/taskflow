'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const typeIcon: Record<string, string> = {
  task: 'T',
  leave: 'L',
  meeting: 'M',
  warning: '!',
  event: 'E',
  update: 'U',
  chat: 'C',
};

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          setNotifications(current => [payload.new, ...current].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(current => current.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setNotifications(current => current.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(current => current.filter(n => n.id !== id));
  };

  const openNotification = async (notification: any) => {
    if (!notification.is_read) await markAsRead(notification.id);
    if (notification.redirect_url) {
      window.location.href = notification.redirect_url;
    }
  };

  return (
    <div className="notification-wrap" ref={panelRef}>
      <button className="notification-bell" onClick={() => setOpen(!open)} aria-label="Notifications">
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-header">
            <div>
              <div className="notification-title">Notifications</div>
              <div className="notification-sub">{unreadCount} unread</div>
            </div>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllAsRead}>Mark all</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notification-empty">No notifications yet</div>
          ) : (
            <div className="notification-list">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? '' : 'unread'}`}
                  onClick={() => openNotification(notification)}>
                  <div className={`notification-icon notification-${notification.type}`}>
                    {typeIcon[notification.type] || 'N'}
                  </div>
                  <div className="notification-body">
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{timeAgo(notification.created_at)}</div>
                  </div>
                  <button
                    className="notification-delete"
                    onClick={event => {
                      event.stopPropagation();
                      deleteNotification(notification.id);
                    }}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
