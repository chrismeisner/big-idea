import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";

function IdeaItem({ idea, ideaTasks, allMilestones, onTaskCreate, onPickMilestone }) {
  const navigate = useNavigate();

  const { IdeaID, IdeaTitle, IdeaSummary } = idea.fields;

  // Title inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(IdeaTitle || "");

  // Summary inline editing
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState(IdeaSummary || "");

  // new tasks
  const [newTaskName, setNewTaskName] = useState("");

  // ----------
  // Title Edit
  // ----------
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingTitle(IdeaTitle || "");
  };

  const cancelEditingTitle = () => {
	setIsEditingTitle(false);
	setEditingTitle(IdeaTitle || "");
  };

  const handleTitleKeyDown = async (e) => {
	if (e.key === "Enter") {
	  await commitTitleChanges();
	} else if (e.key === "Escape") {
	  cancelEditingTitle();
	}
  };

  const commitTitleChanges = async () => {
	const trimmed = editingTitle.trim();

	if (trimmed.toLowerCase() === "xxx") {
	  // DELETE logic if user typed "xxx"
	  console.log("Deleting idea since user typed 'xxx'...");
	  // ...
	  return;
	}

	if (!trimmed) {
	  // If empty, revert or handle differently
	  cancelEditingTitle();
	  return;
	}

	try {
	  // Update local
	  idea.fields.IdeaTitle = trimmed;
	  // Patch to Airtable/DB
	  // ...
	} catch (err) {
	  console.error("Failed to update idea title:", err);
	  // revert local
	  idea.fields.IdeaTitle = IdeaTitle;
	} finally {
	  setIsEditingTitle(false);
	}
  };

  // ----------
  // Summary Edit
  // ----------
  const startEditingSummary = () => {
	setIsEditingSummary(true);
	setEditingSummary(IdeaSummary || "");
  };

  const cancelEditingSummary = () => {
	setIsEditingSummary(false);
	setEditingSummary(IdeaSummary || "");
  };

  const handleSummaryKeyDown = async (e) => {
	if (e.key === "Enter") {
	  await commitSummaryChanges();
	} else if (e.key === "Escape") {
	  cancelEditingSummary();
	}
  };

  const commitSummaryChanges = async () => {
	const trimmed = editingSummary.trim();
	if (!trimmed) {
	  cancelEditingSummary();
	  return;
	}
	try {
	  // update local
	  idea.fields.IdeaSummary = trimmed;
	  // patch to Airtable/DB
	  // ...
	} catch (err) {
	  console.error("Failed to update idea summary:", err);
	  idea.fields.IdeaSummary = IdeaSummary;
	} finally {
	  setIsEditingSummary(false);
	}
  };

  // Click title => navigate
  const goToIdeaDetail = () => {
	navigate(`/ideas/${IdeaID}`);
  };

  return (
	<li className="relative p-4 hover:bg-gray-50 transition flex">
	  {/* Sortable handle */}
	  <div
		className="grab-idea-handle flex-shrink-0 mr-4 cursor-grab active:cursor-grabbing"
		title="Drag to reorder"
	  >
		<Bars3Icon className="h-5 w-5 text-gray-400" />
	  </div>

	  {/* Main content */}
	  <div className="flex-1">
		{/* Title row => inline-flex group */}
		<div className="inline-flex items-center group">
		  {isEditingTitle ? (
			<input
			  autoFocus
			  type="text"
			  className="text-lg font-bold border-b border-gray-300 focus:outline-none"
			  value={editingTitle}
			  onChange={(e) => setEditingTitle(e.target.value)}
			  onKeyDown={handleTitleKeyDown}
			  onBlur={commitTitleChanges}
			/>
		  ) : (
			<h3
			  className="text-lg font-bold cursor-pointer"
			  onClick={goToIdeaDetail}
			>
			  {IdeaTitle}
			</h3>
		  )}

		  {/* “Edit” link => invisible until hover */}
		  {!isEditingTitle && (
			<span
			  className="
				ml-2
				text-sm
				text-blue-600
				underline
				cursor-pointer
				invisible 
				group-hover:visible
			  "
			  onClick={startEditingTitle}
			>
			  Edit
			</span>
		  )}
		</div>

		{/* Summary (click to edit) */}
		<div className="mt-1">
		  {isEditingSummary ? (
			<input
			  autoFocus
			  type="text"
			  className="text-sm border-b border-gray-300 focus:outline-none w-full max-w-md"
			  value={editingSummary}
			  onChange={(e) => setEditingSummary(e.target.value)}
			  onKeyDown={handleSummaryKeyDown}
			  onBlur={commitSummaryChanges}
			/>
		  ) : (
			<p
			  className="text-gray-600 cursor-pointer"
			  onClick={startEditingSummary}
			>
			  {IdeaSummary}
			</p>
		  )}
		</div>

		{/* Tasks Section */}
		<div className="mt-3 pl-4 border-l border-gray-200">
		  <h4 className="font-semibold">Tasks:</h4>

		  {ideaTasks.length > 0 ? (
			<ul className="list-disc list-inside">
			  {ideaTasks.map((task) => {
				const taskName = task.fields.TaskName || "Untitled Task";
				const milestone = allMilestones.find(
				  (m) => m.id === task.fields.MilestoneID
				);
				const milestoneName = milestone?.fields?.MilestoneName || "";
				const isCompleted = task.fields.Completed;

				return (
				  <li key={task.id} className="mb-1">
					{isCompleted ? (
					  <span className="line-through text-gray-500">
						{taskName}
					  </span>
					) : (
					  <span>{taskName}</span>
					)}
					{milestoneName ? (
					  <em className="ml-2 text-sm text-blue-600">
						— {milestoneName}
					  </em>
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

		  {/* Add new task form */}
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
