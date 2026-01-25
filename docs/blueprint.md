# **App Name**: CricMates - ScoresTracker

## Core Features:

- Welcome Screen: Display a welcome screen with a brief introduction to the app and navigation options.
- Team Management: Enable CRUD operations for teams, including adding, editing, and deleting teams, and displaying team cards.
- Player Management: Enable CRUD operations for players within each team, including aggregated stats. Support player retire feature
- Match Initialization: Configure a match, including team selection, toss outcome, and decision to bat or ball first.
- Real-time Score Tracking: Track real-time scores, including runs (0-6), wickets, wides, no-balls, and undo functionality; implement the ability to swap players.
- Match History: Display a list of previous matches with key statistics and outcomes, stored in Firestore.
- Points Table: Generate and display a points table with teams ranked according to their Net Run Rate (NRR), calculated automatically based on match history stored in Firestore.

## Style Guidelines:

- Primary color: Dark Blue (#3F51B5) to convey reliability and seriousness appropriate to a score-tracking app.
- Background color: Very light gray (#F0F2F5), a desaturated version of the primary color, providing a clean and neutral backdrop.
- Accent color: Teal (#008080), an analogous color to the primary hue that provides an active, contrasting tone suitable for highlights.
- Body and headline font: 'PT Sans', a humanist sans-serif for a balance of modern look and readability.
- Use clear and consistent icons to represent different actions and categories, ensuring intuitive navigation and easy recognition.
- Implement a responsive design that adapts to different screen sizes, ensuring a consistent and user-friendly experience across devices.
- Use subtle transitions and animations to enhance user interaction, such as highlighting active elements and providing visual feedback for actions.