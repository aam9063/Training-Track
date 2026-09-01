import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { TEMPLATES } from "./templates.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const FROM_ADDRESS = "TrainingTrack <info@trainingtrack.es>";
const RESEND_URL = "https://api.resend.com/emails";
const ABORT_MS = 20_000;

const admin = createClient(supabaseUrl, serviceRoleKey);

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUBJECTS: Record<string, string> = {
  "welcome-coach": "¡Bienvenido a TrainingTrack, {{userName}}!",
  "welcome-athlete": "¡Bienvenido a TrainingTrack!",
  "coach-invite": "{{coachName}} te ha invitado a TrainingTrack",
  "trial-ending": "Tu prueba gratuita termina pronto",
  "payment-failed": "Hemos tenido un problema con tu pago",
};

const VALID_TEMPLATES = new Set(Object.keys(SUBJECTS));

interface SendEmailRequest {
  to?: string;
  template?: string;
  vars?: Record<string, string>;
}

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function logEvent(tag: string, payload: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ tag, ...payload }));
  } catch {
    // ignore
  }
}

/**
 * Basic HTML escape for text content. Do NOT use on URLs — valid URL characters
 * like `&`, `=`, `?` must remain unescaped for query strings to work. URLs
 * passed via vars are expected to come from trusted sources.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Keys in `vars` whose values are URLs — these skip HTML escaping because
 * characters like `&` and `=` are valid and necessary in query strings.
 */
const URL_KEYS = new Set([
  "loginUrl",
  "inviteUrl",
  "upgradeUrl",
  "retryUrl",
  "billingPortalUrl",
]);

/**
 * Replace `{{key}}` placeholders with values from `vars`. Text values are
 * HTML-escaped; URL values pass through untouched.
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = vars[key];
    if (raw === undefined || raw === null) return "";
    const strVal = String(raw);
    if (URL_KEYS.has(key)) return strVal;
    return escapeHtml(strVal);
  });
}

/**
 * Render the subject line. Subject is plain text (not HTML), so do NOT
 * HTML-escape — just substitute the raw values.
 */
function renderSubject(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = vars[key];
    if (raw === undefined || raw === null) return "";
    return String(raw);
  });
}

function isValidEmail(email: string): boolean {
  // Minimal sanity check; Resend does the real validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loadTemplate(name: string): string {
  const html = TEMPLATES[name];
  if (!html) throw new Error(`template_not_found:${name}`);
  return html;
}

/**
 * Authenticate the caller. Accepts either:
 *  - A valid user JWT (validated via `admin.auth.getUser`)
 *  - A service_role key (matches SUPABASE_SERVICE_ROLE_KEY exactly)
 * Returns `{ ok: true, mode, userId? }` or `{ ok: false }`.
 */
async function authenticate(
  authHeader: string,
): Promise<{ ok: true; mode: "service_role" | "user"; userId?: string } | { ok: false }> {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false };

  // Short-circuit: service_role token bypass (used for server-to-server calls,
  // e.g. DB triggers, other edge functions, webhooks).
  if (token === serviceRoleKey) {
    return { ok: true, mode: "service_role" };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false };
  return { ok: true, mode: "user", userId: data.user.id };
}

interface ResendResult {
  ok: boolean;
  id?: string;
  errorMessage?: string;
}

async function callResend(payload: {
  to: string;
  subject: string;
  html: string;
  template: string;
}): Promise<ResendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ABORT_MS);

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        tags: [{ name: "template", value: payload.template }],
      }),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail =
        (parsed && typeof parsed === "object" && "message" in (parsed as Record<string, unknown>)
          ? String((parsed as Record<string, unknown>).message)
          : text) || `HTTP ${res.status}`;
      return { ok: false, errorMessage: `Resend ${res.status}: ${detail}`.slice(0, 500) };
    }

    const id =
      parsed && typeof parsed === "object" && "id" in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).id)
        : undefined;

    return { ok: true, id };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      errorMessage: isAbort
        ? "Resend request timed out after 20s"
        : `Resend fetch error: ${String(err).slice(0, 400)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function insertLog(row: {
  recipient: string;
  template: string;
  subject: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error_message: string | null;
  vars: Record<string, string> | null;
}): Promise<string | null> {
  const sentAt = row.status === "sent" ? new Date().toISOString() : null;
  const { data, error } = await admin
    .from("email_logs")
    .insert({
      recipient: row.recipient,
      template: row.template,
      subject: row.subject,
      status: row.status,
      resend_id: row.resend_id,
      error_message: row.error_message,
      vars: row.vars,
      sent_at: sentAt,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    logEvent("send_email_log_insert_error", {
      error: error.message,
      template: row.template,
      status: row.status,
    });
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return respond(405, { ok: false, error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return respond(401, { ok: false, error: "unauthorized" });
  }

  const authResult = await authenticate(authHeader);
  if (!authResult.ok) {
    const tok = authHeader.replace(/^Bearer\s+/i, "").trim();
    console.log(JSON.stringify({
      event: "auth_fail",
      token_prefix: tok.slice(0, 24),
      token_len: tok.length,
      service_role_prefix: serviceRoleKey.slice(0, 24),
      service_role_len: serviceRoleKey.length,
      equal: tok === serviceRoleKey,
    }));
    return respond(401, { ok: false, error: "unauthorized" });
  }

  let body: SendEmailRequest;
  try {
    body = await req.json();
  } catch {
    return respond(400, { ok: false, error: "invalid_input" });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const template = typeof body.template === "string" ? body.template.trim() : "";
  const vars: Record<string, string> = {};
  if (body.vars && typeof body.vars === "object" && !Array.isArray(body.vars)) {
    for (const [k, v] of Object.entries(body.vars)) {
      if (v === undefined || v === null) continue;
      vars[k] = String(v);
    }
  }

  if (!to || !isValidEmail(to) || !template) {
    return respond(400, { ok: false, error: "invalid_input" });
  }

  if (!VALID_TEMPLATES.has(template)) {
    return respond(400, { ok: false, error: "unknown_template" });
  }

  let htmlTemplate: string;
  try {
    htmlTemplate = loadTemplate(template);
  } catch (err) {
    logEvent("send_email_template_load_error", {
      template,
      detail: String(err).slice(0, 300),
    });
    return respond(500, { ok: false, error: "send_failed", detail: "template_load_failed" });
  }

  const renderedHtml = renderTemplate(htmlTemplate, vars);
  const renderedSubject = renderSubject(SUBJECTS[template], vars);

  const resendResult = await callResend({
    to,
    subject: renderedSubject,
    html: renderedHtml,
    template,
  });

  const logId = await insertLog({
    recipient: to,
    template,
    subject: renderedSubject,
    status: resendResult.ok ? "sent" : "failed",
    resend_id: resendResult.id ?? null,
    error_message: resendResult.ok ? null : resendResult.errorMessage ?? "unknown_error",
    vars,
  });

  if (!resendResult.ok) {
    logEvent("send_email_failed", {
      template,
      recipient: to,
      error: resendResult.errorMessage,
      auth_mode: authResult.mode,
    });
    return respond(500, {
      ok: false,
      error: "send_failed",
      detail: resendResult.errorMessage ?? "unknown_error",
      log_id: logId,
    });
  }

  logEvent("send_email_sent", {
    template,
    recipient: to,
    resend_id: resendResult.id,
    auth_mode: authResult.mode,
  });

  return respond(200, {
    ok: true,
    resend_id: resendResult.id,
    log_id: logId,
  });
});
