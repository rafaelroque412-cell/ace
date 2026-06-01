# Arquitectura

## Vista general

```text
Usuario
  -> Next.js Web App en Vercel
  -> API Routes / Server Actions
  -> Servicios de aplicacion
  -> Supabase PostgreSQL + Storage
  -> Pinecone
  -> OpenAI API
```

## Responsabilidades

### Frontend

- Panel de trabajo.
- Carga de documentos.
- Chat juridico.
- Busqueda semantica.
- Contratos y documentos generados.
- Historial y auditoria visible para usuarios autorizados.

### Backend inicial en Next.js

- Validacion de solicitudes.
- Control de permisos.
- Orquestacion de OpenAI, Pinecone y Supabase.
- Endpoints de chat, documentos, busqueda y contratos.

### Procesamiento asincrono

Para archivos grandes o procesos largos se recomienda agregar una cola:

- Trigger al subir PDF.
- Extraccion de texto.
- Fragmentacion.
- Generacion de embeddings.
- Upsert a Pinecone.
- Registro de estado en PostgreSQL.

En MVP puede iniciarse con API routes; para produccion avanzada conviene separar workers con Python/FastAPI, Celery o un servicio serverless especializado.

## Flujo documental

```text
PDF
  -> Supabase Storage
  -> Extraccion de texto
  -> Clasificacion IA
  -> Fragmentacion
  -> Embeddings OpenAI
  -> Pinecone
  -> Consulta con citas
```

## Buenas practicas

- TypeScript estricto.
- Validacion con Zod.
- API keys solo en servidor.
- Buckets privados y URLs firmadas.
- Metadata juridica estructurada en PostgreSQL.
- Embeddings y metadatos minimos en Pinecone.
- Respuestas con fuentes y fragmentos verificables.
- Auditoria de consultas y documentos generados.
