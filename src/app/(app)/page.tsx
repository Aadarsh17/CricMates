import { redirect } from 'next/navigation';

/**
 * This page is neutralized to resolve route collision with the main Welcome Page.
 * It performs a server-side redirect to ensure the build manifest is consistent.
 */
export default function AppPage() {
  redirect('/');
}
