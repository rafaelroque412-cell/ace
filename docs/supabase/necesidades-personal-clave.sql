-- Experiencia del personal clave (Art. 72.3.b · capacidad técnica y profesional),
-- en la sección 3.5.1 de la ficha, junto a la experiencia del postor.
--
-- El texto lo fija el formato de las bases estándar y tiene tres huecos: el
-- tiempo mínimo, los trabajos o prestaciones en la actividad requerida y el
-- puesto que ocupa el personal clave. Se guardan los tres huecos por separado
-- MÁS el texto ya compuesto:
--
--   * los huecos permiten rehacer el requisito cuando cambia un dato;
--   * el texto compuesto es lo que viaja al Word y lo que se firma.
--
-- Es el mismo patrón de la forma de pago (Art. 67).
--
-- Ejecutar en el SQL Editor de Supabase. Hasta entonces los cuatro campos no
-- existen y la ficha fallará al guardarlos.

alter table public.necesidades
  add column if not exists personal_clave_tiempo text,
  add column if not exists personal_clave_trabajos text,
  add column if not exists personal_clave_puesto text,
  add column if not exists personal_clave_experiencia text;

comment on column public.necesidades.personal_clave_tiempo is
  'Tiempo de experiencia minimo del personal clave (Art. 72.3.b). Ej. «tres (3) años».';
comment on column public.necesidades.personal_clave_trabajos is
  'Trabajos o prestaciones en la actividad requerida para el personal clave.';
comment on column public.necesidades.personal_clave_puesto is
  'Puesto, cargo o posicion respecto del cual se acredita la experiencia del personal clave.';
comment on column public.necesidades.personal_clave_experiencia is
  'Texto del requisito de experiencia del personal clave. Se compone desde los tres campos personal_clave_*.';
