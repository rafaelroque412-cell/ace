import type { Metadata } from "next";
import "./styles.css";
import "./components/expedientes-archivo/expedientes-archivo.css";

export const metadata: Metadata = {
  title: "ACE IA Juridica",
  description: "Gestion documental, busqueda semantica y asistencia juridica con IA.",
};

// App interna detrás de auth: todas las páginas consultan sesión/datos vía
// Supabase en el servidor. Render dinámico global para no prerenderizar en
// build-time (donde no hay env vars). Se propaga a todas las rutas hijas.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      {/* suppressHydrationWarning: extensiones del navegador (descargadores,
          Grammarly, dark-mode…) inyectan atributos en <body> antes de hidratar.
          Silencia solo los atributos del body, no mismatches del árbol interno. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
