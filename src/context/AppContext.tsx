
"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';

type UserRole = 'guest' | 'umpire';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isUmpire: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('guest');
  const auth = useAuth();
  const { user } = useUser();

  // Automatically sign in anonymously when the role is set to 'umpire'
  // to ensure Firestore security rules allow writes.
  useEffect(() => {
    if (role === 'umpire' && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [role, user, auth]);

  return (
    <AppContext.Provider value={{
      role,
      setRole,
      isUmpire: role === 'umpire'
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
