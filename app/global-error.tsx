"use client"

import * as React from "react"

import { siteConfig } from "@/config/site"

/**
 * Last-resort boundary for errors thrown by the root layout itself. It must
 * render its own <html> and <body>, and cannot rely on the app's providers or
 * stylesheet having loaded, so the styling here is deliberately self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#fafafa",
          color: "#111",
        }}
      >
        <main
          style={{
            minHeight: "100svh",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#737373",
                margin: 0,
              }}
            >
              Application error
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "8px 0 6px" }}>
              {siteConfig.name} could not start
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "#525252",
                margin: 0,
              }}
            >
              A fatal error occurred while loading the application shell.
              {error.digest ? ` Reference ${error.digest}.` : ""}
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/dashboard"
                style={{
                  height: 36,
                  lineHeight: "34px",
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1px solid #d4d4d4",
                  background: "#fff",
                  color: "#111",
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Back to overview
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
