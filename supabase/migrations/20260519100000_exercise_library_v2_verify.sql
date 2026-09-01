-- Verificacion de exercise_library_v2.
-- Devuelve 1 fila por check con OK / FAIL. Si todo OK, ejecutar es seguro.

SELECT 'running.cols' AS check_name,
       CASE WHEN COUNT(*) = 6 THEN 'OK' ELSE 'FAIL ('||COUNT(*)||'/6)' END AS status
FROM information_schema.columns
WHERE table_name='running_exercises_bank'
  AND column_name IN ('tags','level','body_region','common_errors','kpi','slug')
UNION ALL
SELECT 'gym.cols',
       CASE WHEN COUNT(*) = 6 THEN 'OK' ELSE 'FAIL ('||COUNT(*)||'/6)' END
FROM information_schema.columns
WHERE table_name='gym_exercises_bank'
  AND column_name IN ('tags','level','body_region','common_errors','instructions','slug')
UNION ALL
SELECT 'running.slugs_unique',
       CASE WHEN COUNT(*) = COUNT(DISTINCT slug) AND COUNT(*) FILTER (WHERE slug IS NULL) = 0
            THEN 'OK' ELSE 'FAIL' END
FROM running_exercises_bank
UNION ALL
SELECT 'gym.slugs_unique',
       CASE WHEN COUNT(*) = COUNT(DISTINCT slug) AND COUNT(*) FILTER (WHERE slug IS NULL) = 0
            THEN 'OK' ELSE 'FAIL' END
FROM gym_exercises_bank
UNION ALL
SELECT 'running.new_enum_values',
       CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'FAIL ('||COUNT(*)||'/5)' END
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname='running_category'
  AND e.enumlabel IN ('technical_drill','recovery_run','progressive_run','tempo_run','test')
UNION ALL
SELECT 'gym.new_enum_values',
       CASE WHEN COUNT(*) >= 4 THEN 'OK' ELSE 'FAIL ('||COUNT(*)||'/4)' END
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname='gym_category'
  AND e.enumlabel IN ('core','mobility','plyometrics','injury_prevention');
