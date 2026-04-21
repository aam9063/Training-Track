// Exporta las plantillas React Email a HTML estático con placeholders {{var}}
// para que send-email (Supabase Edge Function) haga el interpolado simple.
//
// Estrategia anti-escape: pasamos placeholders tipo __USER_NAME__ a los
// componentes (valores seguros, sin llaves), renderizamos a HTML, y luego
// hacemos replaceAll por {{userName}} etc. Así evitamos que React Email
// escape las llaves `{{ }}`.

import { render } from '@react-email/render';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import { WelcomeCoach } from '../emails/WelcomeCoach.jsx';
import { WelcomeAthlete } from '../emails/WelcomeAthlete.jsx';
import { CoachInvite } from '../emails/CoachInvite.jsx';
import { TrialEnding } from '../emails/TrialEnding.jsx';
import { PaymentFailed } from '../emails/PaymentFailed.jsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Salida: Frontend/supabase/functions/send-email/templates/
const OUT_DIR = path.resolve(
  __dirname,
  '../../supabase/functions/send-email/templates'
);

// Salida del módulo TS bundleable: Frontend/supabase/functions/send-email/templates.ts
const OUT_TS = path.resolve(
  __dirname,
  '../../supabase/functions/send-email/templates.ts'
);

// Escapa el HTML para inclusión como template literal JS (backticks).
// - `\` -> `\\`
// - backtick -> `\``
// - `${` -> `\${` (evita interpolación accidental)
// No tocamos `{{placeholders}}` — son simples pares de llaves en texto.
function escapeForTemplateLiteral(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const TEMPLATES = [
  {
    file: 'welcome-coach.html',
    component: WelcomeCoach,
    props: {
      userName: '__USER_NAME__',
      loginUrl: '__LOGIN_URL__',
    },
    placeholderMap: {
      __USER_NAME__: '{{userName}}',
      __LOGIN_URL__: '{{loginUrl}}',
    },
  },
  {
    file: 'welcome-athlete.html',
    component: WelcomeAthlete,
    props: {
      userName: '__USER_NAME__',
      loginUrl: '__LOGIN_URL__',
    },
    placeholderMap: {
      __USER_NAME__: '{{userName}}',
      __LOGIN_URL__: '{{loginUrl}}',
    },
  },
  {
    file: 'coach-invite.html',
    component: CoachInvite,
    props: {
      coachName: '__COACH_NAME__',
      athleteName: '__ATHLETE_NAME__',
      inviteUrl: '__INVITE_URL__',
      personalMessage: '__PERSONAL_MESSAGE__',
    },
    placeholderMap: {
      __COACH_NAME__: '{{coachName}}',
      __ATHLETE_NAME__: '{{athleteName}}',
      __INVITE_URL__: '{{inviteUrl}}',
      __PERSONAL_MESSAGE__: '{{personalMessage}}',
    },
  },
  {
    file: 'trial-ending.html',
    component: TrialEnding,
    props: {
      userName: '__USER_NAME__',
      trialEndDate: '__TRIAL_END_DATE__',
      upgradeUrl: '__UPGRADE_URL__',
    },
    placeholderMap: {
      __USER_NAME__: '{{userName}}',
      __TRIAL_END_DATE__: '{{trialEndDate}}',
      __UPGRADE_URL__: '{{upgradeUrl}}',
    },
  },
  {
    file: 'payment-failed.html',
    component: PaymentFailed,
    props: {
      userName: '__USER_NAME__',
      amount: '__AMOUNT__',
      retryUrl: '__RETRY_URL__',
      billingPortalUrl: '__BILLING_PORTAL_URL__',
    },
    placeholderMap: {
      __USER_NAME__: '{{userName}}',
      __AMOUNT__: '{{amount}}',
      __RETRY_URL__: '{{retryUrl}}',
      __BILLING_PORTAL_URL__: '{{billingPortalUrl}}',
    },
  },
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Acumulador para generar templates.ts
  const rendered = [];

  for (const t of TEMPLATES) {
    const element = React.createElement(t.component, t.props);
    // @react-email/render >= 1.0 devuelve Promise<string>
    let html = await render(element, { pretty: true });

    for (const [needle, replacement] of Object.entries(t.placeholderMap)) {
      html = html.split(needle).join(replacement);
    }

    const outPath = path.join(OUT_DIR, t.file);
    await fs.writeFile(outPath, html, 'utf-8');
    console.log(`\u2713 ${t.file} -> ${outPath}`);

    const key = t.file.replace(/\.html$/, '');
    rendered.push({ key, html });
  }

  console.log(`\nExported ${TEMPLATES.length} templates to ${OUT_DIR}`);

  // Generar templates.ts (módulo bundleable para la edge function)
  const header = [
    '// AUTO-GENERATED. Do not edit by hand.',
    '// Regenerate with: cd react-email-starter && npm run export',
    '',
    'export const TEMPLATES: Record<string, string> = {',
  ].join('\n');

  const body = rendered
    .map(({ key, html }) => `  ${JSON.stringify(key)}: \`${escapeForTemplateLiteral(html)}\`,`)
    .join('\n');

  const footer = '};\n';

  const tsSource = `${header}\n${body}\n${footer}`;

  await fs.mkdir(path.dirname(OUT_TS), { recursive: true });
  await fs.writeFile(OUT_TS, tsSource, 'utf-8');
  console.log(`\u2713 templates.ts -> ${OUT_TS}`);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
