import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createSupabaseServer } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";
import SinoNotificacoes from "@/components/SinoNotificacoes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GustPro — Gestão de Promotoras",
  description: "Sistema de gestão de promotoras NERESCO",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        {user && (
          <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-black text-base">⭐ GustPro</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <SinoNotificacoes />
              <span className="hidden sm:inline truncate max-w-[200px]">{user.email}</span>
              <LogoutButton />
            </div>
          </header>
        )}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
