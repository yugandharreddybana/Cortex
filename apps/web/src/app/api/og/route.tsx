import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "Shared Highlight";
  const type  = searchParams.get("type")  || "highlight";

  const tagline =
    type === "folder" ? "Shared Collection via Cortex" : "Shared via Cortex";

  return new ImageResponse(
    (
      <div
        style={{
          width:           "100%",
          height:          "100%",
          display:         "flex",
          flexDirection:   "column",
          justifyContent:  "space-between",
          padding:         "60px",
          backgroundColor: "#0A0A0A",
          color:           "#ffffff",
          fontFamily:      "Inter, system-ui, sans-serif",
          position:        "relative",
          overflow:        "hidden",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position:   "absolute",
            top:        "-120px",
            right:      "-120px",
            width:      "600px",
            height:     "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width:           "36px",
              height:          "36px",
              borderRadius:    "8px",
              backgroundColor: "#818CF8",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="4" />
              <path d="M6 4v2l1.5 1.5" />
            </svg>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.8)" }}>
            Cortex
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            flex:           1,
            marginTop:      "40px",
            marginBottom:   "40px",
          }}
        >
          <p
            style={{
              fontSize:      title.length > 60 ? "36px" : "48px",
              fontWeight:    700,
              letterSpacing: "-0.04em",
              lineHeight:    1.2,
              color:         "rgba(255,255,255,0.95)",
              margin:        0,
              display:       "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
            }}
          >
            {type === "highlight" ? `"${title}"` : title}
          </p>
        </div>

        {/* Bottom tagline */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "16px", color: "rgba(255,255,255,0.35)", letterSpacing: "-0.01em" }}>
            {tagline}
          </span>
          <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.2)" }}>
            cortex.app
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
