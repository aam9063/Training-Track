import { supabase } from './supabase';

/**
 * Check if the app is running in PWA standalone mode.
 */
export function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Check if Web Push is supported in this browser.
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission state.
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Check if there's an active push subscription on this device.
 */
export async function hasActiveSubscription() {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Subscribe to push notifications and save to Supabase.
 */
export async function subscribeToPush(userId) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error('VITE_VAPID_PUBLIC_KEY not configured');
    return false;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    // Get SW registration
    const registration = await navigator.serviceWorker.ready;

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe via PushManager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Extract keys
    const keys = subscription.toJSON();
    const p256dh = keys.keys?.p256dh;
    const auth = keys.keys?.auth;

    if (!p256dh || !auth) {
      console.error('Push subscription missing keys');
      return false;
    }

    // Save to Supabase
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      console.error('Error saving push subscription:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push subscription error:', err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications and remove from Supabase.
 */
export async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remove from DB first
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);

      // Then unsubscribe from browser
      await subscription.unsubscribe();
    }

    return true;
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    return false;
  }
}

// --- Helpers ---

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
