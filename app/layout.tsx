import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Eneviz — Cartographie de la consommation d'électricité",
  description:
    "Visualisation interactive des consommations d'électricité en France à partir des données ouvertes d'Enedis et de l'ODRÉ.",
  metadataBase: new URL("https://example.com"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
