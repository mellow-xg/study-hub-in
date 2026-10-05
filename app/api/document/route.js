import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function responseHeaders(upstream) {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function handler(request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return new Response("Document service unavailable", { status: 503 });
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return new Response("Authentication required", { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response("Authentication required", { status: 401 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || token.length < 40) return new Response("Invalid document access", { status: 400 });

  const upstreamUrl = SUPABASE_URL + "/functions/v1/stream-resource?token=" + encodeURIComponent(token);
  const forwardHeaders = new Headers({ Authorization: auth });
  for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value) forwardHeaders.set(name, value);
  }

  try {
    const upstream = await fetch(upstreamUrl, { method: request.method, headers: forwardHeaders, cache: "no-store" });
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: responseHeaders(upstream) });
  } catch {
    return new Response("Document service unavailable", { status: 502 });
  }
}

export const GET = handler;
export const HEAD = handler;
