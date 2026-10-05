import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://study-hub-in-vert.vercel.app",
  "Access-Control-Allow-Headers": "authorization, range, content-type, if-range, if-none-match, if-modified-since",
  "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,Content-Type,Content-Disposition,ETag,Last-Modified"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: cors });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401, headers: cors });

  const jwt = auth.replace(/^Bearer\s+/i, "");
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );
  const { data: { user }, error } = await client.auth.getUser(jwt);
  if (error || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  // The token is not sufficient by itself: it must belong to the authenticated user.
  const raw = new URL(req.url).searchParams.get("token");
  if (!raw || raw.length < 40) return new Response("Unauthorized", { status: 401, headers: cors });

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  const tokenHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const { data: access, error: accessError } = await admin
    .from("resource_access_tokens")
    .select("resource_id,user_id,expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (accessError || !access || access.user_id !== user.id) {
    return new Response("Access expired or invalid", { status: 403, headers: cors });
  }

  const { data: resource, error: resourceError } = await admin
    .from("resources")
    .select("url,type,title,status,chapters!inner(status,courses!inner(status))")
    .eq("id", access.resource_id)
    .eq("status", "published")
    .eq("chapters.status", "published")
    .eq("chapters.courses.status", "published")
    .maybeSingle();

  if (resourceError || !resource) return new Response("Resource unavailable", { status: 404, headers: cors });

  let source;
  try { source = new URL(resource.url); } catch { return new Response("Resource unavailable", { status: 404, headers: cors }); }
  if (source.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(source.hostname.toLowerCase())) {
    return new Response("Resource unavailable", { status: 403, headers: cors });
  }

  const match = source.pathname.match(/\/file\/d\/([^/]+)/);
  const id = match?.[1] || source.searchParams.get("id");
  if (!id) return new Response("Unsupported Drive URL", { status: 400, headers: cors });

  const driveUrl = "https://drive.usercontent.google.com/download?id=" + encodeURIComponent(id) + "&export=download&confirm=t";
  const forwarded = new Headers();
  for (const name of ["Range", "If-Range", "If-None-Match", "If-Modified-Since"]) {
    const value = req.headers.get(name);
    if (value) forwarded.set(name, value);
  }

  let upstream;
  try { upstream = await fetch(driveUrl, { headers: forwarded }); }
  catch { return new Response("Unable to fetch file", { status: 502, headers: cors }); }

  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 304) {
    return new Response("Unable to fetch file", { status: 502, headers: cors });
  }

  const headers = new Headers(cors);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Content-Disposition", "ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(req.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
});
