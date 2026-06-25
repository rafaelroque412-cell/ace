-- ============================================================
-- MIGRACIÓN: Agregar columnas faltantes a expedientes_archivo
-- ============================================================
-- El código del backend espera estas columnas pero no existen
-- en el esquema actual. Este script las agrega de forma idempotente.
--
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- ============================================================

DO $$
BEGIN
  -- codigo_ubicacion: texto corto con codigo legible
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedientes_archivo' AND column_name = 'codigo_ubicacion'
  ) THEN
    ALTER TABLE public.expedientes_archivo
      ADD COLUMN codigo_ubicacion text;
    RAISE NOTICE 'Columna codigo_ubicacion agregada';
  END IF;

  -- tipo_contenedor: tipo de contenedor fisico (caja, archivador, etc)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedientes_archivo' AND column_name = 'tipo_contenedor'
  ) THEN
    ALTER TABLE public.expedientes_archivo
      ADD COLUMN tipo_contenedor text NOT NULL DEFAULT 'otros'
        CHECK (tipo_contenedor IN ('folder','archivador','caja','tomo','paquete','estante','otros'));
    RAISE NOTICE 'Columna tipo_contenedor agregada';
  END IF;

  -- nro_caja: numero de caja fisica
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expedientes_archivo' AND column_name = 'nro_caja'
  ) THEN
    ALTER TABLE public.expedientes_archivo
      ADD COLUMN nro_caja text;
    RAISE NOTICE 'Columna nro_caja agregada';
  END IF;
END $$;

-- Verificar que las columnas existen
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'expedientes_archivo'
  AND column_name IN ('codigo_ubicacion', 'tipo_contenedor', 'nro_caja')
ORDER BY column_name;
