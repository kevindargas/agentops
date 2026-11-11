import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cn } from "cn"

import "./globals.css"
import { AiProvider } from "@/components/ai/ai-provider"
import { CustomizerProvider } from "@/components/theme/customizer-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { siteConfig } from "@/config/site"
import { themeInitScript } from "@/lib/theme-presets"

/**
 * Static assets under `public/` are not prefixed by Next when the app is
 * served from a sub-path (GitHub Pages), so the metadata icons carry the base
 * path themselves. Empty in server mode and locally.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

/**
 * Brand swap points: `siteConfig` (name, description, url), `public/favicon.svg`
 * and `app/favicon.ico`. Add `app/opengraph-image.tsx` for a generated card.
 * `metadataBase` comes from `siteConfig.url`, which reads
 * `NEXT_PUBLIC_SITE_URL` (set to the Pages URL in the deploy workflow).
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: [
      { url: `${basePath}/favicon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/favicon.ico`, sizes: "any" },
    ],
    apple: `${basePath}/favicon.svg`,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.tagline,
    url: siteConfig.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
    description: siteConfig.tagline,
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfdfd" },
    { media: "(prefers-color-scheme: dark)", color: "#141418" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">
        <ThemeProvider>
          <CustomizerProvider>
            <TooltipProvider>
              <AiProvider>{children}</AiProvider>
            </TooltipProvider>
          </CustomizerProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
