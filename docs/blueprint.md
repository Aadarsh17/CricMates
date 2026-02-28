# **App Name**: CricMates

## Core Features:

- User Authentication & Roles: Secure dual access system with Guest (read-only live scores) and Umpire (full scoring control) modes, utilizing Firebase Authentication.
- Team & Player Management: Create, Read, Update, and Delete (CRUD) teams and player profiles, with players assignable to teams or designated as free agents. Data stored in Firestore.
- Live Cricket Scoring Engine: Ball-by-ball scoring system for cricket matches, including runs, wickets, various extras (wide, no-ball, byes), and automated strike rotation, with real-time updates via Firestore.
- Real-time Statistics Display: Calculates and displays in real-time essential player statistics such as batting average, strike rate, bowling economy, and wickets during live matches.
- CVP (Cricket Value Points) Calculator Tool: A generative AI-powered tool that automatically calculates Cricket Value Points for players based on a complex set of performance milestones (e.g., runs, boundaries, wickets, economy, maidens, fielding dismissals).
- League & Player Rankings: Displays a dynamic Points Table with Net Run Rate (NRR) calculation and Player Rankings based on aggregated CVP scores from various matches, backed by Firestore.
- Number Game Mini-Game: A casual 'Number Game' mini-game simulating street cricket rules (e.g., '3 Dots = Out'), allowing for informal scoring sessions and local aggregated statistics.

## Style Guidelines:

- Primary color: A deep Navy hue (hsl(231 48% 48%), #4051B5) for a professional and sophisticated feel, creating a strong brand identity.
- Accent color: A vibrant Teal (hsl(180 100% 25%), #008080) used to highlight key interactive elements and provide visual contrast.
- Background color: An extremely light, almost off-white, soft blue (hsl(210 20% 98%), #F9FAFB) to ensure high readability with dark text and highlight the primary and accent colors.
- Body and headline font: 'Inter' (sans-serif) for its modern, clean, and objective aesthetic, ensuring high readability across all information and statistics.
- Utilize Lucide React icons for all UI elements, providing crisp, scalable vector graphics that maintain a consistent professional appearance.
- Adopt a mobile-first responsive layout with professional rounded aesthetics (0.75rem radius), using ShadCN UI components for a modern and polished user interface.
- Implement subtle and smooth transitions for all UI interactions, score updates, and view changes, enhancing the overall fluidity and responsiveness of the application.