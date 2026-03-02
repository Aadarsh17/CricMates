
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field and path to a given type T. */
export type WithId<T> = T & { id: string; __fullPath?: string };

/**
 * Interface for the return value of the useCollection hook.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean}) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        snapshot.docs.forEach((doc) => {
          results.push({ 
            ...(doc.data() as T), 
            id: doc.id,
            __fullPath: doc.ref.path 
          });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        let path: string = 'unknown_path';
        try {
          // Robust path identification for error overlays
          const q = memoizedTargetRefOrQuery as any;
          if (q.path) {
            path = q.path;
          } else if (q._query && q._query.path) {
            path = `[Collection Group: ${q._query.path.segments.join('/')}]`;
          } else if (err.message.includes('collection group')) {
            // Attempt to extract from error message if possible
            const match = err.message.match(/collection group "([^"]+)"/);
            path = match ? `[Collection Group: ${match[1]}]` : '[Collection Group Query]';
          }
        } catch (e) {
          path = 'collection_group_query';
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        setError(contextualError);
        setData([]); // Return empty list instead of null to prevent some UI crashes
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);
  
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('useCollection target was not properly memoized using useMemoFirebase');
  }
  
  return { data, isLoading, error };
}
