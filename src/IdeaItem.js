// File: /Users/chrismeisner/Projects/big-idea/src/IdeaItem.js

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import Sortable from "sortablejs";

function IdeaItem({
  idea,
  ideaTasks,
  onDeleteIdea,
  onTaskCreate,
  position,
  totalIdeas,
  onReorder,
  // NEW prop => to open "turn into task" modal
  onRequestTurnIntoTask
}) {
  const navigate = useNavigate();
  const { IdeaID, IdeaTitle, IdeaSummary } = idea.fields;

  // Inline editing states for the IDEA (title & summary)...
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(IdeaTitle || "");

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState(IdeaSummary || "");

  // We keep tasks in local state so we can do DnD reordering
  const [localTasks, setLocalTasks] = useState(ideaTasks);

  // For inline editing tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // Creating new tasks with Enter
  const [newTaskName, setNewTaskName] = useState("");

  // Refs for top-level tasks (for Sortable)
  const topLevelRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
	setLocalTasks(ideaTasks);
  }, [ideaTasks]);

  // ---------- IDEA Title Editing ----------
  function startEditingTitle() {
	setIsEditingTitle(true);
	setEditingTitle(IdeaTitle || "");
  }

  function cancelEditingTitle() {
	setIsEditingTitle(false);
	setEditingTitle(IdeaTitle || "");
  }

  function handleTitleKeyDown(e) {
	if (e.key === "Enter") commitIdeaTitleChange();
	else if (e.key === "Escape") cancelEditingTitle();
  }

  function commitIdeaTitleChange() {
	const trimmed = editingTitle.trim();
	// If user typed "xxx" => treat it as a trigger for deleting this Idea
	if (trimmed.toLowerCase() === "xxx") {
	  if (onDeleteIdea) onDeleteIdea(idea);
	  return;
	}
	if (!trimmed) {
	  cancelEditingTitle();
	  return;
	}
	idea.fields.IdeaTitle = trimmed; // local update
	setIsEditingTitle(false);
	// optionally PATCH to Airtable...
  }

  // ---------- IDEA Summary Editing ----------
  function startEditingSummary() {
	setIsEditingSummary(true);
	setEditingSummary(IdeaSummary || "");
  }

  function cancelEditingSummary() {
	setIsEditingSummary(false);
	setEditingSummary(IdeaSummary || "");
  }

  function commitIdeaSummaryChange() {
	const trimmed = editingSummary.trim();
	idea.fields.IdeaSummary = trimmed; // local update
	setIsEditingSummary(false);
	// optionally PATCH to Airtable...
  }

  // ---------- Clicking the Idea Title => go to detail ----------
  function goToIdeaDetail() {
	navigate(`/ideas/${IdeaID}`);
  }

  // ---------- Filter tasks: incomplete top-level + subtasks ----------
  const incomplete = localTasks.filter((t) => !t.fields.Completed);
  const topLevel = incomplete.filter((t) => !t.fields.ParentTask);
  const subs = incomplete.filter((t) => t.fields.ParentTask);

  topLevel.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
  subs.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));

  // Enable DnD for top-level tasks
  useEffect(() => {
	if (topLevel.length > 0 && topLevelRef.current && !sortableRef.current) {
	  sortableRef.current = new Sortable(topLevelRef.current, {
		animation: 150,
		handle: ".drag-parent-handle",
		onEnd: handleSortEnd,
	  });
	}
	return () => {
	  if (sortableRef.current) {
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, [topLevel]);

  function handleSortEnd(evt) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const reordered = [...topLevel];
	const [moved] = reordered.splice(oldIndex, 1);
	reordered.splice(newIndex, 0, moved);

	reordered.forEach((task, i) => {
	  task.fields.Order = i + 1;
	});

	const completed = localTasks.filter((t) => t.fields.Completed);
	const updated = [...reordered, ...subs, ...completed];
	setLocalTasks(updated);

	// optionally PATCH the new .Order to Airtable
  }

  // ---------- Inline editing tasks ----------
  function startEditingTask(task) {
	setEditingTaskId(task.id);
	let name = task.fields.TaskName || "";
	if (name.trim().toLowerCase() === "new subtask...") {
	  name = "";
	}
	setEditingTaskName(name);
  }

  function cancelEditingTask() {
	setEditingTaskId(null);
	setEditingTaskName("");
  }

  function commitTaskEdit(task) {
	const trimmed = editingTaskName.trim();
	if (!trimmed) {
	  cancelEditingTask();
	  return;
	}

	// (Removed the "xxx => delete task" logic here)

	// Otherwise just rename
	const updated = localTasks.map((t) => {
	  if (t.id === task.id) {
		return { ...t, fields: { ...t.fields, TaskName: trimmed } };
	  }
	  return t;
	});
	setLocalTasks(updated);
	// optionally PATCH to Airtable
	cancelEditingTask();
  }

  function deleteTask(task) {
	setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));
	// optionally DELETE from Airtable
  }

  // Create new top-level task (Enter-based)
  function handleNewTaskKeyDown(e) {
	if (e.key === "Enter") {
	  e.preventDefault();
	  const trimmed = newTaskName.trim();
	  if (!trimmed) return;
	  onTaskCreate(trimmed);
	  setNewTaskName("");
	}
  }

  // ---------- REORDER DROPDOWN FOR IDEAS ----------
  const handleReorderChange = (e) => {
	const newPos = parseInt(e.target.value, 10);
	if (newPos === position) return;
	onReorder(idea, newPos);
  };

  // We only show “Turn into a Task” if there are **no tasks** for this idea
  const showTurnIntoTask = ideaTasks.length === 0;

  return (
	<li className="p-4 hover:bg-gray-50 transition">
	  {/* ROW => top bar with (Title & Summary) + reorder dropdown */}
	  <div className="flex items-start justify-between">
		<div className="mr-2 flex-1">
		  {/* IDEA TITLE */}
		  <div className="inline-flex items-center group">
			{isEditingTitle ? (
			  <input
				autoFocus
				type="text"
				className="text-base font-bold border-b border-gray-300 focus:outline-none"
				value={editingTitle}
				onChange={(e) => setEditingTitle(e.target.value)}
				onKeyDown={handleTitleKeyDown}
				onBlur={commitIdeaTitleChange}
			  />
			) : (
			  <h3
				className="text-base font-bold text-blue-600 underline cursor-pointer hover:no-underline"
				onClick={goToIdeaDetail}
			  >
				{IdeaTitle}
			  </h3>
			)}
			{!isEditingTitle && (
			  <span
				className="
				  ml-2 text-xs text-blue-600 underline cursor-pointer
				  invisible group-hover:visible hover:no-underline
				"
				onClick={startEditingTitle}
			  >
				Edit
			  </span>
			)}
		  </div>

		  {/* IDEA SUMMARY */}
		  <div className="mt-1 text-sm">
			{isEditingSummary ? (
			  <div>
				<textarea
				  rows={2}
				  className="border border-gray-300 p-1 w-full"
				  value={editingSummary}
				  onChange={(e) => setEditingSummary(e.target.value)}
				/>
				<div className="flex space-x-2 mt-1">
				  <button
					className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
					onClick={commitIdeaSummaryChange}
				  >
					Save
				  </button>
				  <button
					className="text-xs bg-gray-300 px-2 py-1 rounded"
					onClick={cancelEditingSummary}
				  >
					Cancel
				  </button>
				</div>
			  </div>
			) : (
			  <p
				className="text-gray-600 cursor-pointer"
				onClick={startEditingSummary}
			  >
				{IdeaSummary && IdeaSummary.trim().length > 0
				  ? IdeaSummary
				  : "(No summary)"}
			  </p>
			)}
		  </div>
		</div>

		{/* Reorder Dropdown */}
		<div className="ml-4 flex items-center">
		  <label className="mr-2 text-sm text-gray-600">Order:</label>
		  <select
			className="border border-gray-300 rounded px-1 py-0.5 text-sm"
			value={position}
			onChange={handleReorderChange}
		  >
			{Array.from({ length: totalIdeas }, (_, i) => i + 1).map((pos) => (
			  <option key={pos} value={pos}>
				{pos}
			  </option>
			))}
		  </select>
		</div>
	  </div>

	  {/* TASKS => keep drag-and-drop for top-level tasks */}
	  <div className="mt-3 pl-4 border-l border-gray-200">
		<h4 className="font-semibold text-sm">Tasks:</h4>

		{topLevel.length > 0 ? (
		  <ul className="list-none mt-1 pl-0" ref={topLevelRef}>
			{topLevel.map((parent) => {
			  const isEditingParent = editingTaskId === parent.id;
			  const childSubs = subs.filter(
				(s) => s.fields.ParentTask === parent.fields.TaskID
			  );

			  return (
				<li key={parent.id} className="bg-white rounded p-1 mb-1">
				  {/* Row => drag handle + inline edit */}
				  <div className="flex items-center">
					<div
					  className="drag-parent-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
					  title="Drag to reorder tasks"
					>
					  <Bars3Icon className="h-3 w-3" />
					</div>

					{isEditingParent ? (
					  <input
						autoFocus
						type="text"
						className="border-b border-gray-300 focus:outline-none mr-2 text-sm"
						value={editingTaskName}
						onChange={(e) => setEditingTaskName(e.target.value)}
						onBlur={() => commitTaskEdit(parent)}
						onKeyDown={(e) => {
						  if (e.key === "Enter") commitTaskEdit(parent);
						  else if (e.key === "Escape") cancelEditingTask();
						}}
					  />
					) : (
					  <span
						className="cursor-pointer mr-2 text-sm"
						onClick={() => startEditingTask(parent)}
					  >
						{parent.fields.TaskName || "(Untitled)"}
					  </span>
					)}
				  </div>

				  {/* Subtasks */}
				  {childSubs.length > 0 && (
					<ul className="ml-6 mt-1 list-disc list-inside">
					  {childSubs.map((sub) => {
						const isEditingSub = editingTaskId === sub.id;
						return (
						  <li key={sub.id} className="py-1 text-sm">
							{isEditingSub ? (
							  <input
								autoFocus
								type="text"
								className="border-b border-gray-300 focus:outline-none mr-2"
								value={editingTaskName}
								onChange={(e) =>
								  setEditingTaskName(e.target.value)
								}
								onBlur={() => commitTaskEdit(sub)}
								onKeyDown={(e) => {
								  if (e.key === "Enter") commitTaskEdit(sub);
								  else if (e.key === "Escape")
									cancelEditingTask();
								}}
							  />
							) : (
							  <span
								className="cursor-pointer mr-2"
								onClick={() => startEditingTask(sub)}
							  >
								{sub.fields.TaskName || "(Untitled Subtask)"}
							  </span>
							)}
						  </li>
						);
					  })}
					</ul>
				  )}
				</li>
			  );
			})}
		  </ul>
		) : (
		  <p className="text-xs text-gray-500 mt-1">No incomplete tasks.</p>
		)}

		{/* Create new top-level task => press Enter */}
		<input
		  type="text"
		  placeholder="New task (press Enter)"
		  value={newTaskName}
		  onChange={(e) => setNewTaskName(e.target.value)}
		  onKeyDown={handleNewTaskKeyDown}
		  className="border rounded px-2 py-1 text-sm mt-2 w-full"
		/>
	  </div>

	  {/* If no tasks => show "Turn this Idea into a Task" link */}
	  {showTurnIntoTask && (
		<p
		  className="text-sm text-blue-600 underline cursor-pointer mt-2"
		  onClick={() => onRequestTurnIntoTask(idea)}
		>
		  Turn this Idea into a Task
		</p>
	  )}
	</li>
  );
}

export default IdeaItem;
