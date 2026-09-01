-- Fase 5: tighten profile-images bucket SELECT policy.
-- Antes: profile_images_select permitia a authenticated listar TODO el bucket.
-- El bucket es publico, asi que las URLs publicas siguen funcionando sin la
-- policy SELECT amplia. Se restringe a "el dueño puede listar su propia
-- carpeta {userId}/..." para auditoria/operaciones del propio usuario.
--
-- Aplicada en prod (lusirdkixfliydimemre) el 2026-05-20 via apply_migration.

DROP POLICY IF EXISTS profile_images_select ON storage.objects;

CREATE POLICY profile_images_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
