# Design: Landing Page Dual Audience, Visual Pricing & SEO

## Technical Approach

Single-page dual-audience landing via audience state in `Landing.jsx` (`useState`), passed as prop to sections that need it (Pricing, Hero, FinalCTA). No Context needed -- only 3 components consume the value. New `AITrainingSection.jsx` component inserted between AIReports and Testimonials. All SEO changes are static (index.html JSON-LD, meta tags) plus dynamic via existing `useSEO` hook. No backend changes, no new routes, no new packages.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Audience state management | `useState('coach')` in Landing.jsx, prop drill to Hero/Pricing/FinalCTA | React Context; URL query param | Only 3 consumers, 1 level deep. Context is overkill. Props keep data flow explicit per AGENTS.md ("avoid prop drilling -- use Context for cross-cutting concerns" -- but this is NOT cross-cutting, it is section-specific). |
| Audience toggle location | Inside Pricing.jsx (primary) + secondary path cards in Hero | Page-level toggle in Navbar; separate tabs | Pricing is where toggle matters most. Hero provides discovery via path cards that scroll to pricing. Keeps Navbar clean. |
| Pricing data structure | Extend existing `plans` array pattern with `audiencePlans` object keyed by `'coach'` / `'athlete'` | Single merged array with `audience` field | Matches existing pattern (array of plan objects). Clean conditional render. |
| New AI section | Standalone `AITrainingSection.jsx` | Extend existing AIReports.jsx | AIReports is coach-focused (ACWR/TSB reports). AI Training section showcases different features (Hermes IA chat, plan wizard). Separation of concerns. |
| FAQ sync with JSON-LD | Single source of truth: FAQ array in FAQ.jsx. Copy new entries to index.html JSON-LD manually. Add code comment linking both. | Generate JSON-LD from React FAQ data at build time | Build-time generation adds tooling complexity. Manual sync with linking comments is pragmatic for 15 FAQ entries. |
| SEO keywords strategy | Add athlete-focused keywords to existing meta tags (additive). Spanish-only. | Separate landing pages per audience | Single authoritative URL is better for small-market domain. Avoids content cannibalization. |

## Data Flow

```
Landing.jsx
  |-- useState('coach') => audience, setAudience
  |
  |-- <Hero audience={audience} />
  |     |-- Path cards: "Soy entrenador" / "Soy atleta"
  |     |-- onClick scrolls to #pricing + calls setAudience
  |
  |-- <AppShowcase />          (unchanged)
  |-- <MobileShowcase />       (unchanged)
  |-- <About />                (unchanged)
  |-- <AIReports />            (unchanged)
  |-- <AITrainingSection />    (NEW -- no props needed)
  |-- <Testimonials />         (unchanged)
  |-- <Pricing audience={audience} onAudienceChange={setAudience} />
  |     |-- Audience toggle: segmented control
  |     |-- Billing toggle: monthly/yearly (existing)
  |     |-- Conditional plan cards based on audience
  |
  |-- <FAQ />                  (modified -- new entries, no props)
  |-- <BlogPreview />          (unchanged)
  |-- <FinalCTA audience={audience} />
  |-- <Footer />               (minor text update)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Landing.jsx` | Modify | Add `audience` state, import AITrainingSection, pass props to Hero/Pricing/FinalCTA |
| `src/components/landing/Hero.jsx` | Modify | Add dual path cards below subtitle (coach/athlete). Replace WaitlistForm with "Registrate" CTA. Update stats row. Pass `onSelectAudience` callback that scrolls to pricing. |
| `src/components/landing/Pricing.jsx` | Modify | Add audience segmented control above billing toggle. Add `athletePlans` array (Gratis + Premium). Conditionally render coach or athlete plans. Accept `audience` and `onAudienceChange` props. |
| `src/components/landing/AITrainingSection.jsx` | Create | Showcase section: Hermes IA virtual coach, AI plan wizard, personalized training. 3-4 feature cards with icons. Mock chat UI card. Framer Motion animations matching AIReports style. |
| `src/components/landing/FAQ.jsx` | Modify | Add 5 independent athlete FAQs. Update answer for "Los atletas necesitan suscripcion" to distinguish coached vs independent. |
| `src/components/landing/FinalCTA.jsx` | Modify | Accept `audience` prop. Show audience-appropriate headline and subtitle. Replace WaitlistForm with Link to `/register`. |
| `src/components/landing/Footer.jsx` | Modify | Update brand description to mention both audiences. Replace "lista de espera" with "Registrate". |
| `src/components/landing/PromoBanner.jsx` | Modify | Update messaging to mention both coaches and athletes. Replace "lista de espera" with register CTA. |
| `index.html` | Modify | Update meta description + keywords. Add athlete-focused keywords. Update OG description. Add Product schema for Premium tier. Update SoftwareApplication offers array. Add new FAQ entries to FAQPage JSON-LD. |
| `public/llms.txt` | Modify | Add "Para atletas independientes" section. Add Hermes IA, AI plan generation, pricing tiers. |
| `public/sitemap.xml` | Modify | Update lastmod dates to current date. |
| `src/hooks/useSEO.js` | No change | Already supports all needed features. |
| `public/robots.txt` | No change | No new routes to block/allow. |

