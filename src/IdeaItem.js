import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import Sortable from "sortablejs";

/**
 * IdeaItem
 *
 * Props:
 * - idea: Airtable Idea record
 * - ideaTasks: array of Task records (for this Idea)
 * - allMilestones: array of Milestone records
 * - onTaskCreate(newTaskName): called to create a top-level task
 * - onPickMilestone(task): open a modal or something to assign a milestone
 * - onDeleteIdea(idea): if user renames the Idea to "xxx"
 *
 * Behavior:
 * - Renders Idea title/summary (inline-editable)
 * - Renders top-level tasks => Sortable by "Order"
 * - Each task or subtask name is clickable => inline editing
 * - If user types "xxx" => that record is deleted from Airtable
 * - If a task has Milestone => clickable link below the name
 * - If no milestone => "+ Add Milestone" below the name
 */
function IdeaItem({
  idea,
  ideaTasks,
  allMilestones,
  onTaskCreate,
  onPickMilestone,
  onDeleteIdea,
}) {
  const navigate = useNavigate();

  // The Idea's fields
  const { IdeaID, IdeaTitle, IdeaSummary } = idea.fields;

  // Inline editing states for the IDEA itself
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(IdeaTitle || "");

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState(IdeaSummary || "");

  // We'll keep tasks in local state so we can reorder or rename them
  const [localTasks, setLocalTasks] = useState(ideaTasks);

  // For inline editing a specific task or subtask
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // For creating new tasks
  const [newTaskName, setNewTaskName] = useState("");

  // Sortable references for top-level tasks
  const topLevelRef = useRef(null);
  const sortableRef = useRef(null);

  // Optional: If we want to PATCH tasks directly from here, read from env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // ─────────────────────────────────────────────────────────
  // 1) Sync localTasks whenever the parent-provided ideaTasks changes
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
	setLocalTasks(ideaTasks);
  }, [ideaTasks]);

  // ─────────────────────────────────────────────────────────
  // 2) IDEA Title => inline editing; "xxx" => delete idea
  // ─────────────────────────────────────────────────────────
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
	  // If user typed "xxx", delete this entire Idea
	  if (onDeleteIdea) onDeleteIdea(idea);
	  return;
	}
	if (!trimmed) {
	  cancelEditingTitle();
	  return;
	}

	try {
	  // Local (optimistic)
	  idea.fields.IdeaTitle = trimmed;
	  setIsEditingTitle(false);

	  // Optionally patch to Airtable ...
	} catch (err) {
	  console.error("Failed to update Idea title:", err);
	  idea.fields.IdeaTitle = IdeaTitle;
	  setIsEditingTitle(false);
	}
  };

  // ─────────────────────────────────────────────────────────
  // 3) IDEA Summary => inline editing
  // ─────────────────────────────────────────────────────────
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

	  // Optionally patch to Airtable ...
	} catch (err) {
	  console.error("Failed to update Idea summary:", err);
	  idea.fields.IdeaSummary = IdeaSummary;
	  setIsEditingSummary(false);
	}
  };

  // ─────────────────────────────────────────────────────────
  // 4) Clicking the Idea title => go to Idea detail
  // ─────────────────────────────────────────────────────────
  function goToIdeaDetail() {
	navigate(`/ideas/${IdeaID}`);
  }

  // ─────────────────────────────────────────────────────────
  // 5) Filter tasks => incomplete only, separate top-level vs sub
  // ─────────────────────────────────────────────────────────
  const incomplete = localTasks.filter((t) => !t.fields.Completed);
  const topLevel = incomplete.filter((t) => !t.fields.ParentTask);
  const subs = incomplete.filter((t) => t.fields.ParentTask);

  // Sort top-level by .Order, subtasks by .SubOrder
  topLevel.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
  subs.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));

  // ─────────────────────────────────────────────────────────
  // 6) Helper => find milestone record for a task
  // ─────────────────────────────────────────────────────────
  function getMilestoneRecord(task) {
	const msId = task.fields.MilestoneID;
	if (!msId) return null;
	return allMilestones.find(
	  (m) => m.id === msId || m.fields.MilestoneID === msId
	);
  }

  // ─────────────────────────────────────────────────────────
  // 7) Enable dragging for top-level tasks => uses Sortable
  // ─────────────────────────────────────────────────────────
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
	// eslint-disable-next-line
  }, [topLevel]);

  async function handleSortEnd(evt) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const reordered = [...topLevel];
	const [moved] = reordered.splice(oldIndex, 1);
	reordered.splice(newIndex, 0, moved);

	// Reassign .Order
	reordered.forEach((task, i) => {
	  task.fields.Order = i + 1; // 1-based
	});

	// combine back with subs + any completed
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
			const eData = await resp.json().catch(() => ({}));
			console.error("[IdeaItem] handleSortEnd =>", eData);
			throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		  }
		}
	  } catch (err) {
		console.error("Error patching new .Order =>", err);
	  }
	}
  }

  // ─────────────────────────────────────────────────────────
  // 8) Inline editing for tasks & subtasks
  // ─────────────────────────────────────────────────────────
  function startEditingTask(task) {
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName || "");
  }

  function cancelEditingTask() {
	setEditingTaskId(null);
	setEditingTaskName("");
  }

  async function commitTaskEdit(task) {
	const trimmed = editingTaskName.trim();
	if (trimmed.toLowerCase() === "xxx") {
	  // "xxx" => delete the task
	  deleteTask(task);
	  return;
	}
	if (!trimmed) {
	  // If empty => revert
	  cancelEditingTask();
	  return;
	}

	// Local
	try {
	  const updated = localTasks.map((t) => {
		if (t.id === task.id) {
		  return {
			...t,
			fields: {
			  ...t.fields,
			  TaskName: trimmed,
			},
		  };
		}
		return t;
	  });
	  setLocalTasks(updated);

	  // Patch to Airtable if credentials present
	  if (baseId && apiKey) {
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
		  const eData = await resp.json().catch(() => ({}));
		  console.error("[IdeaItem] commitTaskEdit =>", eData);
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}
	  }
	} catch (err) {
	  console.error("commitTaskEdit error =>", err);
	  // optionally revert local
	} finally {
	  cancelEditingTask();
	}
  }

  // ─────────────────────────────────────────────────────────
  // 9) Delete a task from local state & Airtable
  // ─────────────────────────────────────────────────────────
  async function deleteTask(task) {
	// local remove
	setLocalTasks((prev) => prev.filter((t) => t.id !== task.id));

	// remove from Airtable if possible
	if (baseId && apiKey) {
	  try {
		const resp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`,
		  { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!resp.ok) {
		  const eData = await resp.json().catch(() => ({}));
		  console.error("[IdeaItem] deleteTask =>", eData);
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}
	  } catch (err) {
		console.error("Failed to delete task =>", err);
		// optionally revert
	  }
	}
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
	<li className="relative p-4 hover:bg-gray-50 transition flex">
	  {/* Drag handle for reordering IDEAS in the parent list */}
	  <div
		className="grab-idea-handle flex-shrink-0 mr-4 cursor-grab active:cursor-grabbing"
		title="Drag to reorder Ideas"
	  >
		<Bars3Icon className="h-5 w-5 text-gray-400" />
	  </div>

	  <div className="flex-1">
		{/* IDEA Title Row */}
		<div className="inline-flex items-center group">
		  {isEditingTitle ? (
			<input
			  autoFocus
			  type="text"
			  className="text-lg font-bold border-b border-gray-300 focus:outline-none"
			  value={editingTitle}
			  onChange={(e) => setEditingTitle(e.target.value)}
			  onKeyDown={handleTitleKeyDown}
			  onBlur={commitIdeaTitleChange}
			/>
		  ) : (
			<h3 className="text-lg font-bold cursor-pointer" onClick={goToIdeaDetail}>
			  {IdeaTitle}
			</h3>
		  )}
		  {!isEditingTitle && (
			<span
			  className="
				ml-2 text-sm text-blue-600 underline
				cursor-pointer invisible group-hover:visible
			  "
			  onClick={startEditingTitle}
			>
			  Edit
			</span>
		  )}
		</div>

		{/* IDEA Summary */}
		<div className="mt-1">
		  {isEditingSummary ? (
			<input
			  autoFocus
			  type="text"
			  className="text-sm border-b border-gray-300 focus:outline-none w-full max-w-md"
			  value={editingSummary}
			  onChange={(e) => setEditingSummary(e.target.value)}
			  onKeyDown={handleSummaryKeyDown}
			  onBlur={commitIdeaSummaryChange}
			/>
		  ) : (
			<p className="text-gray-600 cursor-pointer" onClick={startEditingSummary}>
			  {IdeaSummary}
			</p>
		  )}
		</div>

		{/* TASKS section => top-level + subtasks */}
		<div className="mt-3 pl-4 border-l border-gray-200">
		  <h4 className="font-semibold">Tasks:</h4>

		  {/* Sortable UL => top-level tasks */}
		  {topLevel.length > 0 ? (
			<ul className="list-none mt-2 space-y-2 pl-0" ref={topLevelRef}>
			  {topLevel.map((parent) => {
				const isEditingParent = (editingTaskId === parent.id);
				const milestoneRecord = getMilestoneRecord(parent);

				// gather subtasks
				const childSubs = subs.filter(
				  (s) => s.fields.ParentTask === parent.fields.TaskID
				);

				return (
				  <li key={parent.id} className="bg-white rounded p-2">
					{/* Row => drag handle + inline edit for top-level task name */}
					<div className="flex items-center">
					  <div
						className="drag-parent-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
						title="Drag to reorder tasks"
					  >
						<Bars3Icon className="h-4 w-4" />
					  </div>

					  {isEditingParent ? (
						<input
						  autoFocus
						  type="text"
						  className="border-b border-gray-300 focus:outline-none mr-2"
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
						  className="cursor-pointer mr-2"
						  onClick={() => startEditingTask(parent)}
						>
						  {parent.fields.TaskName || "(Untitled)"}
						</span>
					  )}
					</div>

					{/* Milestone link or "+ Add Milestone" => below the name */}
					{milestoneRecord ? (
					  <div className="ml-6 mt-1">
						<Link
						  to={`/milestones/${milestoneRecord.fields.MilestoneID}`}
						  className="text-sm text-blue-600 underline"
						>
						  {milestoneRecord.fields.MilestoneName}
						</Link>
					  </div>
					) : (
					  <div className="ml-6 mt-1">
						<button
						  className="text-xs text-blue-600 underline"
						  onClick={() => onPickMilestone(parent)}
						>
						  + Add Milestone
						</button>
					  </div>
					)}

					{/* Subtasks => each can be inline-edited */}
					{childSubs.length > 0 && (
					  <ul className="ml-6 mt-2 list-none pl-0 space-y-1">
						{childSubs.map((sub) => {
						  const isEditingSub = (editingTaskId === sub.id);
						  const subMileRec = getMilestoneRecord(sub);

						  return (
							<li key={sub.id}>
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

							  {/* Subtask milestone link below the name */}
							  {subMileRec ? (
								<div className="ml-6 mt-1">
								  <Link
									to={`/milestones/${subMileRec.fields.MilestoneID}`}
									className="text-xs text-blue-600 underline"
								  >
									{subMileRec.fields.MilestoneName}
								  </Link>
								</div>
							  ) : (
								<div className="ml-6 mt-1">
								  <button
									className="text-xs text-blue-600 underline"
									onClick={() => onPickMilestone(sub)}
								  >
									+ Add Milestone
								  </button>
								</div>
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
			<p className="text-sm text-gray-500 mt-1">No incomplete tasks.</p>
		  )}

		  {/* Form => create new top-level task */}
		  <form
			className="mt-2 flex items-center space-x-2"
			onSubmit={(e) => {
			  e.preventDefault();
			  const trimmed = newTaskName.trim();
			  if (!trimmed) return;
			  onTaskCreate(trimmed);
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
