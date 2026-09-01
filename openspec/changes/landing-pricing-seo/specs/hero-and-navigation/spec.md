# Hero & Navigation Specification

## Purpose

Adapt the Hero section and Navbar to address both coaches and independent athletes, providing clear audience paths from the landing page entry point.

## Requirements

### Requirement: Dual-Audience Hero Messaging

The Hero section MUST retain a universal headline and MUST display two audience path cards below it: one for coaches ("Entrenador") and one for independent athletes ("Atleta Independiente").

Each path card MUST contain: an icon, a short value proposition in Spanish, and an anchor link that smooth-scrolls to the relevant section (Pricing for coaches, AI Training section for athletes).

#### Scenario: Visitor sees both audience paths

- GIVEN a visitor lands on the home page
- WHEN the Hero section renders
- THEN the universal headline is displayed
- AND two path cards appear below the subtitle
- AND each card has an icon, Spanish text, and a scroll CTA

#### Scenario: Coach path card click

- GIVEN the Hero is visible with both path cards
- WHEN the visitor clicks the "Entrenador" path card
- THEN the page smooth-scrolls to the Pricing section with coach tab pre-selected

#### Scenario: Athlete path card click

- GIVEN the Hero is visible with both path cards
- WHEN the visitor clicks the "Atleta Independiente" path card
- THEN the page smooth-scrolls to the AI Training section

### Requirement: Hero CTA Update

The Hero SHOULD replace the WaitlistForm with a primary "Registrate" CTA button linking to `/register`. The WaitlistForm MAY be retained as a secondary element if the beta/waitlist is still active.

#### Scenario: Primary CTA leads to registration

- GIVEN the Hero section is rendered
- WHEN the visitor clicks the primary CTA button
- THEN the browser navigates to `/register`

### Requirement: Navbar Compatibility

The Navbar SHOULD include a link to the new AI Training section (e.g., "IA Training" or "Entrenamiento IA") in its section scroll links. Existing nav links MUST NOT be removed.

#### Scenario: Navbar includes AI Training link

- GIVEN the Navbar is rendered on the landing page
- WHEN the visitor views the navigation links
- THEN an "Entrenamiento IA" link is visible
- AND clicking it smooth-scrolls to the AITrainingSection

### Requirement: Mobile Responsiveness

The dual path cards MUST stack vertically on viewports below the `md` breakpoint and display side-by-side on `md` and above.

#### Scenario: Mobile layout stacks cards

- GIVEN the viewport width is below `md` (< 768px)
- WHEN the Hero renders
- THEN the two audience path cards are stacked vertically

#### Scenario: Desktop layout shows cards side-by-side

- GIVEN the viewport width is `md` or above (>= 768px)
- WHEN the Hero renders
- THEN the two audience path cards display side-by-side
