import type { Metadata } from "next";
import "react-loading-skeleton/dist/skeleton.css";
import "./globals.css";
import "./modules.css";
import "./cerebro.css";
export const metadata: Metadata = {
  title: "Combustible · Demo",
  description:
    "Demostración de un tablero de combustible con datos totalmente ficticios.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
