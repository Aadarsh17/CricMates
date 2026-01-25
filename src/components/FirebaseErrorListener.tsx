'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

// This is a client component that will listen for Firestore permission errors
// and throw them to be caught by the Next.js error overlay.
// This is only active in development.
export function FirebaseErrorListener() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Throw the error so Next.js error overlay can pick it up.
      // This is a special error that the overlay knows how to display.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}
