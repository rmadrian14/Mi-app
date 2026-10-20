
-- Límites de los buckets de archivos. Hoy cualquiera con sesión puede subir
-- archivos de cualquier tamaño y tipo. Esto no borra nada ni toca los archivos
-- que ya hay: solo afecta a las subidas nuevas. Se puede ejecutar más de una vez.

-- Facturas en PDF: la función del servidor ya exige un PDF de hasta 10 MB.
UPDATE storage.buckets
SET file_size_limit = 10485760,                      -- 10 MB
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'invoice-pdfs';

-- Justificantes de gastos: la pantalla acepta fotos y PDF (una foto de móvil
-- ronda los 3-8 MB).
UPDATE storage.buckets
SET file_size_limit = 15728640,                      -- 15 MB
    allowed_mime_types = ARRAY['image/*', 'application/pdf']
WHERE id = 'justificantes';
