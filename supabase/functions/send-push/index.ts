import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@trainingtrack.es";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") || "";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// --- Base64url helpers ---
function base64urlToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64url(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

// --- VAPID JWT signing (ES256 / ECDSA P-256) ---
async function createVapidJwt(audience: string): Promise<{ authorization: string; cryptoKey: string }> {
  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(signingInput)
    )
  );

  const jwt = `${signingInput}.${uint8ArrayToBase64url(signature)}`;

  return {
    authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    cryptoKey: `p256ecdsa=${VAPID_PUBLIC_KEY}`,
  };
}

// --- Web Push Encryption (RFC 8291 / aes128gcm) ---
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  const subscriberPubBytes = base64urlToUint8Array(p256dhKey);
  const subscriberPub = await crypto.subtle.importKey(
    "raw",
    subscriberPubBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPubBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPub },
      localKeyPair.privateKey,
      256
    )
  );

  const authSecretBytes = base64urlToUint8Array(authSecret);

  const authInfo = concatBuffers(
    encoder.encode("WebPush: info\0"),
    subscriberPubBytes,
    localPubBytes
  );

  const sharedKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecretBytes, info: authInfo },
      sharedKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ikmKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);

  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const cekBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
      ikmKey,
      128
    )
  );

  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey,
      96
    )
  );

  const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]));

  const contentKey = await crypto.subtle.importKey(
    "raw",
    cekBits,
    "AES-GCM",
    false,
    ["encrypt"]
  );

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      contentKey,
      paddedPayload
    )
  );

  const rs = new Uint8Array(4);
  const recordSize = paddedPayload.length + 16;
  new DataView(rs.buffer).setUint32(0, recordSize + 86);
  const idlen = new Uint8Array([65]);

  const encrypted = concatBuffers(salt, rs, idlen, localPubBytes, ciphertext);

  return { encrypted, localPublicKey: localPubBytes };
}

// --- Send push to a single subscription ---
async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ success: boolean; expired: boolean; status: number }> {
  try {
    const endpointUrl = new URL(sub.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const vapid = await createVapidJwt(audience);
    const { encrypted } = await encryptPayload(payload, sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Authorization": vapid.authorization,
        "TTL": "86400",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "Urgency": "normal",
      },
      body: encrypted,
    });

    const status = res.status;

    if (status === 201 || status === 200) {
      return { success: true, expired: false, status };
    }

    if (status === 404 || status === 410) {
      return { success: false, expired: true, status };
    }

    const text = await res.text();
    console.error(`Push failed (${status}):`, text);
    return { success: false, expired: false, status };
  } catch (err) {
    console.error("Push send error:", err);
    return { success: false, expired: false, status: 0 };
  }
}

// --- Verify authorization ---
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  // Accept service_role_key (from strava-webhook or direct calls)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRoleKey && token === serviceRoleKey) return true;

  // Accept PUSH_TRIGGER_SECRET (from DB triggers via pg_net)
  if (PUSH_TRIGGER_SECRET && token === PUSH_TRIGGER_SECRET) return true;

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { user_ids, title, body, url = "/", tag = "tt-default" } = await req.json();

    if (!user_ids?.length || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing user_ids, title, or body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: subscriptions, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", user_ids);

    if (subErr) {
      console.error("Error fetching subscriptions:", subErr);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, expired: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url, tag });

    let sent = 0;
    let expired = 0;
    const expiredIds: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const result = await sendToSubscription(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        );
        if (result.success) sent++;
        if (result.expired) {
          expired++;
          expiredIds.push(sub.id);
        }
        return result;
      })
    );

    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      console.log(`Removed ${expiredIds.length} expired subscriptions`);
    }

    if (sent > 0) {
      const successIds = subscriptions
        .filter((_, i) => {
          const r = results[i];
          return r.status === "fulfilled" && r.value.success;
        })
        .map((s) => s.id);

      if (successIds.length > 0) {
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .in("id", successIds);
      }
    }

    console.log(`Push sent: ${sent}, expired: ${expired}, total subs: ${subscriptions.length}`);

    return new Response(JSON.stringify({ sent, expired }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
