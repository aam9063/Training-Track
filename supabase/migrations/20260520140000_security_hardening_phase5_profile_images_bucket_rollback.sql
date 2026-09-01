-- Rollback Fase 5: restituir policy SELECT amplia en profile-images.

DROP POLICY IF EXISTS profile_images_select_own ON storage.objects;

CREATE POLICY profile_images_select
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profile-images');
