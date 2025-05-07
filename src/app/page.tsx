import { api, HydrateClient } from "~/trpc/server";
import { TaskManager } from "./_components/task";

export default async function Home() {
  void api.task.getTasks.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h1 className="mb-8 text-center text-3xl font-bold text-gray-800">
            Task Manager
          </h1>
          <TaskManager />
        </div>
      </main>
    </HydrateClient>
  );
}
