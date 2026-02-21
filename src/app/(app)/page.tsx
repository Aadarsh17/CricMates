
import { redirect } from 'next/navigation';

/**
 * This page is a child of the (app) route group.
 * To avoid conflict with the main Welcome Page at /src/app/page.tsx,
 * we redirect any accidental hits here to the dashboard.
 */
export default function AppRootRedirect() {
  redirect('/home');
}
