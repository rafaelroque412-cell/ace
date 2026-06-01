import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "ACE IA Juridica",
  description: "Gestion documental, busqueda semantica y asistencia juridica con IA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
