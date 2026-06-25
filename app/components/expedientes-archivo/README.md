# Módulo `/expedientes-archivo`

Biblioteca de expedientes archivados. Permite buscar, subir, organizar y consultar expedientes digitales con OCR + búsqueda semántica en Pinecone.

## Arquitectura

```
app/
  components/
    expedientes-archivo-workspace.tsx  # Componente principal (Client Component)
    expedientes-archivo/
      types.ts                          # Tipos del módulo
  expedientes-archivo/
    page.tsx                            # Página del módulo
lib/
  expedientes-archivo.ts                # Modelos, constantes, schemas Zod base
  expedientes-archivo-actions.ts        # Acciones HTTP al backend
  expedientes-archivo-search.ts         # Backend: búsqueda vectorial
  expedientes-archivo-processing.ts     # Backend: OCR + Pinecone
app/api/expedientes-archivo/
  route.ts                              # GET (listar) y POST (subir)
  [id]/route.ts                         # GET (PDF), PATCH (actualizar), POST (reindexar), DELETE, PUT (reemplazar)
  search/route.ts                        # Búsqueda por keyword
  chat/route.ts                          # Chat con RAG
  ai-search/route.ts                     # Búsqueda por lenguaje natural
  duplicates/route.ts                    # Detección de duplicados
  bulk/route.ts                          # Operaciones masivas
  extract/route.ts                       # Extracción de metadata con IA
  export/route.ts                        # Exportación CSV/JSON
```

## Características

### Pestaña "Buscar"
Tres modos seleccionables:
- **Buscar por palabra clave**: vector search sobre el contenido indexado de los PDFs
- **Chat con IA**: RAG conversacional que responde preguntas fundamentadas
- **IA en archivo**: filtrado semántico de metadata (oficina, año, materia, ubicación)

### Pestaña "Subir"
Wizard de 4 pasos:
1. **Documento**: PDF + identificación (título, número, SGD, serie, tipo, fecha, año, folios, oficina)
2. **Contenido**: materia, asunto, resumen, observaciones
3. **Persona**: tipo, documento, nombre
4. **Ubicación**: tipo de almacenamiento, empastado, archivador, color, estante, piso, local

Funcionalidades del wizard:
- **Autocompletar con IA**: extrae metadata del PDF
- **Detección de duplicados**: avisa si ya existe un expediente similar
- **Validación por paso**: no permite avanzar con errores
- **Auto-guardado**: en localStorage cada 1.5s
- **Indicador de progreso visual** con % de completitud
- **Código de ubicación autogenerado** desde local/piso/estante
- **Plantillas por tipo de documento**: Resolución, Oficio, Decreto, Ordenanza

### Lista de expedientes
- **3 vistas**: lista, tabla, tarjetas
- **Dashboard de stats** (visible solo si hay >= 5 expedientes)
- **Búsqueda con debounce** (useDeferredValue)
- **Filtros**: status, oficina, estante, fechas, tipo de documento
- **Ordenamiento**: por fecha, título, año, tamaño, status
- **Selección múltiple** con acciones bulk (reindex, mover, baja, eliminar)
- **Exportar CSV** con filtros aplicados
- **Detección de duplicados** por título

### Slide-over de detalle
- **Vista previa del PDF** embebida
- **Acciones**: descargar, reemplazar, duplicar
- **Metadata completa** del expediente

### Panel de chat lateral
- **Mensajes** de usuario y IA
- **Fuentes clickeables** que abren el expediente sin cerrar el chat
- **Sugerencia** cuando la IA no encuentra respuesta

## API de actions (lib/expedientes-archivo-actions.ts)

Funciones puras con validación Zod en runtime:

```typescript
chatWithExpedientes(query: string): Promise<ChatAnswer>
searchExpedientes(query: string, anio?: number): Promise<SearchResult[]>
aiSearchExpedientes(query: string, limit?: number): Promise<AiSearchResponse>
detectDuplicates(params): Promise<DuplicateMatch[]>
autoFillFromPdf(file: File, title: string): Promise<PdfInventory>
uploadExpediente(formData, onProgress?): Promise<UploadResult>
reindexExpediente(id: string): Promise<void>
deleteExpediente(id: string): Promise<void>
replaceExpedienteFile(id: string, file: File): Promise<void>
bulkUpdateExpedientes(ids: string[], updates): Promise<BulkResult>
bulkMarkForDisposal(ids: string[]): Promise<BulkResult>
loadExpedientes(): Promise<ExpedienteItem[]>
```

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `/` | Enfocar buscador de la lista |
| `?` | Mostrar/ocultar ayuda de atajos |
| `Esc` | Cerrar slide-over, modal, ayuda |
| `Ctrl + I` | Abrir panel de chat |
| `Ctrl + U` | Ir a pestaña Subir |
| `Ctrl + B` | Ir a pestaña Buscar |
| `Ctrl + →` | Siguiente paso del wizard |
| `Ctrl + ←` | Paso anterior del wizard |
| `Ctrl + \` | Colapsar/expandir sidebar |

## Buenas prácticas aplicadas

- **Validación con Zod** en todas las llamadas al backend
- **TypeScript estricto** con tipos en `types.ts`
- **Custom hooks** (futuro) para estados complejos
- **Accesibilidad**: aria-pressed, aria-current, aria-label, role="status"
- **Performance**: useDeferredValue para el input de búsqueda, useMemo para filtros costosos
- **Persistencia**: URL sync con filtros, localStorage para borradores
- **Mensajes de error** accionables en español
