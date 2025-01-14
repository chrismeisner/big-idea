// File: /src/IdeaItem.js

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";

function IdeaItem({
  idea,
  ideaTasks,
  isHovered,
  isConfirming,
  onHoverEnter,
  onHoverLeave,
  onDeleteClick,
  onTaskCreate,
}) {
  const [newTaskName, setNewTaskName] = useState("");

  // Inline editing states for the Idea Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(idea.fields.IdeaTitle);

  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Start editing the idea title
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingTitle(idea.fields.IdeaTitle);
  };

  // Cancel editing
  const cancelEditingTitle = () => {
	setIsEditingTitle(false);
	setEditingTitle(idea.fields.IdeaTitle);
  };

  // Save changes to Airtable
  const handleTitleSave = async () => {
	if (editingTitle.trim() === "") {
	  // If user cleared the title, revert or handle otherwise
	  cancelEditingTitle();
	  return;
	}
	try {
	  // Update local object (immediate feedback)
	  idea.fields.IdeaTitle = editingTitle;

	  // Send PATCH request to Airtable
	  await patchIdeaTitleInAirtable(idea.id, editingTitle);

	  // Exit editing mode
	  setIsEditingTitle(false);
	} catch (err) {
	  console.error("Failed to update idea title:", err);
	  alert("Failed to update idea title. Please try again.");
	  // Revert changes
	  cancelEditingTitle();
	}
  };

  const patchIdeaTitleInAirtable = async (recordId, updatedTitle) => {
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

  // Let Sortable handle drag; just log the event
  const handleDragStart = () => {
	console.log(`Drag started for Idea ID: ${idea.id}`);
  };

  // Filter tasks to only show incomplete
  const incompleteTasks = ideaTasks.filter((t) => !t.fields.Completed);

  return (
	<li
	  onMouseEnter={onHoverEnter}
	  onMouseLeave={onHoverLeave}
	  className="relative p-4 hover:bg-gray-50 transition flex"
	>
	  {/* DRAG HANDLE */}
	  <div
		className="grab-idea-handle flex-shrink-0 mr-4 cursor-grab active:cursor-grabbing"
		onMouseDown={handleDragStart}
		onTouchStart={handleDragStart}
		title="Drag to reorder"
	  >
		<Bars3Icon className="h-5 w-5 text-gray-400" />
	  </div>

	  <div className="flex-1">
		{/* Title / Delete */}
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

		{/* Link to details */}
		<Link
		  to={`/ideas/${idea.id}`}
		  className="mt-2 text-blue-600 hover:text-blue-800 underline inline-block"
		>
		  View details
		</Link>

		{/* Tasks Section */}
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
	  </div>
	</li>
  );
}

export default IdeaItem;
