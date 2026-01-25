'use client';
import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, type DocumentReference } from 'firebase/firestore';
import { useFirebase } from '../provider';
import type { DocumentData } from 'firebase/firestore';

export type WithId<T> = T & { id: string };

export function useDoc<T extends DocumentData>(
  collectionName: string,
  docId: string
): { data: WithId<T> | null; loading: boolean; error: Error | null } {
  const { db } = useFirebase();
  const [data, setData] = useState<WithId<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const docRef = useRef(doc(db, collectionName, docId));

  useEffect(() => {
    const unsubscribe = onSnapshot(
      docRef.current,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id } as WithId<T>);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}
