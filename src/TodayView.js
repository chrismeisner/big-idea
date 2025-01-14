// File: /src/TodayView.js

import React, { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";
import Sortable from "sortablejs";

function TodayView() {
  // 1) State for tasks and ideas
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2) Inline editing states for tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // 3) Refs for Sortable
  //    - `ideasListRef` for the top-level list of ideas
  //    - `listsRefs` for each Idea’s tasks
  const ideasListRef = useRef(null);
  const listsRefs = useRef({});

  // 4) Track if we’ve initialized Sortable for ideas + tasks
  const ideasSortableRef = useRef(null);
  const tasksSortableRefs = useRef({});

  // 5) Env credentials
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // A) Fetch tasks + ideas
  // --------------------------------------------------------------------------
  useEffect(() => {
	const fetchData = async () => {
	  if (!baseId || !apiKey) {
		setError("Missing Airtable credentials.");
		setLoading(false);
		return;
	  }

	  try {
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  setError("No logged-in user.");
		  setLoading(false);
		  return;
		}

		setLoading(true);

		// 1) Fetch tasks with Today = true, sorted by Order ascending
		const tasksUrl = `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula=%7BToday%7D%3D1&sort%5B0%5D%5Bfield%5D=Order&sort%5B0%5D%5Bdirection%5D=asc`;
		const tasksResp = await fetch(tasksUrl, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		});
		if (!tasksResp.ok) {
		  throw new Error(`Tasks error: ${tasksResp.status} ${tasksResp.statusText}`);
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// 2) Fetch all Ideas, sorted by Order ascending
		const ideasUrl = `https://api.airtable.com/v0/${baseId}/Ideas?sort%5B0%5D%5Bfield%5D=Order&sort%5B0%5D%5Bdirection%5D=asc`;
		const ideasResp = await fetch(ideasUrl, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		});
		if (!ideasResp.ok) {
		  throw new Error(`Ideas error: ${ideasResp.status} ${ideasResp.statusText}`);
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);
	  } catch (err) {
		console.error("Failed to fetch tasks or ideas:", err);
		setError("Failed to load today's tasks. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey]);

  // --------------------------------------------------------------------------
  // B) Sortable for the top-level list of Ideas
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (loading) return;
	if (!ideasListRef.current) return; // no container
	if (!ideasSortableRef.current) {
	  // Initialize Sortable on the Ideas container
	  ideasSortableRef.current = new Sortable(ideasListRef.current, {
		animation: 150,
		handle: ".idea-drag-handle", // We'll add a handle next to the Idea title
		onEnd: handleIdeasSortEnd,
	  });
	}
	// Cleanup
	return () => {
	  if (ideasSortableRef.current) {
		ideasSortableRef.current.destroy();
		ideasSortableRef.current = null;
	  }
	};
  }, [loading, ideas]);

  // Called when user finishes dragging an Idea to reorder
  const handleIdeasSortEnd = (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// 1) Filter the ideas to only those that appear on Today
	//    i.e. "ideasInView" are the ones that have at least 1 'Today' task
	const ideasInView = getIdeasInView();
	const updated = [...ideasInView];
	const [movedIdea] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, movedIdea);

	// 2) Reassign their Order fields
	updated.forEach((idea, idx) => {
	  idea.fields.Order = idx + 1;
	});

	// 3) Merge back with any ideas NOT in the view
	const otherIdeas = ideas.filter((i) => !ideasInView.includes(i));
	const reordered = [...updated, ...otherIdeas];

	setIdeas(reordered);

	// 4) Update Airtable
	updateIdeasOrderInAirtable(updated).catch((err) => {
	  console.error("Failed to update Ideas order in Airtable:", err);
	  setError("Failed to reorder ideas. Please try again.");
	});
  };

  // Helper: If you only want to reorder the ideas that appear on "Today" (i.e. that have tasks)
  const getIdeasInView = () => {
	const tasksByIdea = groupTasksByIdea(tasks);
	const ideaIdsInView = Object.keys(tasksByIdea); // only those with tasks
	const filtered = ideas.filter((i) => ideaIdsInView.includes(i.id));
	return filtered;
  };

  // Airtable patch for ideas order
  const updateIdeasOrderInAirtable = async (list) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder update (Ideas)");
	}
	// list is only the subset of ideas we reordered
	const recordsToUpdate = list.map((idea) => ({
	  id: idea.id,
	  fields: {
		Order: idea.fields.Order,
	  },
	}));

	// If more than 10, chunk them
	const chunkSize = 10;
	for (let i = 0; i < recordsToUpdate.length; i += chunkSize) {
	  const chunk = recordsToUpdate.slice(i, i + chunkSize);

	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({ records: chunk }),
	  });

	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // C) Sortable for tasks within each Idea
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (loading || tasks.length === 0) return;

	const tasksByIdea = groupTasksByIdea(tasks);

	// For each idea => attach Sortable to that list if not yet attached
	Object.keys(tasksByIdea).forEach((ideaId) => {
	  const refEl = listsRefs.current[ideaId]?.current;
	  if (refEl && !tasksSortableRefs.current[ideaId]) {
		const sortable = new Sortable(refEl, {
		  animation: 150,
		  handle: ".task-drag-handle",
		  onEnd: (evt) => handleTasksSortEnd(evt, ideaId),
		});
		tasksSortableRefs.current[ideaId] = sortable;
	  }
	});

	// Cleanup if unmount
	return () => {
	  Object.values(tasksSortableRefs.current).forEach((instance) => {
		if (instance) instance.destroy();
	  });
	  tasksSortableRefs.current = {};
	};
  }, [loading, tasks]);

  const handleTasksSortEnd = (evt, ideaId) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// 1) Get tasks for that Idea
	const tasksForIdea = tasks
	  .filter((t) => t.fields.IdeaID === ideaId)
	  .sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));

	// 2) Reorder them locally
	const updated = [...tasksForIdea];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// 3) Reassign new Order
	updated.forEach((task, idx) => {
	  task.fields.Order = idx + 1;
	});

	// 4) Merge with the other tasks
	const otherTasks = tasks.filter((t) => t.fields.IdeaID !== ideaId);
	const reorderedTasks = [...otherTasks, ...updated];
	setTasks(reorderedTasks);

	// 5) Update in Airtable
	updateTasksOrderInAirtable(updated).catch((err) => {
	  console.error("Failed to update tasks order in Airtable:", err);
	  setError("Failed to reorder tasks. Please try again.");
	});
  };

  const updateTasksOrderInAirtable = async (list) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder update (Tasks)");
	}
	const recordsToUpdate = list.map((task) => ({
	  id: task.id,
	  fields: {
		Order: task.fields.Order,
	  },
	}));

	const chunkSize = 10;
	for (let i = 0; i < recordsToUpdate.length; i += chunkSize) {
	  const chunk = recordsToUpdate.slice(i, i + chunkSize);

	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({ records: chunk }),
	  });

	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // D) Toggling Completion, Today, etc.
  // --------------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const currentlyCompleted = task.fields.Completed || false;
	const newCompletedValue = !currentlyCompleted;
	const newCompletedTime = newCompletedValue ? new Date().toISOString() : null;

	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				Completed: newCompletedValue,
				CompletedTime: newCompletedTime,
			  },
			}
		  : t
	  )
	);

	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: task.id,
			  fields: {
				Completed: newCompletedValue,
				CompletedTime: newCompletedTime,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling completion:", err);
	  setError("Failed to toggle completion. Please try again.");
	  // Revert if patch fails
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  Completed: currentlyCompleted,
				  CompletedTime: currentlyCompleted
					? task.fields.CompletedTime
					: null,
				},
			  }
			: t
		)
	  );
	}
  };

  const handleToggleToday = async (task) => {
	const currentValue = task.fields.Today || false;
	const newValue = !currentValue;

	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				Today: newValue,
			  },
			}
		  : t
	  )
	);

	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: task.id,
			  fields: {
				Today: newValue,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling Today:", err);
	  setError("Failed to toggle 'Today'. Please try again.");
	  // Revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  Today: currentValue,
				},
			  }
			: t
		)
	  );
	}
  };

  // --------------------------------------------------------------------------
  // E) Inline editing for the Task Name
  // --------------------------------------------------------------------------
  const startEditingTask = (task) => {
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName);
  };

  const handleEditNameChange = (newValue) => {
	setEditingTaskName(newValue);
  };

  const commitEdit = async (taskId) => {
	const updatedTasks = tasks.map((t) => {
	  if (t.id === taskId) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			TaskName: editingTaskName,
		  },
		};
	  }
	  return t;
	});
	setTasks(updatedTasks);

	setEditingTaskId(null);
	setEditingTaskName("");

	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: taskId,
			  fields: {
				TaskName: editingTaskName,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error updating TaskName:", err);
	  setError("Failed to update task name. Please try again.");
	}
  };

  const cancelEditing = () => {
	setEditingTaskId(null);
	setEditingTaskName("");
  };

  // --------------------------------------------------------------------------
  // F) Helpers for grouping tasks
  // --------------------------------------------------------------------------
  const groupTasksByIdea = (taskArray) => {
	return taskArray.reduce((acc, t) => {
	  const ideaId = t.fields.IdeaID;
	  if (!acc[ideaId]) {
		acc[ideaId] = [];
	  }
	  acc[ideaId].push(t);
	  return acc;
	}, {});
  };

  // Build a map for quick lookups of idea fields
  const ideasMap = ideas.reduce((acc, idea) => {
	acc[idea.id] = idea;
	return acc;
  }, {});

  // Filter tasks by idea
  const tasksByIdea = groupTasksByIdea(tasks);

  // We only want to show ideas that actually have tasks for "Today"
  const ideaIdsInView = Object.keys(tasksByIdea);

  // Then let's define a "filteredIdeas" array that includes only those ideas
  // which have tasks on Today, sorted by their existing `Order` field
  const filteredIdeas = ideas.filter((i) => ideaIdsInView.includes(i.id));

  // --------------------------------------------------------------------------
  // G) Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (tasks.length === 0) {
	return (
	  <div className="m-4">
		<p>No tasks are marked for Today.</p>
		<Link to="/" className="text-blue-500 underline">
		  &larr; Back to your Ideas
		</Link>
	  </div>
	);
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <h2 className="text-2xl font-bold mb-4">Tasks for Today</h2>
	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your Ideas
	  </Link>

	  {/* 
		Top-level UL for Ideas. We'll attach Sortable to it via ideasListRef.
		Each Idea becomes an <li> with a handle to drag the Idea, 
		then within that item we have a nested UL for tasks, 
		also sortable with its own handle. 
	  */}
	  <ul className="mt-6" ref={ideasListRef}>
		{filteredIdeas.map((idea) => {
		  const ideaId = idea.id;
		  const tasksForIdea = tasksByIdea[ideaId];
		  const ideaTitle = idea.fields.IdeaTitle || "Untitled Idea";

		  // Make sure we have a ref for this idea's tasks
		  if (!listsRefs.current[ideaId]) {
			listsRefs.current[ideaId] = React.createRef();
		  }

		  return (
			<li key={ideaId} className="mb-8 bg-gray-50 p-3 rounded shadow-sm">
			  {/* 
				IDEA DRAG HANDLE 
				(so user can reorder which Idea is first, second, etc.)
			  */}
			  <div className="flex items-center mb-2">
				<div
				  className="idea-drag-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
				  title="Drag to reorder ideas"
				>
				  <svg
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				  >
					<path
					  strokeLinecap="round"
					  strokeLinejoin="round"
					  strokeWidth={2}
					  d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"
					/>
				  </svg>
				</div>
				<h3 className="text-xl font-semibold">{ideaTitle}</h3>
			  </div>

			  {/* Tasks within this Idea */}
			  <ul
				className="border rounded divide-y divide-gray-200"
				ref={listsRefs.current[ideaId]}
			  >
				{tasksForIdea.map((task) => {
				  const isCompleted = task.fields.Completed || false;
				  const completedTime = task.fields.CompletedTime || null;
				  const isToday = task.fields.Today || false;
				  const isEditing = editingTaskId === task.id;

				  return (
					<li
					  key={task.id}
					  className="flex items-center p-3 hover:bg-gray-50"
					>
					  {/* TASK DRAG HANDLE */}
					  <div
						className="task-drag-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
						title="Drag to reorder tasks"
					  >
						<svg
						  className="w-4 h-4"
						  fill="none"
						  stroke="currentColor"
						  viewBox="0 0 24 24"
						>
						  <path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 9h.01M8 15h.01M12 9h.01M12 15h.01M16 9h.01M16 15h.01"
						  />
						</svg>
					  </div>

					  {/* COMPLETED CHECKBOX */}
					  <input
						type="checkbox"
						className="mr-2"
						checked={isCompleted}
						onChange={() => handleToggleCompleted(task)}
					  />

					  {/* TASK NAME (inline editing) */}
					  <div className="flex-1">
						{isEditing ? (
						  <input
							autoFocus
							className="border-b border-gray-300 focus:outline-none"
							value={editingTaskName}
							onChange={(e) => handleEditNameChange(e.target.value)}
							onBlur={() => commitEdit(task.id)}
							onKeyDown={(e) => {
							  if (e.key === "Enter") {
								commitEdit(task.id);
							  } else if (e.key === "Escape") {
								cancelEditing();
							  }
							}}
						  />
						) : (
						  <span
							className={`cursor-pointer ${
							  isCompleted ? "line-through text-gray-500" : ""
							}`}
							onClick={() => startEditingTask(task)}
						  >
							{task.fields.TaskName}
						  </span>
						)}
						{isCompleted && completedTime && (
						  <span className="ml-2 text-sm text-gray-400">
							(Done on {new Date(completedTime).toLocaleString()})
						  </span>
						)}
					  </div>

					  {/* TODAY CHECKBOX */}
					  <div className="ml-2 flex items-center space-x-1">
						<input
						  type="checkbox"
						  checked={isToday}
						  onChange={() => handleToggleToday(task)}
						/>
						<label className="text-sm">Today</label>
					  </div>
					</li>
				  );
				})}
			  </ul>
			</li>
		  );
		})}
	  </ul>
	</div>
  );
}

export default TodayView;
