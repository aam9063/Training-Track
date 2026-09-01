# Exploration: Landing Page Adaptation, Pricing Toggle & SEO

## Current State

### Landing Page Architecture

The landing page lives at `src/pages/Landing.jsx` and renders these sections in order:

1. **Navbar** (`src/components/landing/Navbar.jsx`) — Fixed top nav with hash-based section scrolling. Links: Inicio, Conocenos, Informes IA, Pricing, FAQ, Blog. CTA buttons: Iniciar Sesion, Registrate.
2. **Hero** (`src/components/landing/Hero.jsx`) — Full-screen hero with headline "Entrena con datos. No con Excel". Currently targets coaches exclusively. Features list: IA reports, Strava sync, mesocycle planner, PWA. Contains a **WaitlistForm** (email signup). Badge says "Proximo lanzamiento".
3. **AppShowcase** (`src/components/landing/AppShowcase.jsx`) — Desktop screenshot gallery (5 screenshots) with interactive selection. Coach-focused screenshots only.
4. **MobileShowcase** (`src/components/landing/MobileShowcase.jsx`) — Mobile PWA screenshots in a 3D phone frame with tab selector. 4 screenshots: metrics, calendar, AI report, season planner.
5. **About** (`src/components/landing/About.jsx`) — "Conoce Training Track" feature grid: AI reports, athlete management, season planner, Strava sync, performance predictor, push notifications. Integration logos (Strava active, Garmin/Polar/Suunto/Coros upcoming).
6. **AIReports** (`src/components/landing/AIReports.jsx`) — Dedicated section for AI weekly reports. Mock report card with ACWR/TSB/RPE metrics. Features: metrics at a glance, smart alerts, specific recommendations, competition prediction.
7. **Testimonials** (`src/components/landing/Testimonials.jsx`) — Actually a "Beta Abierta" reasons section (not real testimonials). 4 cards: data-driven decisions, AI reports, built for coaches, direct communication. CTA banner for free beta registration.
8. **Pricing** (`src/components/landing/Pricing.jsx`) — Three-tier coach pricing with monthly/yearly toggle:
   - **Gratis**: up to 3 athletes, basic features. 0 EUR
   - **Pro**: up to 20 athletes, AI reports, exports, mesocycle planner. 14.99/month or 149/year
   - **Team**: unlimited athletes, everything. 24.99/month or 249/year
   - Beta banner on top: "Gratis durante la beta" with register link
9. **FAQ** (`src/components/landing/FAQ.jsx`) — 10 questions/answers. Currently mentions coaches only (e.g., "Los atletas no pagan nada. Solo el entrenador necesita suscripcion").
10. **BlogPreview** (`src/components/landing/BlogPreview.jsx`) — Latest 3 blog articles.
11. **FinalCTA** (`src/components/landing/FinalCTA.jsx`) — Blue section with WaitlistForm and progress card mock.
12. **Footer** (`src/components/landing/Footer.jsx`) — Links, social, WaitlistForm, copyright.
13. **ScrollToTop** — Scroll-to-top button.
14. **PromoBanner** (`src/components/landing/PromoBanner.jsx`) — Floating bottom-right popup (6s delay) for non-logged users. WaitlistForm.
15. **CookieConsent** — Cookie banner.

### Current Messaging Problem

The entire landing page is **coach-centric**. Every section talks about "tus atletas", "entrenadores", "gestion de atletas". There is **zero mention** of independent athletes or AI-powered personal training. The new independent athlete module needs visibility.

### Current SEO Setup

**index.html** has extensive SEO already:
- Title, description, keywords meta tags (coach-focused keywords)
- Open Graph tags (og:type, og:url, og:title, og:description, og:image, og:locale, og:site_name)
- Twitter Card tags
- Google Analytics (G-EF0NGFCNJD)
- Google Site Verification
- Canonical URL
- JSON-LD structured data: SoftwareApplication, Organization, BreadcrumbList, FAQPage
- PWA manifest, theme-color

**robots.txt**: Allows all, disallows `/dashboard/` and `/athlete/`. References sitemap.

**sitemap.xml**: 8 URLs (/, /blog, 3 blog posts, /casos-de-uso, /login, /privacidad, /register). Last updated 2026-02-17.

**useSEO hook** (`src/hooks/useSEO.js`): Dynamic meta tag management. Sets title, description, OG, Twitter, canonical, JSON-LD per page.

**llms.txt** (`public/llms.txt`): Comprehensive markdown document describing TrainingTrack for AI assistants. Coach-focused, no mention of independent athletes or AI training planner.

### Current Pricing Structure

