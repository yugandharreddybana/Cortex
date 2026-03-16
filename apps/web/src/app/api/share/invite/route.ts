import { NextRequest, NextResponse } from "next/server";
import { proxyToJava } from "@/lib/proxy";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Escape user-controlled strings before embedding in HTML email */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/share/invite — invite users by email with a role.
 * Creates ResourcePermission on the Java side and sends an invite email via Resend.
 */
export async function POST(request: NextRequest) {
  try {
  const body = await request.json();
  const { resourceId, resourceType, emails, accessLevel, resourceTitle, senderName } = body as {
    resourceId: string;
    resourceType: string;
    emails: string[];
    accessLevel: string;
    resourceTitle?: string;
    senderName?: string;
  };

  const numericResourceId = Number(resourceId);
  if (!Number.isFinite(numericResourceId) || numericResourceId <= 0 || !resourceType || !emails?.length || !accessLevel) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const results: Array<{ email: string; status: string; emailSent: boolean; error?: string }> = [];
  const origin = request.headers.get("origin") ?? "https://cortex.app";

  for (const email of emails) {
    // Try to grant permission in the Java backend.
    // 201 = permission created. 404 = user not registered yet — that's fine,
    // the email still goes out so they can sign up and gain access.
    // Any other 4xx/5xx is a real server error; skip this email.
    const res = await proxyToJava(request, "/api/v1/permissions", {
      method: "POST",
      body: { email, resourceId: numericResourceId, resourceType, accessLevel },
    });

    const permissionGranted = res.status === 201;
    const userNotFound      = res.status === 404;
    const serverError       = !permissionGranted && !userNotFound;

    if (serverError) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      results.push({
        email,
        status: "failed",
        emailSent: false,
        error: (err as { error?: string }).error ?? "Failed to grant access",
      });
      continue;
    }

    // Always send the invite email — even when the user isn't registered yet.
    const shareUrl = `${origin}/dashboard/shared/${resourceId}?type=${resourceType}`;
    const sender   = escapeHtml(senderName ?? "A Cortex user");
    const title    = escapeHtml(resourceTitle ?? (resourceType === "FOLDER" ? "a folder" : "a highlight"));

    let emailSent = false;
    if (resend) {
      try {
        await resend.emails.send({
          from: "Cortex <noreply@cortex.app>",
          to: email,
          subject: "Cortex: You have been invited to collaborate",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#0A0A0A;border-radius:16px;color:#fff">
              <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;color:#fff">Cortex</h1>
              <p style="font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 24px">You&rsquo;ve been invited to collaborate</p>
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px">
                <p style="font-size:15px;color:rgba(255,255,255,0.9);margin:0 0 8px"><strong>${sender}</strong> invited you to view &ldquo;${title}&rdquo;.</p>
                <p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0">Access level: <strong style="color:rgba(255,255,255,0.7)">${accessLevel}</strong></p>
              </div>
              <a href="${shareUrl}" style="display:inline-block;padding:10px 24px;background:#fff;color:#000;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none">Open in Cortex</a>
              <p style="font-size:11px;color:rgba(255,255,255,0.25);margin:24px 0 0">If you didn&rsquo;t expect this email, you can safely ignore it.</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error(`[INVITE] Resend failed for ${email}:`, emailErr);
      }
    } else {
      console.warn("[INVITE] RESEND_API_KEY not set — skipping email for", email);
    }

    results.push({ email, status: "invited", emailSent });
  }

  return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    console.error("[INVITE] Unexpected route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
