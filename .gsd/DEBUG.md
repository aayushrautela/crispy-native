# Debug Session: Persistent Reanimated Warnings on Appearance Screen

## Symptom
Reanimated warnings "It looks like you might be using shared value's .value inside reanimated inline style" persist on the Appearance screen, specifically when the accent color selector is visible.

**When:** Navigating to Settings > Appearance, or toggling "Material You" off.
**Expected:** No console warnings.
**Actual:** Multiple warnings appear. Hiding the color selector (enabling Material You) stops the warnings.

## Evidence
- `ExpressiveSwitch` was refactored and should be clean.
- `SettingsItem` uses `Touchable`.
- Color picker uses `TouchableOpacity` (standard RN), `Typography` (custom), `ScrollView` (RN), `View` (RN).
- `SettingsGroup` wraps the content.
- `SettingsSubpage` wraps the whole screen.

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | `Touchable` uses `theme.colors` inside worklet | 70% | UNTESTED |
| 2 | `Typography` uses Reanimated incorrectly | 10% | UNTESTED |
| 3 | `SettingsGroup` animation issue | 20% | UNTESTED |

## Attempts
