# Spec Driven Development

## Proyecto

Aplicacion web para gestionar expedientes de contratacion publica, consultar normativa con IA y generar contratos de bienes o servicios a partir de documentos del proceso.

## Objetivo

Construir una aplicacion web que permita:

- Subir documentos PDF, Word o Excel relacionados con procesos de contratacion.
- Extraer informacion clave de los documentos usando IA.
- Identificar si el proceso corresponde a bienes o servicios.
- Validar los datos extraidos antes de generar documentos.
- Generar contratos en formato DOCX usando plantillas.
- Generar matrices o fichas en Excel cuando corresponda.
- Consultar la Ley 32069, su reglamento, opiniones, directivas y resoluciones OECE mediante chat con fuentes.
- Guardar historial, auditoria, archivos originales y documentos generados.

## Usuarios

### Administrador

- Gestiona usuarios y roles.
- Sube normativa y documentos oficiales.
- Crea y edita plantillas DOCX/XLSX.
- Revisa errores de procesamiento.
- Administra catalogos y parametros.

### Usuario legal

- Sube expedientes del proceso.
- Revisa campos extraidos por IA.
- Genera contratos de bienes o servicios.
- Consulta el chat juridico.
- Exporta documentos generados.

### Lector

- Consulta documentos y respuestas autorizadas.
- No puede subir, editar ni generar contratos salvo permiso expreso.

## Alcance del MVP

La primera version debe incluir:

- Login de usuarios.
- Carga de archivos PDF.
- Registro de procesos de contratacion.
- Extraccion de texto desde PDF.
- Clasificacion automatica: bienes o servicios.
- Extraccion de campos principales del proceso.
- Pantalla de revision humana.
- Generacion de contrato DOCX desde plantilla.
- Almacenamiento de archivo original y generado.
- Historial basico de contratos generados.
- Carga de normativa base.
- Busqueda semantica con Pinecone.
- Chat juridico con citas y fuentes.

## Fuera del MVP

Estas funciones quedan para fases posteriores:

- Firma digital.
- Integracion completa con SEACE u otros sistemas externos.
- OCR avanzado masivo.
- Comparador normativo visual avanzado.
- Flujos de aprobacion institucionales.
- Versionado complejo de plantillas.
- Analitica avanzada.
- Integracion obligatoria con Google Drive.

## Arquitectura General

```text
Frontend Web
Next.js / React
        |
Backend API
FastAPI Python
        |
Servicios internos
- Procesamiento de archivos
- Extraccion IA
- Motor de plantillas
- RAG juridico
- Auditoria
        |
Servicios externos
- OpenAI
- Pinecone
- Supabase
        |
Datos
- PostgreSQL
- Supabase Storage
- Pinecone Index
```

## Stack Tecnologico

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Hook Form
- Zod para validacion

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy o SQLModel
- Alembic para migraciones

### IA

- OpenAI API para:
  - embeddings
  - extraccion estructurada
  - clasificacion
  - redaccion asistida
  - respuestas juridicas
- Pinecone para base vectorial juridica y documental.

### Datos

- Supabase PostgreSQL para datos relacionales.
- Supabase Storage para archivos originales y generados.
- Pinecone para fragmentos vectorizados.

### Documentos

- pdfplumber o pypdf para lectura de PDF.
- OCR opcional para PDFs escaneados.
- python-docx o docxtpl para generar DOCX.
- openpyxl para generar XLSX.

## Almacenamiento de Archivos

### Supabase Storage

Se usara como almacenamiento principal.

Buckets sugeridos:

```text
source-documents
generated-contracts
generated-excels
templates
legal-library
```

### PostgreSQL

Guardara metadata:

- nombre del archivo
- tipo de documento
- proceso asociado
- usuario que subio el archivo
- ruta en storage
- hash del archivo
- estado de procesamiento
- fecha de carga

### Pinecone

Guardara fragmentos semanticos:

- texto fragmentado
- vector embedding
- metadata juridica
- fuente
- pagina
- articulo
- tipo de documento

## Modelo de Datos Inicial

### users

- id
- email
- full_name
- role
- created_at

### processes

- id
- code
- title
- process_type
- entity_name
- status
- created_by
- created_at

### documents

- id
- process_id
- file_name
- file_path
- document_type
- mime_type
- size
- hash
- status
- uploaded_by
- created_at

### document_chunks

- id
- document_id
- pinecone_vector_id
- chunk_index
- page_start
- page_end
- text
- metadata
- created_at

### extracted_fields

- id
- process_id
- source_document_id
- field_name
- field_value
- confidence
- source_page
- source_text
- reviewed
- reviewed_by
- created_at

### contract_templates

