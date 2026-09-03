import type { Task } from "@/types/task";

type UseTasksProps = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
};

export function useTasks({
  tasks,
  setTasks,
}: UseTasksProps) {
  const addTask = (newItem: Task) => {
    setTasks((prev) => [newItem, ...prev]);
  };

  const getActiveTask = (activeTaskId: number | null) => {
    return tasks.find((task) => task.id === activeTaskId);
  };

  return {
    addTask,
    getActiveTask,
  };
}