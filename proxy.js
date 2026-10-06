import { NextResponse } from "next/server";

export function proxy(request) {
  if (process.env.NODE_ENV === "production") {
    const forwardedProto = request.headers.get("x-forwarded-proto");

    if (forwardedProto === "http") {
      const url = request.nextUrl.clone();
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
