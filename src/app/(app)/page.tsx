import { redirect } from 'next/navigation';

/**
 * This page is redundant now that routes are flattened.
 * Redirecting to home.
 */
export default function RedirectPage() {
  redirect('/home');
}
