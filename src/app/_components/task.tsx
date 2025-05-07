"use client";
import { lookup as getMimeType } from "mime-types";
import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  PlusCircle,
  Search,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
  Edit,
  X,
  Filter,
  SortAsc,
  SortDesc,
  Image as ImageIcon,
  Upload,
} from "lucide-react";

// Status configuration
const statusConfig = {
  pending: {
    color: "bg-amber-100 text-amber-800",
    icon: <Clock className="h-4 w-4" />,
  },
  "in-progress": {
    color: "bg-blue-100 text-blue-800",
    icon: <Loader2 className="h-4 w-4" />,
  },
  completed: {
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="h-4 w-4" />,
  },
};

export function TaskManager() {
  const utils = api.useUtils();

  // Task states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"pending" | "in-progress" | "completed">(
    "pending",
  );
  const [taskImage, setTaskImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"title" | "status" | "createdAt">(
    "createdAt",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "in-progress" | "completed"
  >("all");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch tasks
  const { data: tasks, isLoading } = api.task.getTasks.useQuery();

  // Mutations
  const createTask = api.task.createTask.useMutation({
    onSuccess: async () => {
      await utils.task.invalidate();
      resetForm();
      setIsModalOpen(false);
    },
  });

  const updateTask = api.task.updateTask.useMutation({
    onSuccess: () => utils.task.invalidate(),
  });

  const deleteTask = api.task.deleteTask.useMutation({
    onSuccess: () => utils.task.invalidate(),
  });

  // B2 image upload mutations
  const getUploadUrl = api.b2.getUploadUrl.useMutation();
  const confirmUpload = api.b2.confirmUpload.useMutation();

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setTaskImage(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  // Reset form after submission
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("pending");
    setTaskImage(null);
    setImagePreview(null);
    setImageUrl(null);
    setEditingTask(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle task editing
  const startEditingTask = (task: any) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setImageUrl(task.imageUrl || null);
    setIsModalOpen(true);
  };

  // Upload image to B2
  const uploadImageToB2 = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Generate a unique filename to avoid collisions
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}-${file.name.replace(/\s+/g, "_")}`;

      // Get upload URL from B2
      setUploadProgress(20);
      const contentType =
        getMimeType(uniqueFileName) || "application/octet-stream"; // fallback

      const uploadData = await getUploadUrl.mutateAsync({
        fileName: uniqueFileName,
        contentType,
      });

      setUploadProgress(40);

      // Upload file directly to B2 using fetch with blob
      const response = await fetch(uploadData.uploadUrl, {
        method: "POST",
        headers: {
          Authorization: uploadData.authorizationToken,
          "Content-Type": file.type,
          "X-Bz-File-Name": encodeURIComponent(uniqueFileName),
          "X-Bz-Content-Sha1": "do_not_verify", // In a production app, calculate SHA1
        },
        body: file,
      });

      setUploadProgress(70);

      if (!response.ok) {
        throw new Error(`B2 upload failed: ${response.statusText}`);
      }

      const b2Response = await response.json();

      setUploadProgress(90);

      // Confirm upload
      const result = await confirmUpload.mutateAsync({
        fileId: b2Response.fileId,
        fileName: uniqueFileName,
        taskId: editingTask?.id,
      });

      setUploadProgress(100);
      return result.imageUrl;
    } catch (error) {
      console.error("B2 upload error:", error);
      throw new Error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle task submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload image to B2 if present
      if (taskImage) {
        finalImageUrl = await uploadImageToB2(taskImage);
      }

      if (editingTask) {
        await updateTask.mutateAsync({
          id: editingTask.id,
          title,
          description,
          status,
          imageUrl: finalImageUrl || undefined,
        });
      } else {
        await createTask.mutateAsync({
          title,
          description,
          status,
          imageUrl: finalImageUrl || undefined,
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error submitting task:", error);
      // You might want to add error handling here (e.g., show a toast)
    } finally {
      setIsUploading(false);
    }
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    ? tasks
        .filter(
          (task) =>
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
            (statusFilter === "all" || task.status === statusFilter),
        )
        .sort((a, b) => {
          // Sort by selected field
          if (sortField === "title") {
            return sortDirection === "asc"
              ? a.title.localeCompare(b.title)
              : b.title.localeCompare(a.title);
          } else if (sortField === "status") {
            return sortDirection === "asc"
              ? a.status.localeCompare(b.status)
              : b.status.localeCompare(a.status);
          } else {
            // Default to createdAt
            return sortDirection === "asc"
              ? new Date(a.createdAt || 0).getTime() -
                  new Date(b.createdAt || 0).getTime()
              : new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime();
          }
        })
    : [];

  return (
    <div className="rounded-lg bg-white shadow-md">
      {/* Header with search and create button */}
      <div className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-gray-50 py-2 pr-10 pl-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <Filter className="pointer-events-none absolute top-2 right-3 h-4 w-4 text-gray-400" />
          </div>

          {/* Sort Control */}
          <div className="relative">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="rounded-lg border border-gray-300 bg-gray-50 py-2 pr-10 pl-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="createdAt">Date</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              className="absolute top-2 right-3 text-gray-400"
            >
              {sortDirection === "asc" ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            <PlusCircle className="h-5 w-5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <p className="text-lg font-medium text-gray-600">
              {searchQuery || statusFilter !== "all"
                ? "No tasks match your search criteria"
                : "No tasks found"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== "all"
                ? "Try changing your search or filter"
                : "Create your first task to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Task
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {task.imageUrl ? (
                          <div className="flex h-10 w-10 flex-shrink-0">
                            <img
                              src={task.imageUrl}
                              alt="Task"
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="line-clamp-1 text-sm text-gray-500">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[task.status].color}`}
                      >
                        {statusConfig[task.status].icon}
                        {task.status === "in-progress"
                          ? "In Progress"
                          : task.status.charAt(0).toUpperCase() +
                            task.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEditingTask(task)}
                          className="rounded p-1 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTask.mutate({ id: task.id })}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Task Modal */}
      {isModalOpen && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                {editingTask ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                  placeholder="Task title"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                  placeholder="Task description"
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700"
                >
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Task Image
                </label>
                <div className="mt-1 flex items-center gap-4">
                  {imagePreview || imageUrl ? (
                    <div className="relative h-32 w-32 overflow-hidden rounded-lg">
                      <img
                        src={imagePreview || imageUrl || ""}
                        alt="Task preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTaskImage(null);
                          setImagePreview(null);
                          if (!editingTask) {
                            setImageUrl(null);
                          }
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 rounded-full bg-white p-1 shadow-md hover:bg-gray-100"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                        <span className="mt-1 block text-xs text-gray-500">
                          Upload to B2
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="absolute h-32 w-32 cursor-pointer opacity-0"
                      />
                    </div>
                  )}

                  {isUploading && (
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-gray-700">
                        Uploading to B2...
                      </div>
                      <div className="h-2 w-full max-w-xs rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-blue-600 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {uploadProgress}%
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Optional. Images are stored in Backblaze B2 cloud storage.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isUploading || createTask.isPending || updateTask.isPending
                  }
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  {isUploading ||
                  createTask.isPending ||
                  updateTask.isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <span>{editingTask ? "Update Task" : "Create Task"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
