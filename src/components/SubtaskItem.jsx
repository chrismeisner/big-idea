// File: src/components/SubtaskItem.jsx

import React from "react";
import InlineEdit from "./InlineEdit";

export default function SubtaskItem({
  sub,
  editingTaskId,
  editingTaskName,
  setEditingTaskName,
  editingNotesTaskId,
  editingNotesText,
  setEditingNotesText,
  onToggleCompleted,
  onToggleFocus,
  onCommitName,
  onCommitNotes,
}) {
  const { TaskName, TaskNote, Completed, CompletedTime, Focus } = sub.fields;
  const isEditingTitle = editingTaskId === sub.id;
  const isEditingNotes = editingNotesTaskId === sub.id;
  const subTitleClasses = Completed ? "line-through text-gray-500" : "";

  let completedLabel = "";
  if (Completed && CompletedTime) {
	try {
	  completedLabel = new Date(CompletedTime).toLocaleString();
	} catch {}
  }
  const focusEmoji = Focus === "today" ? "☀️" : "💤";

  return (
	<li className="pl-2 border-b last:border-b-0 pb-2">
	  <div className="flex items-center gap-2">
		{!Completed && (
		  <div
			className="sub-drag-handle text-gray-400 cursor-grab active:cursor-grabbing"
			title="Drag to reorder subtasks"
		  >
			⇅
		  </div>
		)}
		<span
		  className="cursor-pointer"
		  onClick={() => onToggleFocus(sub)}
		  title="Toggle Focus"
		>
		  {focusEmoji}
		</span>
		<input
		  type="checkbox"
		  checked={!!Completed}
		  onChange={() => onToggleCompleted(sub)}
		/>

		{isEditingTitle ? (
		  <InlineEdit
			value={editingTaskName}
			onSave={(val) => onCommitName(sub, val)}
			className="border-b border-gray-300 focus:outline-none"
		  />
		) : (
		  <span
			className={subTitleClasses}
			onClick={() => {
			  setEditingTaskName(TaskName || "");
			  onCommitName(sub, TaskName);
			}}
		  >
			{TaskName || "Untitled Subtask"}
		  </span>
		)}
	  </div>

	  {Completed && completedLabel && (
		<p className="text-xs text-gray-500 ml-6 mt-1">
		  Completed on {completedLabel}
		</p>
	  )}

	  <div className="ml-6 mt-2">
		{isEditingNotes ? (
		  <InlineEdit
			type="textarea"
			value={editingNotesText}
			onSave={(val) => onCommitNotes(sub, val)}
			className="w-full border p-1 rounded"
		  />
		) : TaskNote && TaskNote.trim().length > 0 ? (
		  <p
			className="text-sm text-gray-600 cursor-pointer hover:underline"
			onClick={() => {
			  setEditingNotesText(TaskNote);
			  onCommitNotes(sub, TaskNote);
			}}
		  >
			{TaskNote}
		  </p>
		) : (
		  <p
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => {
			  setEditingNotesText("");
			  onCommitNotes(sub, "");
			}}
		  >
			+ Add Notes
		  </p>
		)}
	  </div>
	</li>
  );
}
