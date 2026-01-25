import { notFound } from "next/navigation";
import { teams } from "@/lib/data";

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const team = teams.find((t) => t.id === params.id);
  if (!team) {
    notFound();
  }

  return (
    <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold tracking-tight">{team.name}</h3>
        <p className="text-sm text-muted-foreground">
          Player management and team stats will be shown here. Feature coming
          soon!
        </p>
      </div>
    </div>
  );
}