## Interfaces / Contracts

### Landing.jsx audience state
```jsx
const [audience, setAudience] = useState('coach'); // 'coach' | 'athlete'
```

### Hero props
```jsx
// Hero.jsx
function Hero({ audience, onSelectAudience }) // onSelectAudience: (audience: string) => void
```

### Pricing props
```jsx
// Pricing.jsx
function Pricing({ audience, onAudienceChange }) // onAudienceChange: (audience: string) => void
```

### Athlete plans data shape (inside Pricing.jsx)
```jsx
const athletePlans = [
  {
    name: 'Gratis',
    description: 'Empieza a entrenar con IA',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: '1 generacion de plan con IA', included: true },
      { text: 'Metricas basicas de rendimiento', included: true },
      { text: 'Seguimiento de competiciones', included: true },
      { text: 'Chat con Hermes IA', included: false },
      { text: 'Regeneraciones de plan semanales', included: false },
      { text: 'Conexion Strava y dispositivos', included: false },
    ],
    gradient: 'from-sky-400 to-sky-500',
    popular: false,
  },
  {
    name: 'Premium',
    description: 'Entrenamiento inteligente completo',
    monthlyPrice: 5,
    yearlyPrice: 48,
    features: [
      { text: '2 regeneraciones de plan por semana', included: true },
      { text: 'Chat ilimitado con Hermes IA', included: true },
      { text: 'Conexion Strava y dispositivos', included: true },
      { text: 'Seguimiento competiciones con cuenta atras', included: true },
      { text: 'Metricas completas y progresion', included: true },
      { text: 'Logros y gamificacion', included: true },
    ],
    gradient: 'from-sky-600 to-sky-700',
    popular: true,
  },
];
```

### AITrainingSection feature cards
```jsx
const aiFeatures = [
  { icon: BsStars, title: 'Hermes IA', description: '...', color/bg },
  { icon: FiCalendar, title: 'Plan personalizado con IA', description: '...', color/bg },
  { icon: FiTrendingUp, title: 'Metricas y progresion', description: '...', color/bg },
  { icon: FiTarget, title: 'Competiciones con cuenta atras', description: '...', color/bg },
];
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | Audience toggle switches pricing cards | Manual: click toggle, verify cards change |
| Visual | Hero path cards scroll to pricing | Manual: click "Soy atleta", verify scroll + toggle state |
| Visual | Mobile responsive on all new/modified sections | Manual: Chrome DevTools responsive mode |
| SEO | JSON-LD valid | Google Rich Results Test tool |
| SEO | Meta tags correct | View page source, check meta content |
| SEO | Lighthouse SEO >= 95 | Lighthouse audit in Chrome DevTools |
| Build | No build errors | `npm run build` |
| Lint | No lint errors | `npm run lint` |

## Migration / Rollout

No migration required. All changes are frontend-only. No DB changes, no edge functions, no env vars. Deploy = merge to master, Vercel auto-deploys.

## Open Questions

- [x] Premium pricing confirmed: 5 EUR/month, 48 EUR/year (from proposal)
- [ ] Should "beta" / "waitlist" language be cleaned up now or in a separate change? (Design assumes cleanup happens as part of this change for affected components only -- Hero, FinalCTA, Footer, PromoBanner)
- [ ] Are screenshots of independent athlete UI available for AITrainingSection? (Design proceeds with mock cards instead of screenshots)
