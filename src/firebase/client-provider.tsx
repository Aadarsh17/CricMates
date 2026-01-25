'use client';
import { initializeFirebase, FirebaseProvider } from '.';
import { useUser } from './auth/use-user';

// This new component will be wrapped by FirebaseProvider,
// so it can safely call hooks that depend on the Firebase context.
function AuthHandler({ children }: { children: React.ReactNode }) {
  // Initialize the user session and anonymous sign-in
  useUser();
  return <>{children}</>;
}

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { app, auth, db } = initializeFirebase();

  return (
    <FirebaseProvider value={{ app, auth, db }}>
      <AuthHandler>{children}</AuthHandler>
    </FirebaseProvider>
  );
}
