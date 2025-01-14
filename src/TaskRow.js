// File: /src/TaskRow.js
import React from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";

function TaskRow({
  task,
  subtasks,
  editingTaskId,
  editingTaskName,
  onStartEditing,
  onEditNameChange,   // <--- new callback
  onCommitEdit,       // <--- new callback
  onCancelEditing,
  onToggleCompleted,
  onCreateSubtask,
}) {
  // Parent (top-level) task states
  const isEditingParent = editingTaskId === task.id;
  const isCompletedParent = task.fields.Completed || false;
  const completedTimeParent = task.fields.CompletedTime || null;

  return (
	<>
	  {/* MAIN (parent) TASK ROW */}
	  <li className="relative flex items-center py-3 px-3 hover:bg-gray-50 group">
		{/* Sortable handle */}
		<Bars3Icon
		  className="h-5 w-5 text-gray-400 mr-3 grab-handle"
		  title="Drag to reorder"
		/>

		{/* Completed? */}
		<input
		  type="checkbox"
		  className="mr-2"
		  checked={isCompletedParent}
		  onChange={() => onToggleCompleted(task)}
		/>

		{isEditingParent ? (
		  // -----------------------------
		  // EDIT MODE (Parent)
		  // -----------------------------
		  <input
			autoFocus
			className="flex-1 border-b border-gray-300 focus:outline-none"
			value={editingTaskName}
			onChange={(e) => onEditNameChange(e.target.value)} 
			onBlur={() => onCommitEdit(task.id)}               // commit on blur
			onKeyDown={(e) => {
			  if (e.key === "Enter") {
				onCommitEdit(task.id);                         // commit on Enter
			  } else if (e.key === "Escape") {
				onCancelEditing();
			  }
			}}
		  />
		) : (
		  // -----------------------------
		  // READ MODE (Parent)
		  // -----------------------------
		  <span
			className={`flex-1 text-gray-800 cursor-pointer ${
			  isCompletedParent ? "line-through text-gray-500" : ""
			}`}
			onClick={() => onStartEditing(task.id, task.fields.TaskName)}
		  >
			{task.fields.TaskName}
		  </span>
		)}

		{/* Optional: show CompletedTime if completed */}
		{isCompletedParent && completedTimeParent && (
		  <span className="ml-2 text-sm text-gray-400">
			(Done on {new Date(completedTimeParent).toLocaleString()})
		  </span>
		)}

		{/* "Add Subtask" button (on hover) */}
		<button
		  onClick={() => onCreateSubtask(task)}
		  className="ml-2 text-sm py-1 px-2 bg-purple-600 text-white rounded hidden group-hover:inline-block"
		>
		  + Subtask
		</button>
	  </li>

	  {/* RENDER SUBTASKS */}
	  {subtasks.length > 0 && (
		<ul className="ml-6 border-l border-gray-200">
		  {subtasks.map((sub) => {
			const isEditingSub = editingTaskId === sub.id;
			const isCompletedSub = sub.fields.Completed || false;
			const completedTimeSub = sub.fields.CompletedTime || null;

			return (
			  <li
				key={sub.id}
				className="relative flex items-center py-2 pl-3 hover:bg-gray-50"
			  >
				{/* Completed? */}
				<input
				  type="checkbox"
				  className="mr-2"
				  checked={isCompletedSub}
				  onChange={() => onToggleCompleted(sub)}
				/>

				{isEditingSub ? (
				  // -----------------------------
				  // EDIT MODE (Subtask)
				  // -----------------------------
				  <input
					autoFocus
					className="flex-1 border-b border-gray-300 focus:outline-none"
					value={editingTaskName}
					onChange={(e) => onEditNameChange(e.target.value)}
					onBlur={() => onCommitEdit(sub.id)}
					onKeyDown={(e) => {
					  if (e.key === "Enter") {
						onCommitEdit(sub.id);
					  } else if (e.key === "Escape") {
						onCancelEditing();
					  }
					}}
				  />
				) : (
				  // -----------------------------
				  // READ MODE (Subtask)
				  // -----------------------------
				  <span
					className={`flex-1 cursor-pointer ${
					  isCompletedSub ? "line-through text-gray-500" : ""
					}`}
					onClick={() =>
					  onStartEditing(sub.id, sub.fields.TaskName)
					}
				  >
					{sub.fields.TaskName}
				  </span>
				)}

				{/* Optional: show CompletedTime if completed */}
				{isCompletedSub && completedTimeSub && (
				  <span className="ml-2 text-sm text-gray-400">
					(Done on {new Date(completedTimeSub).toLocaleString()})
				  </span>
				)}
			  </li>
			);
		  })}
		</ul>
	  )}
	</>
  );
}

export default TaskRow;
