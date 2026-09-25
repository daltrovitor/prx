// Hello World
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { ConfirmToastProvider } from "@/components/ui/confirm-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/* Títulos da landing (mantidos como estão). */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
  display: "swap",
});

/* Display editorial do app. */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nxtgen.viraweb.online"),
  title: {
    default: "PRX · Experiências que conectam gerações",
    template: "%s · PRX",
  },
  description:
    "PRX reúne benefícios, conta digital e eventos para as gerações Z e Alpha. PRX PASS, PRX BANK e PRX LIVE em um app. Build. Don't bet.",
  applicationName: "PRX",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PRX",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "PRX",
    title: "PRX · Experiências que conectam gerações",
    description: "Benefícios, conta digital e eventos para as gerações Z e Alpha, em um app.",
  },
  twitter: {
    card: "summary",
    title: "PRX · Experiências que conectam gerações",
    description: "Benefícios, conta digital e eventos para as gerações Z e Alpha, em um app.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("dark h-full antialiased", inter.variable, spaceGrotesk.variable, bricolage.variable, jetbrainsMono.variable)}
    >
      <head>
        <ThemeScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var noop=function(){};var w=typeof window!=="undefined"?window:globalThis;var c=w.console||{};var m=['log','info','warn','debug','error','table','trace','dir','group','groupCollapsed','groupEnd','time','timeEnd','timeLog','assert','clear','count','countReset'];for(var i=0;i<m.length;i++){try{Object.defineProperty(c,m[i],{value:noop,writable:true,configurable:true});}catch(_){c[m[i]]=noop;}}w.console=c;}catch(_){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <AuthProvider>
            <ConfirmToastProvider>{children}</ConfirmToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
