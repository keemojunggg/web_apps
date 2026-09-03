import type { Task } from "@/types/task";

type Props = {
  task: Task;
  editingTitle: string;
  setEditingTitle: (title: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export default function TaskModal({
  editingTitle,
  setEditingTitle,
  onSave,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          จัดการรายการ
        </h3>

        <input
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          className="mb-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-lg outline-none focus:border-indigo-400"
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSave}
            className="h-12 rounded-2xl bg-indigo-500 font-semibold text-white active:scale-95 transition"
          >
            แก้ไข
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="h-12 rounded-2xl bg-red-500 font-semibold text-white active:scale-95 transition"
          >
            ลบ
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full rounded-2xl bg-gray-100 font-semibold text-gray-700 active:scale-95 transition"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
