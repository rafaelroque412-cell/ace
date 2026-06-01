# ACE IA Juridica

Aplicacion web para gestion documental juridica, busqueda semantica y asistencia con IA sobre Ley 32069, su reglamento y documentos OECE.

## Stack inicial

- Next.js + React + TypeScript para frontend y API routes.
- Vercel para despliegue web.
- Supabase PostgreSQL para metadata, usuarios, historial y auditoria.
- Supabase Storage para PDFs, plantillas y documentos generados.
- Pinecone para busqueda semantica mediante embeddings.
- OpenAI API para embeddings, clasificacion, resumen, chat juridico y generacion de documentos.

## Modulos MVP

- Chat juridico con fuentes verificables.
- Carga e indexacion de documentos PDF.
- Clasificacion automatica de documentos.
- Resumen automatico.
- Busqueda semantica.
- Historial de consultas.
- Base para generacion de contratos.

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo de entorno:

```bash
cp .env.example .env.local
```

3. Completar claves privadas en `.env.local`.

4. Ejecutar:

```bash
npm run dev
```

La aplicacion abrira en `http://localhost:3000`.

## Configurar base de datos Supabase

Antes de subir PDFs, ejecuta el esquema inicial:

1. Abre Supabase Dashboard.
2. Entra al proyecto.
3. Ve a `SQL Editor`.
4. Copia y ejecuta el contenido de `docs/supabase/schema.sql`.

Ese script crea:

- Tabla `documents`.
- Tabla `document_chunks`.
- Tabla `document_summaries`.
- Tabla `chat_sessions`.
- Tabla `chat_messages`.
- Tabla `audit_logs`.
- Bucket privado `documents` para PDFs.

Luego prueba:

```bash
npm run dev
```

Y abre:

```text
http://localhost:3000/api/documents
```

Debe responder con:

```json
{
  "documents": []
}
```

## Variables de entorno

Las API keys privadas nunca deben exponerse en el navegador.

- `OPENAI_API_KEY`: clave para modelos, embeddings y generacion.
- `PINECONE_API_KEY`: clave para busqueda vectorial.
- `PINECONE_INDEX_NAME`: indice de Pinecone.
- `NEXT_PUBLIC_SUPABASE_URL`: URL publica de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key para cliente.
- `SUPABASE_SERVICE_ROLE_KEY`: service role para operaciones servidor.
- `SUPABASE_STORAGE_BUCKET`: bucket privado de documentos.

## Despliegue en Vercel

1. Crear repositorio en GitHub.
2. Subir este proyecto.
3. En Vercel, importar el repositorio.
4. Configurar las variables de entorno.
5. Deploy.

## Documentacion del proyecto

- `SPEC_DRIVEN_DEVELOPMENT.md`
- `SDD_FUNCIONALIDADES_IA_JURIDICA.md`
- `SDD_Aplicativo_Contratos_IA.pdf`
- `SDD_Funcionalidades_IA_Juridica.pdf`
