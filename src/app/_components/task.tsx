"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { z } from "zod";

const statusColors = {
  pending: "bg-yellow-400",
  "in-progress": "bg-blue-400",
  completed: "bg-green-500",
} as const;

export function TaskManager() {
  const utils = api.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"pending" | "in-progress" | "completed">(
    "pending",
  );

  const { data: tasks, isLoading } = api.task.getTasks.useQuery();
  const createTask = api.task.createTask.useMutation({
    onSuccess: async () => {
      await utils.task.invalidate();
      setTitle("");
      setDescription("");
      setStatus("pending");
    },
  });

  const updateStatus = api.task.updateTask.useMutation({
    onSuccess: () => utils.task.invalidate(),
  });

  const deleteTask = api.task.deleteTask.useMutation({
    onSuccess: () => utils.task.invalidate(),
  });

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-xl bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-center text-2xl font-bold">📝 Task Manager</h2>

      {/* Create Task */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createTask.mutate({ title, description, status });
        }}
        className="space-y-4"
      >
        <input
          type="text"
          placeholder="Task title"
          className="w-full rounded-md border px-4 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Description"
          className="w-full rounded-md border px-4 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="w-full rounded-md border px-4 py-2"
        >
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <button
          type="submit"
          disabled={createTask.isPending}
          className="w-full rounded-md bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
        >
          {createTask.isPending ? "Creating..." : "Create Task"}
        </button>
      </form>

      <hr className="my-6" />

      {/* Task List */}
      <div>
        <h3 className="mb-3 text-xl font-semibold">📋 Your Tasks</h3>
        {isLoading ? (
          <p>Loading tasks...</p>
        ) : tasks?.length === 0 ? (
          <p className="text-gray-500">No tasks found.</p>
        ) : (
          <ul className="space-y-4">
            {tasks?.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-2 rounded-lg border bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h4 className="text-lg font-bold">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-gray-600">{task.description}</p>
                  )}
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium text-white ${statusColors[task.status]}`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Update Status */}
                  <select
                    value={task.status}
                    onChange={(e) =>
                      updateStatus.mutate({
                        id: task.id,
                        status: e.target.value as any,
                      })
                    }
                    className="rounded-md border px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask.mutate({ id: task.id })}
                    className="font-semibold text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
