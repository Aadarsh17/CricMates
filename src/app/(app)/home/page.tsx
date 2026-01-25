
export default function HomePage() {
  return (
    <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold tracking-tight">Welcome to CricMates</h3>
        <p className="text-sm text-muted-foreground">
          Your dashboard for managing cricket matches.
        </p>
      </div>
    </div>
  );
}
