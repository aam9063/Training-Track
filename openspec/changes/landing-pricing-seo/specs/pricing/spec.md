# Pricing Specification

## Purpose

Add dual-audience pricing with an audience toggle and independent athlete tiers (Gratis / Premium) alongside existing coach plans. All CTAs are informational — no payment processing.

## Requirements

### Requirement: Audience Toggle

The Pricing section MUST display a segmented control with two options: "Entrenador" and "Atleta Independiente". It MUST default to "Entrenador". The toggle MUST appear above the billing cycle toggle.

#### Scenario: Default state shows coach pricing

- GIVEN a visitor scrolls to the Pricing section
- WHEN the section renders
- THEN the audience toggle shows "Entrenador" selected
- AND the three coach plans (Gratis / Pro / Team) are visible

#### Scenario: Switching to athlete pricing

- GIVEN the audience toggle shows "Entrenador" selected
- WHEN the visitor clicks "Atleta Independiente"
- THEN the coach plans are replaced by two athlete plans (Gratis / Premium)
- AND the billing cycle toggle remains visible

### Requirement: Independent Athlete — Free Tier

When "Atleta Independiente" is selected, a "Gratis" card MUST display with features: 1 AI plan generation, basic metrics, competition tracking. It MUST NOT include: AI chat (Hermes IA), advanced metrics, Strava sync.

#### Scenario: Free tier card content

- GIVEN the audience toggle is set to "Atleta Independiente"
- WHEN the visitor views the Gratis card
- THEN the price shows "0 EUR"
- AND the feature list includes "1 plan IA" and "Metricas basicas"
- AND excluded features are shown as disabled/crossed out

### Requirement: Independent Athlete — Premium Tier

A "Premium" card MUST show 5 EUR/month or 48 EUR/year (saving 12 EUR). Features MUST include: 2 plan regenerations/week, unlimited Hermes IA chat, Strava + devices, competition tracking with countdown, full metrics, achievements & gamification.

#### Scenario: Premium monthly price

- GIVEN the audience is "Atleta Independiente" and billing is "Mensual"
- WHEN the visitor views the Premium card
- THEN the price displays "5 EUR/mes"

#### Scenario: Premium yearly price with savings

- GIVEN the audience is "Atleta Independiente" and billing is "Anual"
- WHEN the visitor views the Premium card
- THEN the price displays "48 EUR/ano"
- AND a savings badge shows "Ahorra 12 EUR"

### Requirement: Feature Comparison Table

The Pricing section SHOULD include a comparison table below the cards when "Atleta Independiente" is selected, listing all features with checkmarks per tier.

#### Scenario: Comparison table visibility

- GIVEN the audience toggle is set to "Atleta Independiente"
- WHEN the visitor scrolls below the pricing cards
- THEN a feature comparison table is visible with Gratis and Premium columns

### Requirement: CTAs Link to Registration Only

All pricing CTA buttons MUST link to `/register`. No CTA SHALL trigger a payment flow or Stripe checkout. Coach "Contactar" plan MAY link to a contact method.

#### Scenario: Athlete Premium CTA

- GIVEN the Premium card is displayed
- WHEN the visitor clicks the CTA button
- THEN the browser navigates to `/register`
- AND no payment modal or Stripe redirect occurs

### Requirement: Coach Pricing Preserved

When "Entrenador" is selected, the existing three coach plans (Gratis / Pro / Team) MUST render unchanged with their current pricing and features.

#### Scenario: Coach plans remain intact

- GIVEN the audience toggle is set to "Entrenador"
- WHEN the visitor views the pricing cards
- THEN the same 3 cards with existing prices and features are shown
