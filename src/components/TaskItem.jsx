// File: src/components/TaskItem.jsx

import React from "react";
import { Link } from "react-router-dom";
import InlineEdit from "./InlineEdit";
import Countdown from "./Countdown";
import MilestoneRow from "./MilestoneRow";
import SubtaskList from "./SubtaskList";

export default function TaskItem({
  task,
  allMilestones,
  editingTaskId,
  editingTaskName,
  setEditingTaskName,
  editingNotesTaskId,
  editingNotesText,
  setEditingNotesText,
  onToggleCompleted,
  onToggleFocus,
  onPickMilestone,
  onRemoveMilestone,
  onCommitName,
  onCommitNotes,
  onCreateSubtask,
  children,
}) {
  const {
	TaskName,
	TaskNote,
	Completed,
	CompletedTime,
	Focus,
	TaskID,
	MilestoneID,
	MilestoneName,
  } = task.fields;

  const isEditingTitle = editingTaskId === task.id;
  const isEditingNotes = editingNotesTaskId === task.id;
  const titleClasses = `font-semibold ${
	Completed ? "line-through text-gray-500" : ""
  }`;

  let completedLabel = "";
  if (Completed && CompletedTime) {
	try {
	  completedLabel = new Date(CompletedTime).toLocaleString();
	} catch {}
  }
  const focusEmoji = Focus === "today" ? "☀️" : "💤";

  return (
	<li key={task.id} className="border border-gray-300 rounded p-3">
	  <MilestoneRow
		MilestoneID={MilestoneID}
		MilestoneName={MilestoneName}
		allMilestones={allMilestones}
		onPick={() => onPickMilestone(task)}
		onRemove={() => onRemoveMilestone(task)}
	  />

	  <div className="flex items-center gap-2">
		{!Completed && (
		  <div
			className="drag-handle text-gray-400 cursor-grab active:cursor-grabbing"
			title="Drag to reorder"
		  >
			⇅
		  </div>
		)}
		<span
		  className="cursor-pointer"
		  onClick={() => onToggleFocus(task)}
		  title="Toggle Focus"
		>
		  {focusEmoji}
		</span>
		<input
		  type="checkbox"
		  checked={!!Completed}
		  onChange={() => onToggleCompleted(task)}
		/>

		{isEditingTitle ? (
		  <InlineEdit
			value={editingTaskName}
			onSave={(val) => onCommitName(task, val)}
			className="border-b border-gray-300 focus:outline-none"
		  />
		) : (
		  <span
			className={titleClasses}
			onClick={() => {
			  setEditingTaskName(TaskName || "");
			  onCommitName(task, TaskName);
			}}
		  >
			{TaskName || "Untitled Task"}
		  </span>
		)}
	  </div>

	  {Completed && completedLabel && (
		<p className="ml-6 mt-1 text-xs text-gray-500">
		  Completed on {completedLabel}
		</p>
	  )}

	  <div className="ml-6 mt-2">
		{isEditingNotes ? (
		  <InlineEdit
			type="textarea"
			value={editingNotesText}
			onSave={(val) => onCommitNotes(task, val)}
			className="w-full border p-1 rounded"
		  />
		) : TaskNote && TaskNote.trim().length > 0 ? (
		  <p
			className="text-sm text-gray-600 cursor-pointer hover:underline"
			onClick={() => {
			  setEditingNotesText(TaskNote);
			  onCommitNotes(task, TaskNote);
			}}
		  >
			{TaskNote}
		  </p>
		) : (
		  <p
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => {
			  setEditingNotesText("");
			  onCommitNotes(task, "");
			}}
		  >
			+ Add Notes
		  </p>
		)}
	  </div>

	  {!Completed && (
		<div className="ml-6 mt-1">
		  <span
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => onCreateSubtask(task)}
		  >
			+ Add Subtask
		  </span>
		</div>
	  )}

	  {children}
	</li>
  );
}
