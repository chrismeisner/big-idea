// File: src/TaskItem.jsx

import React from "react";
import { Link } from "react-router-dom";
import SubtaskItem from "./SubtaskItem";
import CountdownTimer from "./CountdownTimer";

export default function TaskItem({
  task,
  childTasks,
  subtaskRefs,

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
  createSubtask,

  handlePickMilestone,
  allMilestones,
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

  // find the linked milestone record (to grab its date)
  const milestoneRecord = MilestoneID
	? allMilestones.find((m) => m.fields.MilestoneID === MilestoneID)
	: null;
  // ← CHANGE: pull the correct field name here
  const milestoneDate = milestoneRecord?.fields?.MilestoneTime;

  // countdown component only if we have a date
  const countdown =
	MilestoneID && milestoneDate ? (
	  <CountdownTimer targetDate={milestoneDate} />
	) : null;

  const isEditingTitle = editingTaskId === task.id;
  const isEditingNotes = editingNotesTaskId === task.id;
  const titleClasses = `font-semibold ${
	Completed ? "line-through text-gray-500" : ""
  }`;

  let completedLabel = "";
  if (Completed && CompletedTime) {
	try {
	  completedLabel = new Date(CompletedTime).toLocaleString();
	} catch {
	  completedLabel = "Invalid date";
	}
  }

  const focusEmoji = Focus === "today" ? "☀️" : "💤";

  // milestone row (with link / “edit”)
  let milestoneRow = MilestoneID ? (
	<div className="group mb-1 inline-flex items-center">
	  <p className="text-sm text-blue-700 font-semibold">
		🏔{" "}
		<Link to={`/milestones/${MilestoneID}`} className="underline">
		  {MilestoneName || milestoneRecord?.fields.MilestoneName}
		</Link>
	  </p>
	  <span
		className="
		  ml-2 text-xs text-blue-600 underline cursor-pointer
		  hidden group-hover:inline-block
		"
		onClick={() => handlePickMilestone(task)}
	  >
		Edit
	  </span>
	</div>
  ) : (
	<p
	  className="text-sm text-blue-600 underline mb-1 cursor-pointer"
	  onClick={() => handlePickMilestone(task)}
	>
	  Add Milestone
	</p>
  );

  return (
	<li className="border border-gray-300 rounded p-3">
	  {milestoneRow}

	  {/* ← this is where the timer shows up */}
	  {countdown}

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
		  onClick={() => handleToggleFocus(task)}
		  title="Toggle Focus"
		>
		  {focusEmoji}
		</span>
		<input
		  type="checkbox"
		  checked={!!Completed}
		  onChange={() => handleToggleCompleted(task)}
		/>

		{isEditingTitle ? (
		  <input
			type="text"
			value={editingTaskName}
			onChange={(e) => setEditingTaskName(e.target.value)}
			onBlur={() => commitTaskNameEdit(task)}
			onKeyDown={(e) => {
			  if (e.key === "Enter") commitTaskNameEdit(task);
			  else if (e.key === "Escape") cancelEditingTask();
			}}
			autoFocus
			className="border-b border-gray-300 focus:outline-none"
		  />
		) : (
		  <span
			className={titleClasses}
			onClick={() => startEditingTask(task)}
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
		  <div className="space-y-2">
			<textarea
			  rows={3}
			  className="w-full border p-1 rounded"
			  value={editingNotesText}
			  onChange={(e) => setEditingNotesText(e.target.value)}
			/>
			<div className="flex space-x-2">
			  <button
				onClick={() => commitTaskNoteEdit(task)}
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
		) : TaskNote && TaskNote.trim().length > 0 ? (
		  <p
			className="text-sm text-gray-600 cursor-pointer hover:underline"
			onClick={() => startEditingNotes(task)}
		  >
			{TaskNote}
		  </p>
		) : (
		  <p
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => startEditingNotes(task)}
		  >
			+ Add Notes
		  </p>
		)}
	  </div>

	  {!Completed && (
		<div className="ml-6 mt-1">
		  <span
			className="text-xs text-blue-600 underline cursor-pointer"
			onClick={() => createSubtask(task)}
		  >
			+ Add Subtask
		  </span>
		</div>
	  )}

	  {childTasks.length > 0 && (
		<ul
		  className="mt-2 ml-6 border-l border-gray-200 space-y-2"
		  ref={(el) => (subtaskRefs.current[task.id] = el)}
		>
		  {childTasks.map((sub) => (
			<SubtaskItem
			  key={sub.id}
			  sub={sub}
			  editingTaskId={editingTaskId}
			  editingTaskName={editingTaskName}
			  setEditingTaskName={setEditingTaskName}
			  editingNotesTaskId={editingNotesTaskId}
			  editingNotesText={editingNotesText}
			  setEditingNotesText={setEditingNotesText}
			  startEditingTask={startEditingTask}
			  cancelEditingTask={cancelEditingTask}
			  commitTaskNameEdit={commitTaskNameEdit}
			  startEditingNotes={startEditingNotes}
			  cancelEditingNotes={cancelEditingNotes}
			  commitTaskNoteEdit={commitTaskNoteEdit}
			  handleToggleFocus={handleToggleFocus}
			  handleToggleCompleted={handleToggleCompleted}
			/>
		  ))}
		</ul>
	  )}
	</li>
  );
}
