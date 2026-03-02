
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
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean, type?: string})  | null | undefined,
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
        let path: string = 'collection_group_query';
        try {
          const q = memoizedTargetRefOrQuery as any;
          // Attempt to extract meaningful path info for both collection group and standard queries
          if (q.path) {
            path = q.path;
          } else if (q.type === 'collection') {
             path = `[Collection: ${q.id || 'unknown'}]`;
          } else if (q.query && q.query.path) {
             path = `[Query: ${q.query.path.segments.join('/') || 'unknown'}]`;
          } else if (q._query && q._query.path) {
             const segments = q._query.path.segments || [];
             path = `[Group Query: ${segments.join('/') || 'unknown'}]`;
          }
        } catch (e) {
          path = 'collection_group_query';
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        setError(contextualError);
        setData(null);
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
