"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';

type UserRole = 'guest' | 'umpire';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isUmpire: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('guest');

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