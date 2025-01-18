// File: /src/IdeaItem.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import Sortable from "sortablejs";

function IdeaItem({
  idea,
  ideaTasks,
  onTaskCreate,
  onDeleteIdea,
}) {
  const navigate = useNavigate();
  const { IdeaID, IdeaTitle, IdeaSummary } = idea.fields;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(IdeaTitle || "");

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState(IdeaSummary || "");

  const [localTasks, setLocalTasks] = useState(ideaTasks);

  // Inline editing for tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // For creating new top-level tasks (no button, just Enter)
  const [newTaskName, setNewTaskName] = useState("");

  const topLevelRef = useRef(null);
  const sortableRef = useRef(null);

  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  useEffect(() => {
	setLocalTasks(ideaTasks);
  }, [ideaTasks]);

  // Inline-edit for Idea Title
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingTitle(IdeaTitle || "");
  };
  const cancelEditingTitle = () => {
	setIsEditingTitle(false);
	setEditingTitle(IdeaTitle || "");
  };
  const handleTitleKeyDown = (e) => {
	if (e.key === "Enter") commitIdeaTitleChange();
	else if (e.key === "Escape") cancelEditingTitle();
  };
  const commitIdeaTitleChange = async () => {
	const trimmed = editingTitle.trim();
	if (trimmed.toLowerCase() === "xxx") {
	  if (onDeleteIdea) onDeleteIdea(idea);
	  return;
	}
	if (!trimmed) {
	  cancelEditingTitle();
	  return;
	}
	try {
	  idea.fields.IdeaTitle = trimmed;
	  setIsEditingTitle(false);
	  // Optionally patch to Airtable...
	} catch (err) {
	  console.error("Failed to update Idea title:", err);
	  idea.fields.IdeaTitle = IdeaTitle;
	  setIsEditingTitle(false);
	}
  };

  // Inline-edit for Idea Summary
  const startEditingSummary = () => {
	setIsEditingSummary(true);
	setEditingSummary(IdeaSummary || "");
  };
  const cancelEditingSummary = () => {
	setIsEditingSummary(false);
	setEditingSummary(IdeaSummary || "");
  };
  const handleSummaryKeyDown = (e) => {
	if (e.key === "Enter") commitIdeaSummaryChange();
	else if (e.key === "Escape") cancelEditingSummary();
  };
  const commitIdeaSummaryChange = async () => {
	const trimmed = editingSummary.trim();
	if (!trimmed) {
	  cancelEditingSummary();
	  return;
	}
	try {
	  idea.fields.IdeaSummary = trimmed;
	  setIsEditingSummary(false);
	  // Optionally patch...
	} catch (err) {
	  console.error("Failed to update Idea summary:", err);
	  idea.fields.IdeaSummary = IdeaSummary;
	  setIsEditingSummary(false);
	}
  };

  function goToIdeaDetail() {
	navigate(`/ideas/${IdeaID}`);
  }

  // Filter tasks => incomplete
  const incomplete = localTasks.filter((t) => !t.fields.Completed);
  const topLevel = incomplete.filter((t) => !t.fields.ParentTask);
  const subs = incomplete.filter((t) => t.fields.ParentTask);

  // Sort them
  topLevel.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
  subs.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));

  // Sortable
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

  async function handleSortEnd(evt) {
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

	// Optionally patch to Airtable
	if (baseId && apiKey) {
	  try {
		const chunkSize = 10;
		for (let i = 0; i < reordered.length; i += chunkSize) {
		  const slice = reordered.slice(i, i + chunkSize).map((t) => ({
			id: t.id,
			fields: { Order: t.fields.Order },
		  }));
		  const resp = await fetch(
			`https://api.airtable.com/v0/${baseId}/Tasks`,
			{
			  method: "PATCH",
			  headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			  },
			  body: JSON.stringify({ records: slice }),
			}
		  );
		  if (!resp.ok) {
			throw new Error(
			  `Airtable error: ${resp.status} ${resp.statusText}`
			);
		  }
		}
	  } catch (err) {
		console.error("Error updating reorder =>", err);
	  }
	}
  }

  // Inline editing tasks
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
  async function commitTaskEdit(task) {
	const trimmed = editingTaskName.trim();
	if (trimmed.toLowerCase() === "xxx") {
	  deleteTask(task);
	  return;
	}
	if (!trimmed) {
	  cancelEditingTask();
	  return;
	}
	const updated = localTasks.map((t) => {
	  if (t.id === task.id) {
		return { ...t, fields: { ...t.fields, TaskName: trimmed } };
	  }
	  return t;
	});
	setLocalTasks(updated);

	if (baseId && apiKey) {
	  try {
		const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		  method: "PATCH",
		  headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			records: [
			  {
				id: task.id,
				fields: { TaskName: trimmed },
			  },
			],
		  }),
		});
		if (!resp.ok) {
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}
	  } catch (err) {
		console.error("commitTaskEdit =>", err);
		// optionally revert
	  }
	}
	cancelEditingTask();
  }

  async function deleteTask(task) {
	setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));
	if (baseId && apiKey) {
	  try {
		await fetch(`https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`, {
		  method: "DELETE",
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
	  } catch (err) {
		console.error("Failed to delete task =>", err);
	  }
	}
  }

  // Create new top-level task by Enter
  const handleNewTaskKeyDown = (e) => {
	if (e.key === "Enter") {
	  e.preventDefault();
	  const trimmed = newTaskName.trim();
	  if (!trimmed) return;
	  // Create via parent-provided callback
	  onTaskCreate(idea.fields.IdeaID, trimmed);
	  setNewTaskName("");
	}
  };

  return (
	<li className="relative p-2 hover:bg-gray-50 transition flex text-sm">
	  {/* Drag handle for reordering IDEAS in the parent list */}
	  <div
		className="grab-idea-handle flex-shrink-0 mr-3 cursor-grab active:cursor-grabbing text-gray-400"
		title="Drag to reorder Ideas"
	  >
		<Bars3Icon className="h-4 w-4" />
	  </div>

	  <div className="flex-1">
		{/* IDEA Title Row */}
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
			  className="text-base font-bold cursor-pointer"
			  onClick={goToIdeaDetail}
			>
			  {IdeaTitle}
			</h3>
		  )}
		  {!isEditingTitle && (
			<span
			  className="ml-2 text-xs text-blue-600 underline cursor-pointer
						 invisible group-hover:visible"
			  onClick={startEditingTitle}
			>
			  Edit
			</span>
		  )}
		</div>

		{/* IDEA Summary */}
		<div className="mt-1 text-sm">
		  {isEditingSummary ? (
			<textarea
			  rows={2}
			  autoFocus
			  className="border-b border-gray-300 focus:outline-none w-full"
			  value={editingSummary}
			  onChange={(e) => setEditingSummary(e.target.value)}
			  onKeyDown={handleSummaryKeyDown}
			  onBlur={commitIdeaSummaryChange}
			/>
		  ) : (
			<p className="text-gray-600 cursor-pointer" onClick={startEditingSummary}>
			  {IdeaSummary || "(No summary)"}
			</p>
		  )}
		</div>

		{/* TASKS section => top-level + subtasks */}
		<div className="mt-2 pl-3 border-l border-gray-200">
		  <h4 className="font-semibold text-sm">Tasks:</h4>

		  {/* Sortable UL => top-level tasks */}
		  {topLevel.length > 0 ? (
			<ul className="list-none mt-1 pl-0" ref={topLevelRef}>
			  {topLevel.map((parent) => {
				const isEditingParent = editingTaskId === parent.id;

				// gather subtasks
				const childSubs = subs.filter(
				  (s) => s.fields.ParentTask === parent.fields.TaskID
				);

				return (
				  <li key={parent.id} className="bg-white rounded p-1 mb-1">
					{/* Row => drag handle + inline edit for top-level task name */}
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
					  <ul className="ml-4 mt-1 list-none pl-0">
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
								  onChange={(e) => setEditingTaskName(e.target.value)}
								  onBlur={() => commitTaskEdit(sub)}
								  onKeyDown={(e) => {
									if (e.key === "Enter") commitTaskEdit(sub);
									else if (e.key === "Escape") cancelEditingTask();
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

		  {/* Form => create new top-level task by pressing Enter only */}
		  <input
			type="text"
			placeholder="Type a new task and press Enter..."
			value={newTaskName}
			onChange={(e) => setNewTaskName(e.target.value)}
			onKeyDown={handleNewTaskKeyDown}
			className="border rounded px-2 py-1 text-sm mt-2 w-full"
		  />
		  {/* (Button removed) */}
		</div>
	  </div>
	</li>
  );
}

export default IdeaItem;
