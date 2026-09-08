-- Módulo de Entrenamiento (6ª entrega): volumen semanal por grupo muscular
-- con conteo fraccional. Añade los músculos secundarios de cada ejercicio
-- (multi-valor; la UI restringe las opciones a los 8 músculos con landmarks
-- MEV/MAV/MRV, para que el cálculo de volumen siempre reciba un valor
-- reconocible).
ALTER TABLE public.exercises
  ADD COLUMN musculos_secundarios text[] NOT NULL DEFAULT '{}';

-- Corrige la clasificación de 3 ejercicios sembrados como "pierna": ese
-- valor es demasiado genérico para el cálculo de volumen, que necesita
-- distinguir cuádriceps de isquiosurales. Reclasificación biomecánica
-- estándar de estos movimientos concretos.
UPDATE public.exercises SET grupo_muscular = 'isquiosurales'
  WHERE nombre = 'Peso muerto rumano con mancuernas' AND grupo_muscular = 'pierna';
UPDATE public.exercises SET grupo_muscular = 'cuádriceps'
  WHERE nombre = 'Step-up bajo (rango corto)' AND grupo_muscular = 'pierna';
UPDATE public.exercises SET grupo_muscular = 'cuádriceps'
  WHERE nombre = 'Extensión de rodilla en banco (rango parcial)' AND grupo_muscular = 'pierna';
