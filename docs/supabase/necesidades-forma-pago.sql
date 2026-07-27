-- FORMA DE PAGO en la ficha de necesidad (Art. 67 de la Ley).
--
-- Apartado que la entidad exige y que NO está en los PDF-modelo cargados. Su
-- texto lo fija la Ley y solo tiene cinco huecos, así que se guardan los cinco
-- huecos por separado MÁS el texto ya compuesto:
--
--   * los huecos permiten rehacer el apartado cuando cambia un dato, sin que
--     nadie tenga que reescribir los párrafos legales a mano;
--   * el texto compuesto es lo que viaja al Word y lo que se firma, así que se
--     conserva tal cual se aprobó aunque la plantilla cambie después.
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces los seis campos no
-- existen y la ficha fallará al guardarlos.

alter table public.necesidades
  add column if not exists forma_pago text,
  add column if not exists forma_pago_tipo text,
  add column if not exists forma_pago_area_conformidad text,
  add column if not exists forma_pago_documentacion text,
  add column if not exists forma_pago_lugar text,
  add column if not exists forma_pago_direccion text;

comment on column public.necesidades.forma_pago is
  'Texto completo del apartado FORMA DE PAGO que va al requerimiento (Art. 67 de la Ley). Se compone desde los cinco campos forma_pago_*.';
comment on column public.necesidades.forma_pago_tipo is
  'Pago único o pagos a cuenta, con su detalle.';
comment on column public.necesidades.forma_pago_area_conformidad is
  'Área responsable de otorgar la conformidad de la prestación.';
comment on column public.necesidades.forma_pago_documentacion is
  'Otra documentación exigible para el pago, además de la conformidad y el comprobante.';
comment on column public.necesidades.forma_pago_lugar is
  'Mesa de partes o dependencia donde el contratista presenta la documentación.';
comment on column public.necesidades.forma_pago_direccion is
  'Dirección exacta de esa dependencia.';
