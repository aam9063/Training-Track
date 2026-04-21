import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export const PaymentFailed = ({
  userName = 'Atleta',
  amount = '5',
  retryUrl = 'https://trainingtrack.es/billing/retry',
  billingPortalUrl = 'https://trainingtrack.es/billing',
}) => (
  <Html lang="es">
    <Head />
    <Preview>No pudimos procesar tu pago. Actualiza tu método de pago para mantener tu suscripción</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: 'center', paddingTop: '12px', paddingBottom: '16px' }}>
          <Img
            src="https://lusirdkixfliydimemre.supabase.co/storage/v1/object/public/site-assets/email-logo.png"
            alt="TrainingTrack"
            width="140"
            height="auto"
            style={{ margin: '0 auto', display: 'block' }}
          />
        </Section>
        <Heading style={heading}>
          Hemos tenido un problema con tu pago
        </Heading>
        <Text style={paragraph}>
          Hola {userName}, no hemos podido procesar el cobro de {amount}€ de tu
          suscripción de TrainingTrack. Esto puede ocurrir por fondos
          insuficientes, tarjeta expirada o limitaciones del banco.
        </Text>

        <Text style={paragraph}>
          Para mantener tu suscripción activa, actualiza tu método de pago:
        </Text>

        <Section style={buttonSection}>
          <Button style={buttonAthlete} href={billingPortalUrl}>
            Actualizar método de pago
          </Button>
        </Section>

        <Text style={secondaryText}>
          Si ya has resuelto el problema, puedes forzar un reintento aquí:{' '}
          <Link style={inlineLink} href={retryUrl}>
            Reintentar ahora
          </Link>
          .
        </Text>

        <Text style={noteText}>
          Si no actualizas tu método de pago en los próximos 7 días, tu
          suscripción se cancelará automáticamente.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          TrainingTrack · Entrenamiento inteligente para corredores.
        </Text>
        <Text style={footer}>
          <Link style={footerLink} href="https://trainingtrack.es">
            trainingtrack.es
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default PaymentFailed;

const main = {
  backgroundColor: '#F7F7F8',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  margin: 0,
  padding: 0,
};

const container = {
  backgroundColor: '#FFFFFF',
  maxWidth: '560px',
  margin: '32px auto',
  padding: '32px',
  borderRadius: '12px',
};

const heading = {
  color: '#0A0A0A',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 16px 0',
};

const paragraph = {
  color: '#0A0A0A',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const buttonSection = {
  textAlign: 'left',
  margin: '8px 0 16px 0',
};

const buttonAthlete = {
  backgroundColor: '#16A34A',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
};

const secondaryText = {
  color: '#6B7280',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 16px 0',
};

const inlineLink = {
  color: '#1A6BFF',
  textDecoration: 'underline',
};

const noteText = {
  color: '#6B7280',
  fontSize: '13px',
  lineHeight: '20px',
  fontStyle: 'italic',
  margin: '8px 0 0 0',
};

const hr = {
  borderColor: '#E5E7EB',
  margin: '24px 0',
};

const footer = {
  color: '#6B7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '4px 0',
};

const footerLink = {
  color: '#6B7280',
  textDecoration: 'underline',
};
