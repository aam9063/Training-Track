# Proposal: Landing Page Dual Audience, Visual Pricing & SEO

## Intent

TrainingTrack's landing page speaks only to coaches. The new independent athlete module (AI plan generation, Hermes IA chat) has no visibility. We need to address both audiences on the landing page, show informational pricing for independent athletes, and boost Spanish-language SEO for AI-running keywords.

## Scope

### In Scope
- Hero section with dual messaging (coach / independent athlete paths)
- Audience toggle on Pricing (`Entrenador` | `Atleta Independiente`) + billing cycle toggle
- Independent athlete pricing cards: Gratis + Premium (5 EUR/mo, 48 EUR/yr) — **visual only, no Stripe**
- CTA buttons on pricing link to `/register` or waitlist (no payment flow)
- New "AI Training" section showcasing Hermes IA, AI plan wizard, personalized training
- FAQ updates: add independent athlete questions, fix "solo entrenadores pagan" answer
- FinalCTA + Footer: dual-audience messaging
- SEO: updated meta tags, OG, JSON-LD (SoftwareApplication + FAQPage + Product schema), Spanish keywords
- `llms.txt` update: independent athlete features, AI capabilities, pricing tiers
- `sitemap.xml` lastmod update

### Out of Scope
- Stripe / payment processing (added later)
- Backend tier enforcement (manual / DB flag for now)
- New routes or pages (changes stay within `/` landing)
- Blog content pages
- Beta/waitlist language cleanup (separate concern)
- New screenshots for showcases

## Approach

**Approach 1 from exploration**: Audience toggle at pricing level + dual Hero messaging.

1. **Hero.jsx** — Keep universal headline. Add two path cards below (coach / athlete) that anchor-scroll to relevant sections.
2. **New component: AITrainingSection.jsx** — Insert between AIReports and Testimonials. Showcase Hermes IA, AI plan generation, athlete-specific features.
3. **Pricing.jsx** — Add segmented control (`Entrenador` | `Atleta Independiente`) above billing toggle. Athlete view: 2 cards (Gratis / Premium). Coach view: existing 3 cards. All CTAs → `/register`.
4. **FAQ.jsx** — Add 5+ independent athlete FAQs. Update existing answers re: pricing model.
5. **FinalCTA.jsx / Footer.jsx** — Adapt messaging for both audiences.
6. **index.html** — Add athlete-focused keywords, update JSON-LD with Product schema for Premium tier, sync FAQPage entries.
7. **llms.txt** — Add independent athlete section, Hermes IA, pricing tiers.
8. **useSEO.js** — Enrich default landing metadata with dual-audience keywords.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/landing/Hero.jsx` | Modified | Dual-audience paths below headline |
| `src/components/landing/Pricing.jsx` | Modified | Audience toggle + athlete pricing cards |
| `src/components/landing/FAQ.jsx` | Modified | New athlete FAQs, updated answers |
| `src/components/landing/FinalCTA.jsx` | Modified | Dual-audience CTA messaging |
| `src/components/landing/Footer.jsx` | Modified | Updated description for both audiences |
| `src/components/landing/Testimonials.jsx` | Modified | Add athlete-relevant value props |
| `src/components/landing/About.jsx` | Modified | Add athlete feature cards |
| `src/pages/Landing.jsx` | Modified | Insert new AITrainingSection |
| `src/components/landing/AITrainingSection.jsx` | New | AI training showcase for athletes |
| `index.html` | Modified | Meta tags, keywords, JSON-LD updates |
| `public/llms.txt` | Modified | Add athlete features, pricing |
| `public/sitemap.xml` | Modified | Update lastmod dates |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Messaging confusion (two audiences on one page) | Medium | Prominent toggle, clear section headers, distinct iconography |
| FAQ JSON-LD / React component desync | Medium | Update both in same task; add comment linking them |
| SEO keyword dilution (coach vs athlete) | Low | Single authoritative page better for small Spanish-market domain |
| Pricing shown but not enforced | Low | Clear "visual only" — CTAs go to register, not checkout |

## Rollback Plan

All changes are frontend-only (no DB migrations, no edge functions). Rollback = revert the git commits on the feature branch. No data loss risk.

## Dependencies

- None. No backend changes, no new packages, no Stripe.

## Success Criteria

- [ ] Landing page addresses both coaches and independent athletes
- [ ] Audience toggle switches pricing cards correctly
- [ ] Independent athlete pricing shows Gratis + Premium (5 EUR/mo, 48 EUR/yr)
- [ ] No CTA triggers a payment flow (all go to `/register` or waitlist)
- [ ] JSON-LD includes Product schema for Premium tier
- [ ] Meta tags include Spanish AI-running keywords
- [ ] `llms.txt` mentions independent athletes, Hermes IA, pricing
- [ ] Page passes Lighthouse SEO audit >= 95
- [ ] Mobile responsive on all new/modified sections
