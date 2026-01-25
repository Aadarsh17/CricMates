'use client';
import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { useFirebase } from '../provider';

export function useUser() {
  const { auth } = useFirebase();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
      } else {
        // Automatically sign in the user anonymously if not logged in
        signInAnonymously(auth).catch((error) => {
          console.error('Anonymous sign-in failed:', error);
          setLoading(false);
        });
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
