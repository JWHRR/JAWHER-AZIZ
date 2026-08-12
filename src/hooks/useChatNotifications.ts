import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BHnmuXczaj9xbieOGDJNmk2uWdgWrMyVs_aYDVbgR_b7bZICsc6VZFhrvmywON6xeDe5fMj5BT7EUamHyFLhSRY';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Global hook used in AppHeader.
 * - Tracks total unread message count across all conversations.
 * - Shows a browser notification when a new message arrives and
 *   the user is NOT on the /messagerie page.
 * - Subscribes to Web Push for background notifications.
 */
export const useChatNotifications = (userId: string | null) => {
  const [totalUnread, setTotalUnread] = useState(0);

  const subscribeToPush = useCallback(async () => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      
      // Save subscription to database
      if (subscription) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          subscription: JSON.parse(JSON.stringify(subscription))
        }, { onConflict: 'user_endpoint_unique' });
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  }, [userId]);

  const fetchTotalUnread = useCallback(async () => {
    if (!userId) return;

    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId);

    if (!memberships) return;

    let total = 0;
    await Promise.all(
      memberships.map(async (m) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', m.conversation_id)
          .is('deleted_at', null)
          .neq('sender_id', userId)
          .gt('created_at', m.last_read_at);
        total += count ?? 0;
      })
    );

    setTotalUnread(total);
  }, [userId]);

  const clearTotalUnread = useCallback(() => setTotalUnread(0), []);

  useEffect(() => {
    if (!userId) return;

    fetchTotalUnread();
    subscribeToPush();

    const channel = supabase
      .channel(`chat-notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === userId) return;

          // Refresh unread count
          fetchTotalUnread();

          // Show browser notification only when not on the chat page
          const onChatPage = window.location.pathname.includes('messagerie');
          if (onChatPage) return;
          if (!('Notification' in window) || Notification.permission !== 'granted') return;

          const { data: profList } = await supabase
            .rpc('get_profiles_by_ids', { p_ids: [msg.sender_id] });
          const prof = (profList ?? [])[0];

          const title = prof?.full_name ?? 'Nouveau message';
          const body = msg.content ? msg.content.slice(0, 100) : '📷 Image';

          // Ensure service worker is ready before showing notification, otherwise fallback to regular Notification API
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(title, {
                body,
                icon: '/ipest-logo.png',
                badge: '/ipest-logo.png',
                tag: `chat-${msg.conversation_id}`,
                renotify: true,
                data: { url: '/messagerie' }
              });
            });
          } else {
             const notif = new Notification(title, {
              body,
              icon: '/ipest-logo.png',
              badge: '/ipest-logo.png',
              tag: `chat-${msg.conversation_id}`,
              renotify: true,
            });

            notif.onclick = () => {
              window.focus();
              window.location.href = '/messagerie';
              notif.close();
            };
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchTotalUnread, subscribeToPush]);

  return { totalUnread, clearTotalUnread, refetch: fetchTotalUnread };
};