- id
- name
- contract_type
- file_path
- version
- active
- created_at

### generated_contracts

- id
- process_id
- template_id
- file_path
- status
- generated_by
- generated_at

### chat_sessions

- id
- user_id
- title
- created_at

### chat_messages

- id
- session_id
- role
- content
- sources
- created_at

### audit_logs

- id
- user_id
- action
- entity_type
- entity_id
- metadata
- created_at

## Metadata Juridica

Para Ley 32069, reglamento, opiniones, directivas y resoluciones OECE:

```json
{
  "tipo_documento": "ley",
  "numero": "32069",
  "entidad": "Congreso",
  "articulo": "12",
  "tema": "impedimentos",
  "fecha": "2024-06-24",
  "estado": "vigente",
  "fuente": "ley_32069.pdf",
  "pagina": 3
}
```

Para documentos del proceso:

```json
{
  "tipo_documento": "tdr",
  "proceso": "servicio",
  "numero_proceso": "AS-SM-001-2026",
  "entidad": "Entidad contratante",
  "objeto": "Servicio de mantenimiento",
  "fuente": "tdr.pdf",
  "pagina": 4
}
```

## Flujo 1: Carga de Expediente

```text
Usuario crea proceso
        |
Sube documentos PDF
        |
Backend guarda archivos en Storage
        |
Registra metadata en PostgreSQL
        |
Extrae texto y tablas
        |
IA clasifica documentos
        |
IA extrae campos
        |
Usuario revisa y corrige
        |
Campos quedan aprobados
```

## Flujo 2: Generacion de Contrato

```text
Usuario selecciona proceso
        |
Sistema valida campos obligatorios
        |
Sistema detecta contrato de bienes o servicios
        |
Selecciona plantilla DOCX
        |
Llena placeholders
        |
Genera contrato
        |
Guarda DOCX en Storage
        |
Registra contrato generado
        |
Usuario descarga
```

## Campos Minimos para Contrato de Bienes

- entidad contratante
- proveedor
- RUC proveedor
- numero de procedimiento
- objeto contractual
- bienes contratados
- cantidad
- especificaciones tecnicas
- monto contractual
- plazo de entrega
- lugar de entrega
- forma de pago
- penalidades
- garantias
- responsable de conformidad

## Campos Minimos para Contrato de Servicios

- entidad contratante
- contratista
- RUC contratista
- numero de procedimiento
- objeto del servicio
- alcance del servicio
- entregables
- plazo de ejecucion
- monto contractual
- forma de pago
- penalidades
- obligaciones del contratista
- obligaciones de la entidad
- responsable de conformidad
- lugar de prestacion

## Validaciones

Antes de generar contrato:

- El tipo de contrato debe estar definido.
- Debe existir proveedor o contratista.
- Debe existir RUC.
- Debe existir objeto contractual.
- Debe existir monto.
- Debe existir plazo.
- Debe existir fuente para los campos criticos.
- Los campos con baja confianza deben ser revisados.

Campos criticos:

- proveedor
- RUC
- objeto
- monto
- plazo
- forma de pago
- penalidades

## Plantillas DOCX

Cada plantilla debe usar placeholders:

```text
{{ENTIDAD}}
{{PROVEEDOR}}
{{RUC_PROVEEDOR}}
{{NUMERO_PROCESO}}
{{OBJETO}}
{{MONTO}}
{{PLAZO}}
{{FORMA_PAGO}}
{{PENALIDADES}}
{{GARANTIAS}}
{{OBLIGACIONES}}
{{ENTREGABLES}}
{{RESPONSABLE_CONFORMIDAD}}
```

Plantillas iniciales:

```text
contrato_bienes_v1.docx
contrato_servicios_v1.docx
```

## Flujo 3: Chat Juridico

```text
Usuario pregunta
        |
Backend crea embedding de la pregunta
        |
Consulta Pinecone
        |
Recupera fragmentos relevantes
        |
OpenAI genera respuesta usando contexto
        |
Sistema devuelve respuesta con fuentes
        |
Guarda historial
```

## Reglas del Chat Juridico

La IA debe:

- Responder solo con base en documentos recuperados.
- Citar fuente, articulo, pagina o documento.
- Indicar cuando no hay informacion suficiente.
- Diferenciar ley, reglamento, opinion, directiva y resolucion.
- Evitar afirmar datos sin fuente.
- Mostrar fragmentos usados como evidencia.

## Funcionalidades de IA

### Clasificacion

Determina:

- tipo de documento
- bienes o servicios
- etapa del proceso
- entidad
- tema principal

### Extraccion Estructurada

Devuelve JSON validado:

