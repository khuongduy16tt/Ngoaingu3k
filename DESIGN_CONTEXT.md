# Design Context

## Product overview
- Ngoaingu3k is an online English-learning platform for students, teachers, and admins.
- The experience combines public course discovery, learning studio flows, progress tracking, dashboards, and enrollment-related actions.
- The product should feel trustworthy, motivating, and practical rather than playful or overly corporate.

## Primary audience
- The interface serves all roles equally: learners, instructors, and administrators.
- It should feel clear and welcoming to first-time visitors while still being efficient for returning users.
- The tone should support learning progress, confidence, and action.

## Brand personality
- Clean
- Performance-oriented
- Soft
- Balanced and modern

## Brand identity (2026)
- Primary `#385791` — header, navigation, primary CTA, headings, links. The dominant brand color.
- Secondary blue `#59B3E1` — secondary CTA, selected/active state, info, highlights.
- Secondary green `#52BD87` — success, progress, completion, achievement.
- Never change these HEX values. White text only on `#385791` (7.14:1); on blue/green fills use navy ink `#0f2140` (6.8:1).
- All colors live in `client/src/styles/tokens.css` (primitive → semantic `--color-*` → legacy aliases). Components must use tokens, never raw HEX.
- Keep neutral surfaces and whitespace dominant; brand colors are accents, not backgrounds everywhere.

## Visual direction
- Calm, modern, trustworthy educational UI: navy brand header, light cool-neutral surfaces, blue for interaction, green for progress.
- Use color strategically to highlight calls to action, course importance, and progress states.
- Strong hierarchy, generous spacing, and crisp content structure are more important than decorative effects.

## Design principles
1. Make the experience feel calm and focused, not noisy.
2. Use color and motion to guide attention, not to overwhelm.
3. Prioritize clarity, trust, and progress over novelty.
4. Keep the UI readable and approachable for Vietnamese users while maintaining a modern global feel.
5. Support accessibility through strong contrast, readable typography, and reduced-motion behavior.

## Visual language guidance
- Good directions: brand navy/blue/green accents, rounded surfaces (12px cards), subtle elevation, gentle transitions. Gradients only between brand colors and sparingly.
- Avoid: the retired green/orange brand (#6bcf49, #ec6e23), monotone gray UI, overly saturated or neon colors, heavy animation, cluttered hero sections, generic enterprise styling.

## Content and tone
- Copy should feel concise, encouraging, and educational.
- Emphasize confidence, progress, and practical outcomes.
- Keep the experience supportive for learners and efficient for staff and admins.

## Accessibility expectations
- Maintain strong color contrast and readable text.
- Preserve keyboard access and clear focus states.
- Respect reduced-motion preferences.
- Ensure key actions remain obvious and touch targets comfortable.
