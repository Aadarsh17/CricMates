'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RootRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/home');
    }, [router]);

    // Render a loading skeleton to provide feedback during the brief redirection period.
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64 mt-2" />
                </div>
                <div className="flex gap-2">
                     <Skeleton className="h-10 w-36" />
                     <Skeleton className="h-10 w-36" />
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
            <Skeleton className="h-64 w-full" />
      </div>
    );
}
