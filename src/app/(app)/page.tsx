import { redirect } from 'next/navigation';

/**
 * This file is neutralized to prevent route collision with src/app/page.tsx.
 * By making this a pure Server Component (no 'use client'), we prevent 
 * Vercel from looking for a client-reference-manifest file during build.
 */
export default function AppPage() {
  redirect('/');
}