```json
{
  "tipo_contrato": "servicios",
  "entidad": "",
  "proveedor": "",
  "ruc": "",
  "objeto": "",
  "monto": "",
  "plazo": "",
  "forma_pago": "",
  "penalidades": "",
  "fuentes": []
}
```

### Resumen

Genera:

- resumen ejecutivo
- puntos clave
- riesgos
- campos faltantes

### Alertas

Detecta:

- monto inconsistente
- plazo no encontrado
- proveedor no identificado
- falta forma de pago
- falta penalidades
- documento incompleto

## Seguridad

- Todos los buckets deben ser privados.
- Acceso a archivos mediante URLs firmadas temporales.
- Las API keys nunca deben exponerse en frontend.
- Backend maneja OpenAI, Pinecone y Supabase service role.
- RLS activo en tablas expuestas.
- Auditoria para acciones importantes.
- Validacion de tipo y tamano de archivo.
- Escaneo basico de archivos antes de procesar, si el entorno lo permite.

## Variables de Entorno

```env
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
STORAGE_BUCKET_SOURCE_DOCUMENTS=source-documents
STORAGE_BUCKET_GENERATED_CONTRACTS=generated-contracts
```

## API Endpoints Iniciales

### Auth

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Processes

```text
POST /processes
GET  /processes
GET  /processes/{id}
PATCH /processes/{id}
```

### Documents

```text
POST /processes/{id}/documents
GET  /processes/{id}/documents
POST /documents/{id}/process
GET  /documents/{id}/extracted-fields
```

### Contracts

```text
POST /processes/{id}/contracts/preview
POST /processes/{id}/contracts/generate
GET  /contracts/{id}/download-url
```

### Legal Chat

```text
POST /chat/sessions
GET  /chat/sessions
POST /chat/sessions/{id}/messages
```

### Legal Library

```text
POST /legal-library/documents
POST /legal-library/documents/{id}/index
GET  /legal-library/documents
```

## Pantallas Principales

### Dashboard

- procesos recientes
- contratos generados
- documentos pendientes
- alertas

### Procesos

- lista de procesos
- filtros
- detalle del proceso
- documentos asociados

### Carga de Documentos

- drag and drop
- tipo de documento sugerido
- estado de procesamiento

### Revision de Datos

- campo extraido
- valor detectado
- confianza
- fuente
- boton para corregir

### Generacion de Contrato

- selector de plantilla
- vista previa de datos
- advertencias
- boton generar DOCX

### Chat Juridico

- pregunta
- respuesta
- fuentes
- fragmentos recuperados
- filtros por tipo de documento

### Administracion

- usuarios
- plantillas
- normativa
- logs

## Criterios de Aceptacion del MVP

- Un usuario puede iniciar sesion.
- Un usuario puede crear un proceso.
- Un usuario puede subir al menos un PDF.
- El sistema guarda el PDF original.
- El sistema extrae texto del PDF.
- El sistema identifica si corresponde a bienes o servicios.
- El sistema extrae campos principales.
- El usuario puede revisar y corregir campos.
- El sistema genera un contrato DOCX desde plantilla.
- El contrato generado queda almacenado.
- El usuario puede descargar el contrato.
- El administrador puede cargar normativa.
- La normativa se fragmenta e indexa en Pinecone.
- El usuario puede hacer preguntas juridicas.
- La respuesta muestra fuentes utilizadas.

## Roadmap

### Fase 1: MVP de contratos

- Autenticacion
- Procesos
- Carga PDF
- Extraccion
- Revision
- Generacion DOCX

### Fase 2: RAG juridico

- Biblioteca normativa
- Pinecone
- Embeddings
- Chat con fuentes
- Filtros por tipo documental

### Fase 3: Calidad documental

- OCR
- Extraccion de tablas
- Alertas avanzadas
- Generacion XLSX
- Comparacion entre documentos

### Fase 4: Produccion institucional

- Roles avanzados
- Auditoria completa
- Backups
- Monitoreo
- Integracion con Drive o S3
- Versionado de plantillas

## Riesgos

- PDFs escaneados pueden requerir OCR.
- La IA puede extraer campos incorrectos si el documento es ambiguo.
- Los contratos deben pasar por revision humana.
- Las plantillas deben ser validadas legalmente.
- La normativa debe mantenerse actualizada.
- La seguridad de documentos legales requiere buckets privados y permisos estrictos.

## Principios del Producto

- La IA propone, el usuario valida.
- Cada dato critico debe tener fuente.
- Toda respuesta juridica debe citar documentos.
- El sistema debe guardar trazabilidad.
- La generacion documental debe ser revisable.
- El MVP debe resolver primero contratos de bienes y servicios.