The existing Pricing component has:
- A monthly/yearly billing toggle (already implemented)
- 3 coach plans (Gratis/Pro/Team)
- A "Gratis durante la beta" banner at the top
- All CTAs link to `/register`

There is **no independent athlete pricing** at all.

## Affected Areas

### Must Modify
- `src/components/landing/Hero.jsx` — Add independent athlete messaging, possibly dual CTA or audience toggle
- `src/components/landing/Pricing.jsx` — Add "Entrenador / Atleta Independiente" toggle, new athlete pricing tiers
- `src/components/landing/FAQ.jsx` — Add independent athlete FAQs, update existing answers
- `src/components/landing/Navbar.jsx` — May need new nav links for athlete-specific sections
- `src/components/landing/About.jsx` — Add independent athlete features
- `src/components/landing/FinalCTA.jsx` — Dual messaging (coach + athlete)
- `src/components/landing/Footer.jsx` — Update description, possibly dual CTAs
- `src/components/landing/Testimonials.jsx` — Add independent athlete reasons
- `index.html` — Update meta tags, keywords, structured data for independent athletes, add new FAQ entries to JSON-LD
- `public/llms.txt` — Add independent athlete features, AI training planner, Hermes IA chat
- `public/sitemap.xml` — Add any new pages (if created)
- `src/pages/Landing.jsx` — May add new sections (e.g., IndependentAthleteShowcase, AITraining section)

### May Create
- `src/components/landing/IndependentAthleteSection.jsx` — New dedicated section showcasing AI training for solo athletes
- `src/components/landing/PricingToggle.jsx` — Audience toggle component (if extracted from Pricing)

### No Change Needed
- `src/components/landing/AppShowcase.jsx` — Desktop screenshots (can add athlete screenshots later)
- `src/components/landing/MobileShowcase.jsx` — Mobile screenshots
- `src/components/landing/WaitlistForm.jsx` — Reusable, no changes needed
- `src/components/landing/BlogPreview.jsx` — Blog section, no changes
- `src/components/landing/ScrollToTop.jsx` — Utility, no changes
- `src/components/landing/CookieConsent.jsx` — Legal, no changes
- `src/components/landing/PromoBanner.jsx` — Could update messaging but low priority
- `src/hooks/useSEO.js` — Already supports dynamic meta, no changes needed
- `public/robots.txt` — No changes needed

## Approaches

### Approach 1: Audience Toggle at Page Level (Recommended)

Add an "Entrenador / Atleta Independiente" toggle at the **Pricing section level** and adapt the Hero to address both audiences.

**Implementation:**
- Hero: Split messaging. Primary headline stays universal ("Entrena con datos"). Add two sub-paths: one for coaches, one for independent athletes. Use a subtle tab or auto-carousel.
- About section: Add 2-3 independent athlete feature cards alongside existing coach cards, or create a separate grid that appears based on context.
- Pricing: Add an audience toggle (pill switcher) above the billing cycle toggle. When "Atleta Independiente" is selected, show Free + Premium (5 EUR/month, 48 EUR/year) plans. When "Entrenador" is selected, show existing 3 plans.
- FAQ: Add 4-5 independent athlete questions. The toggle at pricing level does not need to affect FAQ (show all FAQs always).
- New section: Insert an "AI Training" section between AIReports and Testimonials showcasing Hermes IA, AI plan generation, and independent athlete features.

- Pros: Minimal disruption to existing page structure. Clear separation of audiences. Toggle pattern is familiar to users (like Notion, Linear pricing pages).
- Cons: Some sections remain coach-heavy. Users need to discover the toggle.
- Effort: Medium

### Approach 2: Two Separate Landing Pages

Create `/entrenadores` and `/atletas` routes with separate landing pages sharing some components.

- Pros: Maximum SEO potential (two keyword-optimized pages). Fully tailored messaging per audience.
- Cons: High duplication. Double maintenance. Significantly more work. Current `/` route needs a decision (redirect? split hero?).
- Effort: High

### Approach 3: Single Page with Interleaved Sections

Keep one page but interleave coach and athlete sections, creating a narrative flow: "For coaches... AND for independent athletes..."

- Pros: Single URL, complete story. Good for SEO (one authoritative page).
- Cons: Page becomes very long. Harder to maintain focus. May confuse users who only care about one audience.
- Effort: Medium-High

## Recommendation

**Approach 1 (Audience Toggle at Pricing + Dual Hero)** is the best balance of effort, SEO impact, and user experience.

Specific implementation plan:

