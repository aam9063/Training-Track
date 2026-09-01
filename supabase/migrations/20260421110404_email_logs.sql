CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  template text NOT NULL,
  subject text,
  status text NOT NULL CHECK (status IN ('queued','sent','failed','bounced')),
  resend_id text,
  error_message text,
  vars jsonb,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON public.email_logs(template);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_service_role_all ON public.email_logs;
CREATE POLICY email_logs_service_role_all ON public.email_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
