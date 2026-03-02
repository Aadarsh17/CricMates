
"use client"

import React, { createContext, useContext, ReactNode } from 'react';
import { useUser } from '@/firebase';

interface AppContextType {
  isUmpire: boolean;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();

  return (
    <AppContext.Provider value={{
      isUmpire: !!user,
      isLoading: isUserLoading
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