1. **Hero**: Keep universal headline. Add a secondary section below the subtitle with two "paths" — a coach path card and an athlete path card that scroll to relevant sections. Replace WaitlistForm with a "Registrate" CTA (the app is live, not pre-launch anymore).
2. **New Section: AI Training for Athletes** — Insert after AIReports. Showcase: Hermes IA virtual coach, AI plan generation wizard, personalized training based on profile, competition tracking with countdown. Use the same visual style (mock cards, floating badges).
3. **Pricing Toggle**: Add a segmented control (`Entrenador` | `Atleta Independiente`) above the existing billing toggle. Independent athlete plans:
   - **Gratis**: 1 AI plan generation, basic metrics, no AI chat
   - **Premium**: 5 EUR/month or 48 EUR/year (save 12 EUR). 2 plan regen/week, unlimited Hermes IA chat, Strava + devices, competition tracking, full metrics, achievements & gamification.
4. **FAQ**: Add 5+ independent athlete FAQs. Update "Los atletas no pagan nada" answer to distinguish between coached athletes (free) and independent athletes (free tier + premium).
5. **SEO Enhancement**:
   - Add keywords: "entrenador virtual running", "plan entrenamiento personalizado IA", "app atletismo", "entrenamiento running con inteligencia artificial", "plan running personalizado", "coach virtual running", "Hermes IA running"
   - Add JSON-LD `Product` schema for premium subscription
   - Update `SoftwareApplication` offers to include free + premium tiers
   - Add new FAQ entries to JSON-LD FAQPage
   - Update OG description to mention both audiences
6. **llms.txt**: Add full independent athlete section, Hermes IA description, AI plan generation flow, pricing tiers.
7. **Pre-launch cleanup**: Several elements reference "lista de espera" and "beta". These should be updated since the app appears to be live (register links exist). This is a parallel concern.

### Pricing Component Structure

```
Pricing.jsx:
  [Audience Toggle: Entrenador | Atleta Independiente]

  If "Entrenador":
    [Beta Banner (if still relevant)]
    [Billing Toggle: Mensual | Anual]
    [3 cards: Gratis / Pro / Team]

  If "Atleta Independiente":
    [Billing Toggle: Mensual | Anual]
    [2 cards: Gratis / Premium]
    Premium features:
      - 2 regeneraciones de plan por semana
      - Chat ilimitado con Hermes IA
      - Conexion Strava y dispositivos
      - Seguimiento de competiciones con cuenta atras
      - Metricas completas y progresion
      - Logros y gamificacion
```

### SEO Keywords Strategy (Spanish)

**Primary keywords** (high intent):
- "plan entrenamiento running personalizado"
- "entrenador virtual running IA"
- "app entrenamiento atletismo"
- "plan entrenamiento maraton IA"
- "software entrenador running"

**Secondary keywords**:
- "plan entrenamiento media maraton"
- "entrenamiento running con inteligencia artificial"
- "coach virtual running"
- "app running España"
- "plan entrenamiento 10k personalizado"
- "Hermes IA entrenamiento"
- "ACWR TSB RPE running"
- "metricas rendimiento running"

**Long-tail keywords** (blog + landing):
- "como crear plan entrenamiento running con IA"
- "mejor app para entrenadores de atletismo"
- "plataforma gestion atletas running"
- "entrenamiento running sin entrenador"

## Risks

- **Messaging confusion**: Two audiences on one page can dilute the message. The toggle must be prominent and clear.
- **Beta/launch inconsistency**: Multiple sections reference "beta", "lista de espera", "proximo lanzamiento". These need cleanup or the page will feel inconsistent. The WaitlistForm is used in Hero, FinalCTA, Footer, and PromoBanner.
- **SEO keyword cannibalization**: Adding too many athlete keywords to the main page could dilute coach-related SEO. However, since the domain is small and the target market is Spanish-language, consolidation on one page is likely better than splitting.
- **Pricing not yet enforced**: The independent athlete pricing (free tier limits, premium features) needs backend enforcement (Stripe integration, subscription checks). The landing page can show prices before backend is ready, but the register flow needs to handle this.
- **FAQ JSON-LD sync**: The FAQ entries in `index.html` JSON-LD must match the FAQ component. Currently they are duplicated (static in HTML + dynamic in React). Any FAQ changes need both updates.
- **Stale llms.txt**: The llms.txt is comprehensive but outdated. It does not mention independent athletes, AI training planner, Hermes IA, or the new athlete modules at all.

## Ready for Proposal

Yes. The exploration covers all affected areas, the recommended approach (Approach 1) is clear and feasible. The orchestrator can proceed with `sdd-propose` to define scope, phasing, and rollback plan. Key decisions needed from the user:
1. Should the "beta" / "waitlist" language be cleaned up as part of this change, or is that a separate task?
2. Are there screenshots of the independent athlete UI available for the showcase sections?
3. Is the premium pricing (5 EUR/month, 48 EUR/year) confirmed?
