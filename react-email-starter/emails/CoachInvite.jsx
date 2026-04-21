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

export const CoachInvite = ({
  coachName = 'Tu entrenador',
  athleteName = 'Atleta',
  inviteUrl = 'https://trainingtrack.es/invite',
  personalMessage = '',
}) => (
  <Html lang="es">
    <Head />
    <Preview>{coachName} te ha invitado a TrainingTrack para entrenar juntos</Preview>
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
          {coachName} te ha invitado a TrainingTrack
        </Heading>
        <Text style={paragraph}>
          {coachName} quiere ser tu entrenador en TrainingTrack. Acepta la
          invitación para empezar a recibir tus planes de entrenamiento
          personalizados.
        </Text>

        {personalMessage ? (
          <Section style={messageBox}>
            <Text style={messageText}>{personalMessage}</Text>
          </Section>
        ) : null}

        <Section style={buttonSection}>
          <Button style={buttonCoach} href={inviteUrl}>
            Aceptar invitación
          </Button>
        </Section>

        <Text style={smallNote}>
          Si no esperabas esta invitación, puedes ignorar este correo.
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

export default CoachInvite;

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

const messageBox = {
  backgroundColor: '#F3F4F6',
  borderLeft: '4px solid #1A6BFF',
  padding: '16px 20px',
  borderRadius: '6px',
  margin: '16px 0 24px 0',
};

const messageText = {
  color: '#0A0A0A',
  fontSize: '15px',
  lineHeight: '22px',
  fontStyle: 'italic',
  margin: 0,
};

const buttonSection = {
  textAlign: 'left',
  margin: '8px 0 16px 0',
};

const buttonCoach = {
  backgroundColor: '#1A6BFF',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
};

const smallNote = {
  color: '#6B7280',
  fontSize: '13px',
  lineHeight: '20px',
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
