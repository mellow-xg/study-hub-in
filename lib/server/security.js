import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function required(name, value) {
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function createRequestClient(token) {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function createServiceClient() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const key = required("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function securityHeaders({ api = false } = {}) {
  const headers = new Headers();

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (api) {
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("Pragma", "no-cache");
  }

  return headers;
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  const headers = securityHeaders({ api: true });
  headers.set("Content-Type", "application/json; charset=utf-8");

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export async function requireAuth(request, { role } = {}) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      response: jsonResponse({ error: "Authentication required." }, 401),
    };
  }

  const client = createRequestClient(token);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data?.user) {
    return {
      ok: false,
      response: jsonResponse({ error: "Invalid or expired session." }, 401),
    };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      ok: false,
      response: jsonResponse({ error: "Account authorization could not be verified." }, 403),
    };
  }

  if (role && profile.role !== role) {
    return {
      ok: false,
      response: jsonResponse({ error: "Forbidden." }, 403),
    };
  }

  return {
    ok: true,
    user: data.user,
    profile,
    client,
  };
}

export async function consumeRateLimit({ userId, bucket, limit, windowSeconds }) {
  const client = createServiceClient();
  const bucketKey = `${bucket}:user:${userId}`;

  const { data, error } = await client.rpc("consume_security_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Security rate limiter failed:", error);
    return { allowed: false, error };
  }

  return { allowed: data === true, error: null };
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  return (forwarded?.split(",")[0] || real || "unknown").trim();
}

export function hashIdentifier(value) {
  const salt = process.env.SECURITY_HASH_SALT;
  if (!salt) return "unavailable";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export async function writeAuditLog({
  userId = null,
  event,
  request,
  metadata = {},
}) {
  try {
    const client = createServiceClient();
    const ip = getClientIp(request);

    const safeMetadata = JSON.parse(JSON.stringify(metadata, (_key, value) => {
      if (typeof value !== "string") return value;
      if (value.length > 1000) return value.slice(0, 1000);
      return value;
    }));

    await client.from("security_audit_logs").insert({
      user_id: userId,
      event: String(event).slice(0, 200),
      ip_hash: hashIdentifier(ip),
      metadata: safeMetadata,
    });
  } catch (error) {
    console.error("Security audit log failed:", error);
  }
}

export async function readJsonBody(request, {
  maxBytes = 32768,
  maxKeys = 50,
} = {}) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    return { ok: false, response: jsonResponse({ error: "Request body is too large." }, 413) };
  }

  const raw = await request.text();

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, response: jsonResponse({ error: "Request body is too large." }, 413) };
  }

  if (!raw.trim()) {
    return { ok: false, response: jsonResponse({ error: "Request body is required." }, 400) };
  }

  try {
    const body = JSON.parse(raw);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, response: jsonResponse({ error: "JSON object required." }, 400) };
    }

    if (Object.keys(body).length > maxKeys) {
      return { ok: false, response: jsonResponse({ error: "Too many request fields." }, 400) };
    }

    return { ok: true, body };
  } catch {
    return { ok: false, response: jsonResponse({ error: "Invalid JSON." }, 400) };
  }
}

export function validateText(value, {
  name,
  min = 1,
  max = 20000,
} = {}) {
  if (typeof value !== "string") {
    return { ok: false, error: `${name} must be text.` };
  }

  const text = value.trim();

  if (text.length < min) {
    return { ok: false, error: `${name} is too short.` };
  }

  if (text.length > max) {
    return { ok: false, error: `${name} is too long.` };
  }

  return { ok: true, value: text };
}
