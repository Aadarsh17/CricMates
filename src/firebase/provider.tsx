'use client';
import { createContext, useContext } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const FirebaseProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: FirebaseContextValue;
}) => {
  return (
    <FirebaseContext.Provider value={value}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
};
