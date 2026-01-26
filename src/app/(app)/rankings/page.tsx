'use client';

export default function RankingsPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Rankings
          </h1>
          <p className="text-muted-foreground">
            Official player and team rankings.
          </p>
        </div>
      </div>
       <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            Rankings will be available here in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
