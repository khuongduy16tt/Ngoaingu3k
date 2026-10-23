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

## Brand identity (restored 10/2026)
- Source: commit `15a0e9a` in this repository, “Doi brand sang bo nhan dien moi (#385791 / #59B3E1 / #52BD87)”. Use this exact palette across public pages, learner views, teacher and admin views, and both themes.
- Primary navy `#385791`: header, navigation, primary actions, headings, links. Hover `#2D4876`; pressed `#253C63`. White text on navy has 7.14:1 contrast.
- Ocean blue `#59B3E1`: secondary actions, active states, focus, informational highlights. Dark navy text `#0F2140` on this fill; white text has insufficient contrast.
- Success green `#52BD87`: correct answers, completed work, progress and achievement only. Use navy text `#0F2140` on green fills or dark green `#1F7A50` for text on light surfaces.
- Light theme: background `#F5F8FC`, muted surface `#F2F6FB`, body text `#14223F`, subtle blue-gray borders. Dark theme: background `#0E1729`, surfaces `#16243F`, text `#EEF3FB`, lighter blue for links and focus.
- The canonical color map is `client/src/styles/tokens.css`: brand primitives → semantic `--color-*` → compatibility aliases. The home and site v2 styles use the same palette through historical `--hv-green-*` aliases; their names are legacy, while their visual value is blue.
- Use the exact original logo geometry, including its original wordmark, from the three transparent files in `client/public/images/imported/`: `logo-ngoaingu3k-white-transparent.png` (inverse on navy/dark backgrounds), `logo-ngoaingu3k-black-transparent.png` (positive on light backgrounds), and `logo-ngoaingu3k-color-transparent.png` (full-color on light backgrounds). These are background-extracted from `logo-ngoaingu3k-brand.png` without retyping or redrawing. `BrandLogo.jsx` displays the white version in the header and switches between color and white with the login modal's theme. Keep the lockup proportional and within the header height. Use the recolored `hero-banner-blue-v3.png` on desktop and mobile home hero.
- Keep light surfaces and whitespace dominant. Apply blue to interaction and emphasis; reserve warning and error hues for their meanings.

## Visual direction
- Calm, modern, trustworthy educational UI: navy header, cool light surfaces, ocean blue for interaction, success green for progress.
- Use color strategically to highlight calls to action, course importance, and progress states.
- Strong hierarchy, generous spacing, and crisp content structure are more important than decorative effects.

## Page header rule
- Do not add a language-list pill or eyebrow such as “Tiếng Anh · Tiếng Trung” above page headings on any page, in either light or dark mode. Start with the meaningful heading itself. Language names may still appear in navigation, course content, and descriptive copy when they convey information.

## Design principles
1. Make the experience feel calm and focused, not noisy.
2. Use color and motion to guide attention, not to overwhelm.
3. Prioritize clarity, trust, and progress over novelty.
4. Keep the UI readable and approachable for Vietnamese users while maintaining a modern global feel.
5. Support accessibility through strong contrast, readable typography, and reduced-motion behavior.

## Visual language guidance
- Good directions: navy and ocean-blue accents, rounded surfaces, subtle elevation, gentle transitions. Gradients only between brand colors and sparingly.
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
