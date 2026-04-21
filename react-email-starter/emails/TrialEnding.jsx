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

export const TrialEnding = ({
  userName = 'Atleta',
  trialEndDate = '01/01/2026',
  upgradeUrl = 'https://trainingtrack.es/pricing',
}) => (
  <Html lang="es">
    <Head />
    <Preview>Tu prueba gratuita termina en 3 días — actualiza para seguir entrenando</Preview>
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
        <Heading style={heading}>Tu prueba gratuita termina en 3 días</Heading>
        <Text style={paragraph}>
          Hola {userName}, tu periodo de prueba de TrainingTrack termina el{' '}
          {trialEndDate}. Para seguir disfrutando de análisis IA, métricas
          avanzadas y plan de entrenamiento personalizado, actualiza a Premium.
        </Text>

        <Section style={bulletsSection}>
          <Text style={bullet}>• Análisis IA ilimitados con Hermes</Text>
          <Text style={bullet}>• Todas las métricas avanzadas</Text>
          <Text style={bullet}>• Planes de entrenamiento personalizados</Text>
          <Text style={bullet}>• Soporte prioritario</Text>
        </Section>

        <Section style={buttonSection}>
          <Button style={buttonAthlete} href={upgradeUrl}>
            Actualizar a Premium
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          TrainingTrack · Entrenamiento inteligente para corredores.
        </Text>
        <Text style={footer}>
          <Link style={footerLink} href="https://trainingtrack.es">
            trainingtrack.es
          </Link>
        </Text>
        <Text style={footer}>
          ¿No quieres recibir recordatorios?{' '}
          <Link
            style={footerLink}
            href="https://trainingtrack.es/athlete/profile#notifications"
          >
            Darme de baja de recordatorios
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);

export default TrialEnding;

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

const bulletsSection = {
  margin: '16px 0 24px 0',
};

const bullet = {
  color: '#0A0A0A',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '4px 0',
};

const buttonSection = {
  textAlign: 'left',
  margin: '8px 0 24px 0',
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
