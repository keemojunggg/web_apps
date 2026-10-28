export function calculateDailyTaskProgress(tasks, dateKey) {
  const eligible = tasks.filter((task) => task.dateKey === dateKey && !task.archived && !task.cancelled);
  const completed = eligible.filter((task) => task.done).length;
  const total = eligible.length;

  return {
    total,
    completed,
    remaining: total - completed,
    rate: total > 0 ? completed / total : null,
  };
}
