'use client';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import firebaseConfig from './config';
import { useMemo } from 'react';

// Providers
export { FirebaseProvider, useFirebase } from './provider';
export { FirebaseClientProvider } from './client-provider';

// Hooks
export { useUser } from './auth/use-user';
export { useDoc } from './firestore/use-doc';
export { useCollection } from './firestore/use-collection';

type FirebaseInstances = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let firebaseInstances: FirebaseInstances | null = null;

export function initializeFirebase(): FirebaseInstances {
  if (firebaseInstances) {
    return firebaseInstances;
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const auth = getAuth(app);
  const db = getFirestore(app);

  firebaseInstances = { app, auth, db };
  return firebaseInstances;
}

export function useMemoFirebase<T>(
  factory: () => T,
  deps: React.DependencyList
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
