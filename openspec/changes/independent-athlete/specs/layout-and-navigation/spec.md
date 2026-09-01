# Layout & Navigation Specification

## Purpose

Define conditional sidebar, bottom nav, and routing for independent athletes vs coached athletes.

## Requirements

### Requirement: Independent Athlete Sidebar

When `isIndependent` is `true`, the `AthleteSidebar` MUST render these items in order: Inicio (`/athlete`), Mi Plan (`/athlete/my-plan`), Calendario (`/athlete/calendar`), Mis Metricas (`/athlete/metrics`), Competiciones (`/athlete/competitions`), Asistente IA (`/athlete/ai-assistant`), Dispositivos (`/athlete/devices`), Perfil (`/athlete/profile`). All labels MUST be in Spanish.

#### Scenario: Independent sidebar renders correct items

- GIVEN an independent athlete is logged in
- WHEN the sidebar renders
- THEN it shows 8 items: Inicio, Mi Plan, Calendario, Mis Metricas, Competiciones, Asistente IA, Dispositivos, Perfil
- AND coached-only items (Entrenamiento, Mensajes) are NOT shown

#### Scenario: Coached sidebar unchanged

- GIVEN a coached athlete is logged in (`isIndependent = false`)
- WHEN the sidebar renders
- THEN it shows the existing coached athlete menu items unchanged
- AND Mi Plan, Competiciones, Asistente IA are NOT shown

### Requirement: Independent Athlete Bottom Nav (Mobile)

`AthleteBottomNav` MUST show a condensed set for mobile when `isIndependent` is `true`: Inicio, Mi Plan, Calendario, Metricas, Perfil. The full sidebar is accessible via hamburger menu.

#### Scenario: Mobile bottom nav for independent

- GIVEN an independent athlete on a mobile viewport
- WHEN the bottom navigation renders
- THEN it shows 5 items: Inicio, Mi Plan, Calendario, Metricas, Perfil

### Requirement: Route Registration

`App.jsx` MUST register lazy-loaded routes for new pages: `/athlete/my-plan`, `/athlete/competitions`, `/athlete/ai-assistant`. These routes SHOULD be guarded to require `isIndependent` or `isCoach` role as appropriate.

#### Scenario: Independent athlete accesses My Plan route

- GIVEN an independent athlete navigates to `/athlete/my-plan`
- WHEN the route resolves
- THEN the MyPlan page component loads

#### Scenario: Coached athlete cannot access independent routes

- GIVEN a coached athlete navigates to `/athlete/my-plan`
- WHEN the route resolves
- THEN the user is redirected to `/athlete/dashboard` or shown a 404

### Requirement: AthleteMobileHeader Branding

The `AthleteMobileHeader` MAY show "TrainingTrack" branding instead of coach name when `isIndependent` is `true`.

#### Scenario: Independent header branding

- GIVEN an independent athlete on mobile
- WHEN the mobile header renders
- THEN it displays "TrainingTrack" instead of a coach's name
