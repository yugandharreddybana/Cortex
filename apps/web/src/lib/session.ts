import type { SessionOptions, IronSession } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  user?: {
    token: string;
  };
}

const cookiePassword = process.env.SECRET_COOKIE_PASSWORD;
if (!cookiePassword || cookiePassword.length < 32) {
  throw new Error(
    "SECRET_COOKIE_PASSWORD env var must be set and at least 32 characters long. " +
      "Generate one with: openssl rand -base64 32",
  );
}

export const sessionOptions: SessionOptions = {
  cookieName: "cortex_session",
  password: cookiePassword,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  // Cast through `unknown` — Next.js 15's ReadonlyRequestCookies satisfies
  // iron-session's internal CookieStore interface at runtime but TS can't see it.
  // eslint-disable-next-line
  return getIronSession<SessionData>(cookieStore as unknown as any, sessionOptions);
}
