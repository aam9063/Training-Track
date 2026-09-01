# Tasks: Landing Page Dual Audience, Visual Pricing & SEO

## Phase 1: Landing Structure + Audience State

- [x] 1.1 `src/pages/Landing.jsx`: Add `useState('coach')` for audience, pass `audience`/`setAudience` as props to Hero, Pricing, FinalCTA. Import AITrainingSection and insert between AIReports and Testimonials.
- [x] 1.2 `src/components/landing/Hero.jsx`: Accept `audience` + `onSelectAudience` props. Add two path cards ("Soy Entrenador" / "Soy Atleta") below subtitle with icons, Spanish text, and smooth-scroll anchors (#pricing / #entrenamiento-ia). Replace WaitlistForm with "Registrate" Link to `/register`. Stack cards vertically below `md`, side-by-side on `md`+.
- [x] 1.3 `src/components/landing/Navbar.jsx`: Add "Entrenamiento IA" scroll link targeting `#entrenamiento-ia`. Keep all existing links.

## Phase 2: AI Features Section + Pricing

- [x] 2.1 Create `src/components/landing/AITrainingSection.jsx`: Section with `id="entrenamiento-ia"`. Four feature cards (Hermes IA, Plan IA, Metricas, Competiciones) with icons, Spanish titles/descriptions. 2x2 grid on `lg`+, single column below `md`. Framer Motion fade+translate on scroll. "Empieza Gratis" CTA linking to `/register`. Tailwind only, no inline styles.
- [x] 2.2 `src/components/landing/Pricing.jsx`: Accept `audience` + `onAudienceChange` props. Add audience segmented control ("Entrenador" / "Atleta Independiente") above billing toggle. Add `athletePlans` array (Gratis: 0 EUR, Premium: 5 EUR/mo or 48 EUR/yr with "Ahorra 12 EUR" badge). Conditionally render coach or athlete cards. Add feature comparison table for athlete view. All CTAs link to `/register`, no Stripe. Keep existing coach plans unchanged.

## Phase 3: Supporting Sections

- [x] 3.1 `src/components/landing/FAQ.jsx`: Add 5+ independent athlete FAQs in Spanish. Update existing answer about subscriptions to distinguish coached vs independent. Add comment linking to JSON-LD in index.html.
- [x] 3.2 `src/components/landing/FinalCTA.jsx`: Accept `audience` prop. Show audience-aware headline/subtitle. Replace WaitlistForm with Link to `/register`.
- [x] 3.3 `src/components/landing/PromoBanner.jsx`: Update messaging to address both coaches and athletes. Replace "lista de espera" with register CTA.
- [x] 3.4 `src/components/landing/Footer.jsx`: Update brand description to mention both audiences. Replace "lista de espera" with "Registrate".

## Phase 4: SEO + llms.txt

- [x] 4.1 `index.html`: Update meta description + keywords with Spanish AI-running terms for both audiences. Update `og:description`. Add `Product` JSON-LD for Premium tier (name: "TrainingTrack Premium", price: "5.00", currency: "EUR"). Update `SoftwareApplication` offers array with free + premium. Sync `FAQPage` JSON-LD with all FAQ entries from 3.1. Add comment linking to FAQ.jsx.
- [x] 4.2 `public/llms.txt`: Add "Para atletas independientes" section covering Hermes IA, AI plan generation, pricing tiers (Gratis/Premium with amounts), and athlete-specific features.
- [x] 4.3 `public/sitemap.xml`: Update `<lastmod>` for root URL to current deployment date.

## Phase 5: Verification

- [x] 5.1 Run `npm run build` — confirm zero build errors.
- [ ] 5.2 Run `npm run lint` — confirm zero lint errors.
- [ ] 5.3 Manual check: audience toggle switches pricing cards correctly, Hero path cards scroll to correct sections, all new sections mobile-responsive.
- [ ] 5.4 Validate JSON-LD with Google Rich Results Test — confirm Product + FAQPage schemas parse correctly.
