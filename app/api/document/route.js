const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function responseHeaders(upstream) {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-disposition",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function handler(request) {
  if (!SUPABASE_URL) {
    return new Response("Document proxy is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const upstreamUrl =
    `${SUPABASE_URL}/functions/v1/stream-resource?token=${encodeURIComponent(token)}`;

  const forwardHeaders = new Headers();
  for (const name of [
    "range",
    "if-range",
    "if-none-match",
    "if-modified-since",
  ]) {
    const value = request.headers.get(name);
    if (value) forwardHeaders.set(name, value);
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: forwardHeaders,
      cache: "no-store",
    });
  } catch {
    return new Response("Document service unavailable", { status: 502 });
  }

  return new Response(
    request.method === "HEAD" ? null : upstream.body,
    {
      status: upstream.status,
      headers: responseHeaders(upstream),
    }
  );
}

export const GET = handler;
export const HEAD = handler;
