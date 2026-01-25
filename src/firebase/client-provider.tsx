'use client';
import { initializeFirebase, FirebaseProvider } from '.';
import { useUser } from './auth/use-user';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { app, auth, db } = initializeFirebase();
  // Initialize the user session and anonymous sign-in
  useUser();

  return (
    <FirebaseProvider value={{ app, auth, db }}>{children}</FirebaseProvider>
  );
}
