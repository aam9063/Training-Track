# Proposal: Floating Dock Menu (Nike-style)

## Intent

Replace the standard full-width fixed bottom nav with a floating pill-shaped dock that hovers above the viewport edge, matching modern mobile UI patterns (Nike app style). Improves visual polish and perceived quality of the PWA.

## Scope

### In Scope
- Restyle both `BottomNav.jsx` (coach) and `AthleteBottomNav.jsx` (athlete) as floating docks
- Frosted glass effect with backdrop blur, pill shape, shadow elevation, side/bottom margins
- Adjust layout padding in both dashboard layouts to accommodate new dock dimensions
- iOS safe area handling for PWA standalone mode

### Out of Scope
- Changing tab items, routes, icons, or navigation logic
- Desktop navigation changes
- Animation/gesture interactions (swipe to hide, etc.)
- New components or state management

## Approach

Pure CSS/Tailwind restyling. Apply to both nav components: `mx-4 mb-3 rounded-2xl backdrop-blur-xl bg-white/80 dark:bg-[#141414]/80 shadow-lg` replacing the current full-width `border-t` style. Increase main content `pb-` in layouts. Add `env(safe-area-inset-bottom)` for iOS PWA.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/dashboard/BottomNav.jsx` | Modified | Floating dock styles |
| `src/components/athlete/AthleteBottomNav.jsx` | Modified | Floating dock styles |
| `src/layouts/DashboardLayout.jsx` | Modified | Bottom padding adjustment |
| `src/layouts/AthleteDashboardLayout.jsx` | Modified | Bottom padding adjustment |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| iOS safe area overlap in PWA | Low | Use `env(safe-area-inset-bottom)` on dock bottom margin |
| Smaller tap targets (shorter dock) | Low | Keep min 44px touch target per item |
| 5 items cramped on small screens (narrower by ~32px) | Low | ~66px per item on 375px screen is sufficient |

## Rollback Plan

Pure CSS change — `git revert` the commit.

## Dependencies

- None. No new packages, no DB changes, no API changes.

## Success Criteria

- [ ] Dock floats with visible gap from viewport edges (sides + bottom)
- [ ] Pill shape with rounded corners
- [ ] Frosted glass blur visible when content scrolls behind
- [ ] Shadow gives elevation effect
- [ ] All navigation, badges, and active states preserved
- [ ] Works in light and dark mode
- [ ] No iOS safe area overlap in PWA standalone mode
- [ ] Skip spec/design phases — proceed directly to sdd-tasks then sdd-apply
