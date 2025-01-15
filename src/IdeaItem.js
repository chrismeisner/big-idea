// File: /src/IdeaItem.js

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";

/**
 * IdeaItem - We link to /ideas/:customIdeaId,
 * using idea.fields.IdeaID, not the Airtable rec ID.
 */
function IdeaItem({
  idea,
  ideaTasks,         // tasks filtered for this Idea (passed from IdeaList)
  ideaMilestones,    // milestones rolled up for this Idea (via tasks’ TaskID)
  isHovered,
  isConfirming,
  onHoverEnter,
  onHoverLeave,
  onDeleteClick,
  onTaskCreate,
}) {
  const [newTaskName, setNewTaskName] = useState("");

  // For editing the Idea Title inline
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(idea.fields.IdeaTitle);

  // The custom ID formula field from Airtable, e.g. "o0bwzsFdnLfR75"
  const ideaCustomId = idea.fields.IdeaID;

  // Start editing the idea title
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

  // Patch the Idea title in Airtable
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
			id: recordId, // Airtable rec ID (not the custom idea ID)
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

  // Show incomplete tasks count or list
  const incompleteTasks = ideaTasks.filter((t) => !t.fields.Completed);

  // For drag handle events (Sortables in IdeaList/parent)
  const handleDragStart = () => {
	console.log(`Drag started for Idea custom ID: ${ideaCustomId}`);
  };

  return (
	<li
	  onMouseEnter={onHoverEnter}
	  onMouseLeave={onHoverLeave}
	  className="relative p-4 hover:bg-gray-50 transition flex"
	>
	  {/* Sortable handle */}
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

		  {/* Delete button (on hover) */}
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

		{/* Tasks section */}
		<div className="mt-3 pl-4 border-l border-gray-200">
		  <h4 className="font-semibold">Tasks:</h4>
		  {incompleteTasks.length > 0 ? (
			<ul className="list-disc list-inside">
			  {incompleteTasks.map((task) => (
				<li key={task.id}>{task.fields.TaskName}</li>
			  ))}
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

		{/* Milestones section */}
		<div className="mt-3 pl-4 border-l border-gray-200">
		  <h4 className="font-semibold">Milestones:</h4>
		  {ideaMilestones.length > 0 ? (
			<ul className="list-disc list-inside">
			  {ideaMilestones.map((m) => (
				<li key={m.id}>{m.fields.MilestoneName}</li>
			  ))}
			</ul>
		  ) : (
			<p className="text-sm text-gray-500">No milestones yet.</p>
		  )}
		</div>
	  </div>
	</li>
  );
}

export default IdeaItem;
