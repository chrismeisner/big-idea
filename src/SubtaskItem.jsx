// File: src/SubtaskItem.jsx

import React from "react";

export default function SubtaskItem({
  sub,
  editingTaskId,
  editingTaskName,
  setEditingTaskName,

  editingNotesTaskId,
  editingNotesText,
  setEditingNotesText,

  startEditingTask,
  cancelEditingTask,
  commitTaskNameEdit,

  startEditingNotes,
  cancelEditingNotes,
  commitTaskNoteEdit,

  handleToggleFocus,
  handleToggleCompleted,
}) {
  const {
	TaskName: subName,
	TaskNote: subNotes,
	Completed: subCompleted,
	CompletedTime: subCT,
	Focus: subFocus,
  } = sub.fields;

  const isEditingTitle = editingTaskId === sub.id;
  const isEditingNotes = editingNotesTaskId === sub.id;
  const subTitleClasses = subCompleted
	? "line-through text-gray-500"
	: "";

  let subCompletedLabel = "";
  if (subCompleted && subCT) {
	try {
	  subCompletedLabel = new Date(subCT).toLocaleString();
	} catch {
	  subCompletedLabel = "Invalid date";
	}
  }

  const subFocusEmoji = subFocus === "today" ? "☀️" : "💤";

  return (
	<li className="pl-2 border-b last:border-b-0 pb-2">
	  <div className="flex items-center gap-2">
		{!subCompleted && (
		  <div
			className="sub-drag-handle text-gray-400 cursor-grab active:cursor-grabbing"
			title="Drag to reorder subtasks"
		  >
			⇅
		  </div>
		)}
		<span
		  className="cursor-pointer"
		  onClick={() => handleToggleFocus(sub)}
		  title="Toggle Focus"
		>
		  {subFocusEmoji}
		</span>
		<input
		  type="checkbox"
		  checked={!!subCompleted}
		  onChange={() => handleToggleCompleted(sub)}
		/>

		{isEditingTitle ? (
		  <input
			type="text"
			value={editingTaskName}
			onChange={(e) => setEditingTaskName(e.target.value)}
			onBlur={() => commitTaskNameEdit(sub)}
			onKeyDown={(e) => {
			  if (e.key === "Enter") commitTaskNameEdit(sub);
			  else if (e.key === "Escape") cancelEditingTask();
			}}
			autoFocus
			className="border-b border-gray-300 focus:outline-none"
		  />
		) : (
		  <span
			className={subTitleClasses}
			onClick={() => startEditingTask(sub)}
		  >
			{subName || "Untitled Subtask"}
		  </span>
		)}
	  </div>

	  {subCompleted && subCompletedLabel && (
		<p className="text-xs text-gray-500 ml-6 mt-1">
		  Completed on {subCompletedLabel}
		</p>
	  )}

	  <div className="ml-6 mt-2">
		{isEditingNotes ? (
		  <div className="space-y-2">
			<textarea
			  rows={3}
			  className="w-full border p-1 rounded"
			  value={editingNotesText}
			  onChange={(e) => setEditingNotesText(e.target.value)}
			/>
			<div className="flex space-x-2">
			  <button
				onClick={() => commitTaskNoteEdit(sub)}
				className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
			  >
				Save
			  </button>
			  <button
				onClick={cancelEditingNotes}
				className="text-xs bg-gray-300 px-2 py-1 rounded"
			  >
				Cancel
			  </button>
			</div>
		  </div>
		) : subNotes && subNotes.trim().length > 0 ? (
		  <p
			className="text-sm text-gray-600 cursor-pointer hover:underline"
			onClick={() => startEditingNotes(sub)}
		  >
			{subNotes}
		  </p>
		) : (
		  <p
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => startEditingNotes(sub)}
		  >
			+ Add Notes
		  </p>
		)}
	  </div>
	</li>
  );
}
