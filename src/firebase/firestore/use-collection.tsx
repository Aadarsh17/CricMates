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

/* Internal implementation of Query for path extraction */
export interface InternalQuery extends Query<DocumentData> {
  _query?: {
    path?: {
      canonicalString?(): string;
      toString?(): string;
    },
    collectionId?: string;
  };
  type?: string;
  path?: string;
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
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
        for (const doc of snapshot.docs) {
          results.push({ 
            ...(doc.data() as T), 
            id: doc.id,
            __fullPath: doc.ref.path 
          });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        // Enhanced diagnostic path extraction for better error reporting
        let path: string = 'unknown_query';
        try {
          const q = memoizedTargetRefOrQuery as any;
          // Check if it's a standard collection reference
          if (q.type === 'collection' && q.path) {
            path = q.path;
          } 
          // Check if it's a query object (often used for collectionGroup)
          else if (q._query) {
            const collectionId = q._query.collectionId;
            const canonicalPath = q._query.path?.canonicalString?.() || q._query.path?.toString?.();
            
            if (collectionId && (!canonicalPath || canonicalPath === '/')) {
              path = `[Collection Group Query: ${collectionId}]`;
            } else if (canonicalPath) {
              path = canonicalPath;
            } else {
              path = 'collection_group_query';
            }
          }
        } catch (e) {
          path = 'error_resolving_query_path';
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        // trigger global error propagation
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