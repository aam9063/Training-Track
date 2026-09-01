# SEO & LLMs Specification

## Purpose

Enhance Spanish-market SEO with dual-audience meta tags, structured data for pricing, and updated llms.txt for AI discoverability.

## Requirements

### Requirement: Meta Tags Update

The `index.html` MUST update the `<meta name="description">` and `<meta name="keywords">` to reference both coaches and independent athletes. Keywords MUST include: "entrenador virtual running", "plan entrenamiento IA", "app atletismo", "entrenamiento running inteligencia artificial", "plan running personalizado".

#### Scenario: Meta description covers both audiences

- GIVEN a search engine crawls the landing page
- WHEN it reads the meta description
- THEN the description mentions both coaches and independent athletes with AI training

#### Scenario: Keywords include athlete terms

- GIVEN the `<meta name="keywords">` tag is present
- WHEN a crawler reads it
- THEN it contains at least 5 Spanish AI-running keywords alongside existing coach keywords

### Requirement: Open Graph Tags

The OG `og:description` MUST be updated to mention both audiences. The `og:title` and `og:image` MAY remain unchanged if still accurate.

#### Scenario: OG description reflects dual audience

- GIVEN the page is shared on social media
- WHEN the platform renders the OG preview
- THEN the description references coaches and independent athletes

### Requirement: JSON-LD Structured Data

The `index.html` MUST include a `Product` (or `Offer`) JSON-LD schema for the independent athlete Premium tier (5 EUR/month). The existing `SoftwareApplication` schema MUST add an `offers` array covering free and premium tiers. `FAQPage` schema entries MUST be synced with all FAQ items rendered in the React component.

#### Scenario: Product schema for Premium tier

- GIVEN a search engine parses JSON-LD on the page
- WHEN it finds the Product schema
- THEN it contains name "TrainingTrack Premium", price "5.00", priceCurrency "EUR", and availability "InStock"

#### Scenario: FAQ schema matches React component

- GIVEN the FAQ React component renders N questions
- WHEN the JSON-LD FAQPage is parsed
- THEN it contains the same N question-answer pairs (text content MUST match)

### Requirement: llms.txt Update

The `public/llms.txt` MUST add sections for: independent athlete features, Hermes IA virtual coach, AI plan generation, and pricing tiers (Gratis / Premium with amounts).

#### Scenario: llms.txt mentions independent athletes

- GIVEN an AI assistant reads `llms.txt`
- WHEN it parses the content
- THEN it finds information about independent athlete features and pricing

### Requirement: Sitemap Update

The `public/sitemap.xml` MUST update the `<lastmod>` date for the root URL (`/`) to reflect the current deployment date.

#### Scenario: Sitemap lastmod is current

- GIVEN the sitemap is read by a crawler
- WHEN it checks the root URL entry
- THEN the `<lastmod>` date is no older than the deployment date of this change

### Requirement: FAQ Sync Protocol

Any FAQ added to the React component MUST also be added to the JSON-LD `FAQPage` in `index.html`, and vice versa. A code comment MUST be placed in both locations referencing each other.

#### Scenario: New FAQ added to both locations

- GIVEN a developer adds a new FAQ question
- WHEN they update the React FAQ component
- THEN the same question-answer MUST also exist in JSON-LD
- AND both locations contain a comment indicating the sync requirement
