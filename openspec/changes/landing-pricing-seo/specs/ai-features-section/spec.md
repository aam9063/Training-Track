# AI Features Section Specification

## Purpose

New landing page section showcasing AI training capabilities for independent athletes: personalized plans, Hermes IA virtual coach, metrics tracking, and competition management.

## Requirements

### Requirement: Section Placement and Identity

The AITrainingSection component MUST be inserted in the Landing page between the AIReports section and Testimonials. It MUST have an `id` attribute for anchor navigation from the Navbar and Hero.

#### Scenario: Section renders in correct position

- GIVEN a visitor scrolls through the landing page
- WHEN they pass the AIReports section
- THEN the AI Training section appears before Testimonials
- AND it has a scrollable anchor id (e.g., `entrenamiento-ia`)

### Requirement: Feature Showcase Cards

The section MUST display at least four feature cards covering: (1) AI Plan Generation — personalized training plans via onboarding wizard, (2) Hermes IA — virtual coach chat, (3) Metrics & Progression — performance tracking and insights, (4) Competitions — race tracking with countdown.

#### Scenario: All four features visible

- GIVEN the AI Training section is rendered
- WHEN the visitor views the section
- THEN four feature cards are visible, each with an icon, Spanish title, and description

#### Scenario: Cards are responsive

- GIVEN the viewport is below `md`
- WHEN the section renders
- THEN the cards stack in a single column
- AND on `lg`+ viewports they display in a 2x2 or 4-column grid

### Requirement: Visual Style Consistency

The section MUST follow the existing landing page visual style: Tailwind utilities, Framer Motion entry animations, consistent color palette and typography. It MUST NOT introduce new CSS files or inline styles.

#### Scenario: Animations on scroll

- GIVEN the AI Training section is outside the viewport
- WHEN the visitor scrolls it into view
- THEN the cards animate in using Framer Motion (fade + translate)

### Requirement: Athlete-Oriented CTA

The section MUST include a CTA button (e.g., "Empieza Gratis") linking to `/register`. The CTA SHOULD reference the free tier availability.

#### Scenario: CTA navigates to register

- GIVEN the AI Training section is visible
- WHEN the visitor clicks the CTA button
- THEN the browser navigates to `/register`

### Requirement: Spanish Language

All text content in the section MUST be in Spanish (es-ES). No English labels, headings, or descriptions SHALL appear.

#### Scenario: All text is Spanish

- GIVEN the AI Training section renders
- WHEN the visitor reads the content
- THEN all headings, descriptions, and CTA text are in Spanish
