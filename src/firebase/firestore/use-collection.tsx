'use client';
import { useEffect, useState, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  type CollectionReference,
  type Query,
} from 'firebase/firestore';
import { useFirebase } from '../provider';
import type { DocumentData } from 'firebase/firestore';

// Define a generic type for documents with an ID
export type WithId<T> = T & { id: string };

export function useCollection<T extends DocumentData>(
  collectionName: string
): { data: WithId<T>[]; loading: boolean; error: Error | null } {
  const { db } = useFirebase();
  const [data, setData] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const collectionRef = useRef(collection(db, collectionName));

  useEffect(() => {
    const q = query(collectionRef.current);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newData = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as WithId<T>)
        );
        setData(newData);
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
