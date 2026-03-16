import { z } from "zod/v4";

// ─── Cookie config ────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "cortex_session";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   60 * 60 * 24 * 7, // 7 days (refreshed every 15 min while active)
};

// ─── Validation schemas ───────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  fullName: z.string().min(1, "Full name is required").max(100),
  tier: z.string().optional(),
});

export type LoginInput  = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ─── Java backend base URL ────────────────────────────────────────────────────

export const API_BASE = process.env.JAVA_API_URL ?? "http://localhost:8080";
