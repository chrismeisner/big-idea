// File: /src/IdeaItem.js

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";

/**
 * IdeaItem - Displays one Idea “card” with tasks + the single milestone for each task.
 *
 * Props:
 * - idea: The Airtable Idea record.
 * - ideaTasks: The tasks belonging to this Idea (an array).
 * - allMilestones: Array of all Milestone records (e.g. from your fetch).
 * - isHovered, isConfirming: For hover & delete UX.
 * - onHoverEnter, onHoverLeave, onDeleteClick: For hover & delete logic.
 * - onTaskCreate: Callback to create a new Task.
 * - onPickMilestone: A function that (for example) opens a modal to pick a milestone.
 */
function IdeaItem({
  idea,
  ideaTasks,
  allMilestones,
  isHovered,
  isConfirming,
  onHoverEnter,
  onHoverLeave,
  onDeleteClick,
  onTaskCreate,
  onPickMilestone,
}) {
  const [newTaskName, setNewTaskName] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(idea.fields.IdeaTitle);

  // — NEW: Task editing logic —
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // The custom ID formula field from Airtable, e.g. "o0bwzsFdnLfR75"
  const ideaCustomId = idea.fields.IdeaID;

  // --------------------------------------------------------------------------
  // Inline editing for Idea Title
  // --------------------------------------------------------------------------
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingTitle(idea.fields.IdeaTitle);
  };

  const cancelEditingTitle = () => {
	setIsEditingTitle(false);
	setEditingTitle(idea.fields.IdeaTitle);
  };

  const handleTitleSave = async () => {
	if (editingTitle.trim() === "") {
	  cancelEditingTitle();
	  return;
	}
	try {
	  // Optimistic update
	  idea.fields.IdeaTitle = editingTitle;
	  await patchIdeaTitle(idea.id, editingTitle);
	  setIsEditingTitle(false);
	} catch (err) {
	  console.error("Failed to update idea title:", err);
	  alert("Failed to update idea title. Please try again.");
	  cancelEditingTitle();
	}
  };

  const patchIdeaTitle = async (recordId, updatedTitle) => {
	const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
	const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}

	const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
	  method: "PATCH",
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({
		records: [
		  {
			id: recordId,
			fields: {
			  IdeaTitle: updatedTitle,
			},
		  },
		],
	  }),
	});
	if (!resp.ok) {
	  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	}
  };

  // --------------------------------------------------------------------------
  // — NEW: Inline editing for Task
  // --------------------------------------------------------------------------
  const handleTaskClick = (task) => {
	// Set this task as "editing"
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName || "");
  };

  const cancelEditingTask = () => {
	setEditingTaskId(null);
	setEditingTaskName("");
  };

  const handleTaskNameSave = async (taskId) => {
	if (editingTaskName.trim() === "") {
	  // If empty, let's just revert (or you could delete).
	  cancelEditingTask();
	  return;
	}
	try {
	  await patchTaskName(taskId, editingTaskName);
	  // Optimistic update in local array:
	  const tIndex = ideaTasks.findIndex((t) => t.id === taskId);
	  if (tIndex >= 0) {
		ideaTasks[tIndex].fields.TaskName = editingTaskName;
	  }
	  setEditingTaskId(null);
	  setEditingTaskName("");
	} catch (err) {
	  console.error("Failed to update task name:", err);
	  alert("Failed to update task name. Please try again.");
	  cancelEditingTask();
	}
  };

  const patchTaskName = async (recordId, newName) => {
	const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
	const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}

	const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
	  method: "PATCH",
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({
		records: [
		  {
			id: recordId,
			fields: {
			  TaskName: newName,
			},
		  },
		],
	  }),
	});
	if (!resp.ok) {
	  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	}
  };

  // --------------------------------------------------------------------------
  // Check for incomplete tasks
  // --------------------------------------------------------------------------
  const incompleteTasks = ideaTasks.filter((t) => !t.fields.Completed);

  // --------------------------------------------------------------------------
  // A helper to find the milestone record for a given Task
  // --------------------------------------------------------------------------
  const getTaskMilestone = (task) => {
	if (!task.fields.MilestoneID) return null;
	return allMilestones.find((m) => m.id === task.fields.MilestoneID) || null;
  };

  // --------------------------------------------------------------------------
  // Drag handle (Sortables in parent component)
  // --------------------------------------------------------------------------
  const handleDragStart = () => {
	console.log(`Drag started for Idea custom ID: ${ideaCustomId}`);
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
	<li
	  onMouseEnter={onHoverEnter}
	  onMouseLeave={onHoverLeave}
	  className="relative p-4 hover:bg-gray-50 transition flex"
	>
	  {/* Sortable handle for reordering ideas */}
	  <div
		className="grab-idea-handle flex-shrink-0 mr-4 cursor-grab active:cursor-grabbing"
		onMouseDown={handleDragStart}
		onTouchStart={handleDragStart}
		title="Drag to reorder"
	  >
		<Bars3Icon className="h-5 w-5 text-gray-400" />
	  </div>

	  <div className="flex-1">
		{/* Title & summary */}
		<div className="flex justify-between items-start">
		  <div>
			{isEditingTitle ? (
			  <input
				autoFocus
				type="text"
				className="text-lg font-bold border-b border-gray-300 focus:outline-none"
				value={editingTitle}
				onChange={(e) => setEditingTitle(e.target.value)}
				onBlur={handleTitleSave}
				onKeyDown={(e) => {
				  if (e.key === "Enter") handleTitleSave();
				  if (e.key === "Escape") cancelEditingTitle();
				}}
			  />
			) : (
			  <h3
				className="text-lg font-bold cursor-pointer"
				onClick={startEditingTitle}
			  >
				{idea.fields.IdeaTitle}
			  </h3>
			)}
			<p className="text-gray-600 mt-1">{idea.fields.IdeaSummary}</p>
		  </div>

		  {/** Delete button (on hover) */}
		  {isHovered && (
			<button
			  onClick={onDeleteClick}
			  className={`text-sm py-1 px-2 rounded ${
				isConfirming
				  ? "bg-red-700 hover:bg-red-800"
				  : "bg-red-500 hover:bg-red-600"
			  } text-white transition`}
			>
			  {isConfirming ? "Really?" : "Delete"}
			</button>
		  )}
		</div>

		{/* Link to /ideas/:customIdeaId */}
		<Link
		  to={`/ideas/${ideaCustomId}`}
		  className="mt-2 text-blue-600 hover:text-blue-800 underline inline-block"
		>
		  View details
		</Link>

		{/* Tasks Section */}
		<div className="mt-3 pl-4 border-l border-gray-200">
		  <h4 className="font-semibold">Tasks:</h4>

		  {incompleteTasks.length > 0 ? (
			<ul className="list-disc list-inside">
			  {incompleteTasks.map((task) => {
				const milestone = getTaskMilestone(task);
				const isEditingThisTask = editingTaskId === task.id;

				return (
				  <li key={task.id} className="mb-1">
					{isEditingThisTask ? (
					  <>
						{/* Edit mode */}
						<input
						  autoFocus
						  className="border-b border-gray-300 focus:outline-none"
						  value={editingTaskName}
						  onChange={(e) => setEditingTaskName(e.target.value)}
						  onBlur={() => handleTaskNameSave(task.id)}
						  onKeyDown={(e) => {
							if (e.key === "Enter") handleTaskNameSave(task.id);
							if (e.key === "Escape") cancelEditingTask();
						  }}
						/>
					  </>
					) : (
					  <>
						{/* Read mode */}
						<span
						  className="cursor-pointer"
						  onClick={() => handleTaskClick(task)}
						>
						  {task.fields.TaskName}
						</span>
					  </>
					)}
					{/* If there's a milestone, display it. Otherwise, a button to add. */}
					{milestone ? (
					  <>
						{" "}
						— <em className="text-sm text-blue-600">
						  {milestone.fields.MilestoneName}
						</em>
					  </>
					) : (
					  <button
						className="ml-2 text-xs text-blue-600 underline"
						onClick={() => onPickMilestone(task)}
					  >
						+ Add Milestone
					  </button>
					)}
				  </li>
				);
			  })}
			</ul>
		  ) : (
			<p className="text-sm text-gray-500">No incomplete tasks.</p>
		  )}

		  {/* Add New Task Form */}
		  <form
			className="mt-2 flex items-center space-x-2"
			onSubmit={(e) => {
			  e.preventDefault();
			  if (!newTaskName.trim()) return;
			  onTaskCreate(newTaskName);
			  setNewTaskName("");
			}}
		  >
			<input
			  type="text"
			  placeholder="New task..."
			  value={newTaskName}
			  onChange={(e) => setNewTaskName(e.target.value)}
			  className="border rounded px-2 py-1 flex-1"
			  required
			/>
			<button
			  type="submit"
			  className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
			>
			  Add Task
			</button>
		  </form>
		</div>
	  </div>
	</li>
  );
}

export default IdeaItem;
