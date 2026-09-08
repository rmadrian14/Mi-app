
-- Módulo de Entrenamiento (5ª entrega): esfuerzo percibido (RPE 0-10 basado
-- en RIR) y duración de la sesión, para calcular la carga de entrenamiento
-- (esfuerzo_percibido × duracion_min). Ambos nullable: una sesión puede
-- quedar marcada como completada sin valorarlos.
ALTER TABLE public.training_sessions
  ADD COLUMN esfuerzo_percibido integer CHECK (esfuerzo_percibido BETWEEN 0 AND 10),
  ADD COLUMN duracion_min integer CHECK (duracion_min > 0);
