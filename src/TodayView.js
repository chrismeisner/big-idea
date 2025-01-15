// File: /Users/chrismeisner/Projects/big-idea/src/TodayView.js

// File: /src/TodayView.js
import React, { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";

function TodayView() {
  // State
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline editing for tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // For creating a new subtask name (if needed)
  const [newSubtaskName, setNewSubtaskName] = useState({});

  // We’ll have a top-level Sortable for relevant Ideas
  const ideasListRef = useRef(null);

  // We’ll also store a ref for each Idea's parent tasks UL
  const tasksSortableRefs = useRef({});

  // For each parent task's subtask UL, we also store refs
  const subtaskRefs = useRef({});
  const subtaskSortableRefs = useRef({});

  // Airtable credentials
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch tasks + ideas => BOTH sorted by "OrderToday"
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

		// A) Fetch tasks, sorted by "OrderToday" + SubOrder
		const tasksUrl = `https://api.airtable.com/v0/${baseId}/Tasks?sort%5B0%5D%5Bfield%5D=OrderToday&sort%5B0%5D%5Bdirection%5D=asc&sort%5B1%5D%5Bfield%5D=SubOrder&sort%5B1%5D%5Bdirection%5D=asc`;
		const tasksResp = await fetch(tasksUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!tasksResp.ok) {
		  throw new Error(
			`Tasks error: ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// B) Fetch Ideas, also sorted by "OrderToday" if you want
		const ideasUrl = `https://api.airtable.com/v0/${baseId}/Ideas?sort%5B0%5D%5Bfield%5D=OrderToday&sort%5B0%5D%5Bdirection%5D=asc`;
		const ideasResp = await fetch(ideasUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!ideasResp.ok) {
		  throw new Error(
			`Ideas error: ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);
	  } catch (err) {
		console.error("Failed to fetch tasks or ideas:", err);
		setError("Failed to load tasks for Today. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};
	fetchData();
  }, [baseId, apiKey]);

  // --------------------------------------------------------------------------
  // 2) Build tasksByIdea + subtasksByParent
  // --------------------------------------------------------------------------
  const tasksByIdea = {};
  const subtasksByParent = {};

  tasks.forEach((t) => {
	const ideaId = t.fields.IdeaID || "noIdea";
	if (!tasksByIdea[ideaId]) tasksByIdea[ideaId] = [];
	tasksByIdea[ideaId].push(t);

	if (t.fields.ParentTask) {
	  const parentId = t.fields.ParentTask;
	  if (!subtasksByParent[parentId]) {
		subtasksByParent[parentId] = [];
	  }
	  subtasksByParent[parentId].push(t);
	}
  });

  // We only show ideas that have at least one "parent task" with Today=true
  const relevantIdeas = ideas.filter((idea) => {
	const ideaId = idea.id;
	const tasksForIdea = tasksByIdea[ideaId] || [];
	return tasksForIdea.some((tsk) => tsk.fields.Today && !tsk.fields.ParentTask);
  });

  // --------------------------------------------------------------------------
  // 3) Reorder the *Ideas* themselves (optional)
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (loading) return;
	if (!ideasListRef.current) return;
	if (relevantIdeas.length === 0) return;

	const sortable = new Sortable(ideasListRef.current, {
	  animation: 150,
	  handle: ".idea-drag-handle",
	  onEnd: handleIdeasSortEnd,
	});

	return () => {
	  if (sortable) sortable.destroy();
	};
  }, [loading, relevantIdeas]);

  const handleIdeasSortEnd = (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// 1) reorder only the relevant ideas array
	const updated = [...relevantIdeas];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// 2) merge them back with non-relevant
	const nonRelevant = ideas.filter((id) => !relevantIdeas.includes(id));
	const reordered = [...nonRelevant, ...updated];

	// 3) reassign "OrderToday" for each idea
	reordered.forEach((idea, i) => {
	  idea.fields.OrderToday = i + 1;
	});

	// 4) set state
	setIdeas(reordered);

	// 5) patch to Airtable
	updateIdeasOrderInAirtable(reordered).catch((err) => {
	  console.error("Failed to update ideas order in Airtable:", err);
	  setError("Failed to reorder ideas. Please try again.");
	});
  };

  const updateIdeasOrderInAirtable = async (ideasList) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for ideas reorder");
	}
	const records = ideasList.map((idea) => ({
	  id: idea.id,
	  fields: { OrderToday: idea.fields.OrderToday },
	}));

	const chunkSize = 10;
	for (let i = 0; i < records.length; i += chunkSize) {
	  const chunk = records.slice(i, i + chunkSize);
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({ records: chunk }),
	  });
	  if (!resp.ok) {
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 4) For each Idea, reorder parent tasks by "OrderToday"
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (loading) return;

	relevantIdeas.forEach((idea) => {
	  const el = document.getElementById(`tasks-ul-${idea.id}`);
	  if (!el) return;
	  if (!tasksSortableRefs.current[idea.id]) {
		tasksSortableRefs.current[idea.id] = new Sortable(el, {
		  animation: 150,
		  handle: ".task-drag-handle",
		  onEnd: (evt) => handleTasksSortEnd(evt, idea.id),
		});
	  }
	});

	return () => {
	  Object.values(tasksSortableRefs.current).forEach((sortable) => {
		if (sortable) sortable.destroy();
	  });
	  tasksSortableRefs.current = {};
	};
  }, [loading, relevantIdeas, tasksByIdea]);

  const handleTasksSortEnd = (evt, ideaId) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// 1) filter parent tasks for that idea
	const tasksForIdea = tasksByIdea[ideaId] || [];
	const parentToday = tasksForIdea.filter(
	  (t) => t.fields.Today && !t.fields.ParentTask
	);

	if (oldIndex < 0 || oldIndex >= parentToday.length) return;
	if (newIndex < 0 || newIndex >= parentToday.length) return;

	// 2) reorder
	const updated = [...parentToday];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// 3) reassign "OrderToday"
	updated.forEach((task, idx) => {
	  task.fields.OrderToday = idx + 1;
	});

	// 4) merge with all other tasks
	const otherTasks = tasks.filter(
	  (t) =>
		!(
		  t.fields.IdeaID === ideaId &&
		  t.fields.Today &&
		  !t.fields.ParentTask
		)
	);
	const reordered = [...otherTasks, ...updated];
	setTasks(reordered);

	// 5) patch
	updateTasksOrderInAirtable(updated).catch((err) => {
	  console.error("Failed to update tasks order in Airtable:", err);
	  setError("Failed to reorder tasks. Please try again.");
	});
  };

  const updateTasksOrderInAirtable = async (list) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder");
	}
	const recordsToUpdate = list.map((task) => ({
	  id: task.id,
	  fields: { OrderToday: task.fields.OrderToday },
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
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 5) For each parent task, reorder subtasks by "SubOrder"
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (loading) return;

	tasks.forEach((task) => {
	  if (!task.fields.ParentTask && task.fields.Today) {
		// This is a parent task
		const subListEl = document.getElementById(`subtasks-ul-${task.id}`);
		if (!subListEl) return;
		if (!subtaskSortableRefs.current[task.id]) {
		  subtaskSortableRefs.current[task.id] = new Sortable(subListEl, {
			animation: 150,
			handle: ".subtask-drag-handle",
			onEnd: (evt) => handleSubtaskSortEnd(evt, task),
		  });
		}
	  }
	});

	return () => {
	  Object.values(subtaskSortableRefs.current).forEach((sortable) => {
		if (sortable) sortable.destroy();
	  });
	  subtaskSortableRefs.current = {};
	};
  }, [loading, tasks]);

  const handleSubtaskSortEnd = (evt, parentTask) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// 1) find all subtasks for that parent
	const parentId = parentTask.fields.TaskID;
	const mySubtasks = tasks.filter((t) => t.fields.ParentTask === parentId);

	if (oldIndex < 0 || oldIndex >= mySubtasks.length) return;
	if (newIndex < 0 || newIndex >= mySubtasks.length) return;

	// 2) reorder
	const updated = [...mySubtasks];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// 3) reassign "SubOrder"
	updated.forEach((sub, idx) => {
	  sub.fields.SubOrder = idx + 1;
	});

	// 4) merge with the rest
	const others = tasks.filter((t) => t.fields.ParentTask !== parentId);
	const newAll = [...others, ...updated];
	setTasks(newAll);

	// 5) patch
	updateSubtaskOrderInAirtable(updated).catch((err) => {
	  console.error("Failed to update subtask order in Airtable:", err);
	  setError("Failed to reorder subtasks. Please try again.");
	});
  };

  const updateSubtaskOrderInAirtable = async (subArray) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for subtask reorder");
	}
	const recordsToUpdate = subArray.map((sub) => ({
	  id: sub.id,
	  fields: { SubOrder: sub.fields.SubOrder },
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
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 6) Toggling Completed / Today
  // --------------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	// 1) Grab current "Completed" state
	const wasCompleted = task.fields.Completed || false;
	// 2) New value
	const newCompletedValue = !wasCompleted;
	// 3) If newly completed => set CompletedTime, else null
	const newCompletedTime = newCompletedValue ? new Date().toISOString() : null;

	// 4) Update local state (optimistic)
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

	// 5) Patch to Airtable
	try {
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
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error toggling completion:", err);
	  setError("Failed to toggle completion. Please try again.");

	  // Revert if needed
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  Completed: wasCompleted,
				  CompletedTime: wasCompleted
					? t.fields.CompletedTime
					: null,
				},
			  }
			: t
		)
	  );
	}
  };

  const handleToggleToday = async (task) => {
	// 1) Grab current value
	const wasToday = task.fields.Today || false;
	const newValue = !wasToday;

	// 2) Local update
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Today: newValue } }
		  : t
	  )
	);

	// 3) Patch
	try {
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
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error toggling Today:", err);
	  setError("Failed to toggle Today. Please try again.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Today: wasToday } }
			: t
		)
	  );
	}
  };

  // --------------------------------------------------------------------------
  // 7) Inline editing
  // --------------------------------------------------------------------------
  const startEditingTask = (task) => {
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName);
  };

  const handleEditNameChange = (val) => {
	setEditingTaskName(val);
  };

  const commitEdit = async (taskId) => {
	// local
	const updatedTasks = tasks.map((t) =>
	  t.id === taskId
		? { ...t, fields: { ...t.fields, TaskName: editingTaskName } }
		: t
	);
	setTasks(updatedTasks);
	setEditingTaskId(null);
	setEditingTaskName("");

	// patch
	try {
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
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
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
  // 8) Create a NEW subtask
  // --------------------------------------------------------------------------
  const handleCreateSubtask = async (parentTask) => {
	// your code if you want it
	// but presumably you want to set "SubOrder"
  };

  // --------------------------------------------------------------------------
  // 9) Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  if (relevantIdeas.length === 0) {
	return (
	  <div className="m-4">
		<p>No ideas have parent tasks marked Today.</p>
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

	  {/* If you want to reorder Ideas, wrap them in a <ul ref=ideasListRef> */}
	  <ul ref={ideasListRef} className="mt-4 space-y-4">
		{relevantIdeas.map((idea) => {
		  const ideaId = idea.id;
		  const ideaTitle = idea.fields.IdeaTitle || "Untitled Idea";

		  const tasksForIdea = tasksByIdea[ideaId] || [];
		  const parentToday = tasksForIdea.filter(
			(t) => t.fields.Today && !t.fields.ParentTask
		  );

		  return (
			<li
			  key={ideaId}
			  className="bg-gray-50 p-3 rounded shadow"
			>
			  <div
				className="idea-drag-handle cursor-grab active:cursor-grabbing text-gray-400 flex items-center space-x-2 mb-1"
				title="Drag to reorder ideas"
			  >
				<Bars3Icon className="w-4 h-4" />
				<h3 className="text-xl font-semibold">{ideaTitle}</h3>
			  </div>

			  {/* Parent tasks UL */}
			  <ul
				id={`tasks-ul-${idea.id}`}
				className="border rounded divide-y divide-gray-200"
			  >
				{parentToday.map((task) => {
				  const isEditing = editingTaskId === task.id;
				  const isCompleted = task.fields.Completed || false;
				  const completedTime = task.fields.CompletedTime || null;
				  const subList = subtasksByParent[task.fields.TaskID] || [];

				  return (
					<li key={task.id} className="p-4 hover:bg-gray-50">
					  {/* Parent row */}
					  <div className="flex items-center">
						<div
						  className="task-drag-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
						  title="Drag to reorder parent tasks"
						>
						  <Bars3Icon className="h-4 w-4" />
						</div>
						{/* Completed checkbox */}
						<input
						  type="checkbox"
						  className="mr-2"
						  checked={isCompleted}
						  onChange={() => handleToggleCompleted(task)}
						/>
						<div className="flex-1">
						  {isEditing ? (
							<input
							  autoFocus
							  className="border-b border-gray-300 focus:outline-none"
							  value={editingTaskName}
							  onChange={(e) => handleEditNameChange(e.target.value)}
							  onBlur={() => commitEdit(task.id)}
							  onKeyDown={(e) => {
								if (e.key === "Enter") commitEdit(task.id);
								else if (e.key === "Escape") cancelEditing();
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
							  (Done on{" "}
							  {new Date(completedTime).toLocaleString()})
							</span>
						  )}
						</div>
						{/* "Today" toggle? */}
						<div className="ml-2 flex items-center space-x-1">
						  <input
							type="checkbox"
							checked={task.fields.Today || false}
							onChange={() => handleToggleToday(task)}
						  />
						  <label className="text-sm">Today</label>
						</div>
					  </div>

					  {/* Subtasks => each subtask sorted by "SubOrder" */}
					  {subList.length > 0 && (
						<ul
						  id={`subtasks-ul-${task.id}`}
						  className="ml-6 mt-2 border-l border-gray-200"
						>
						  {subList.map((sub) => {
							const subIsEditing = editingTaskId === sub.id;
							const subCompleted = sub.fields.Completed || false;
							const subCompletedTime = sub.fields.CompletedTime || null;
							return (
							  <li
								key={sub.id}
								className="py-2 pl-3 hover:bg-gray-50 flex items-center"
							  >
								<div
								  className="subtask-drag-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
								  title="Drag to reorder subtasks"
								>
								  <Bars3Icon className="h-4 w-4" />
								</div>
								<input
								  type="checkbox"
								  className="mr-2"
								  checked={subCompleted}
								  onChange={() => handleToggleCompleted(sub)}
								/>
								<div className="flex-1">
								  {subIsEditing ? (
									<input
									  autoFocus
									  className="border-b border-gray-300 focus:outline-none"
									  value={editingTaskName}
									  onChange={(e) => handleEditNameChange(e.target.value)}
									  onBlur={() => commitEdit(sub.id)}
									  onKeyDown={(e) => {
										if (e.key === "Enter") commitEdit(sub.id);
										else if (e.key === "Escape") cancelEditing();
									  }}
									/>
								  ) : (
									<span
									  className={`cursor-pointer ${
										subCompleted
										  ? "line-through text-gray-500"
										  : ""
									  }`}
									  onClick={() => startEditingTask(sub)}
									>
									  {sub.fields.TaskName}
									</span>
								  )}
								  {subCompleted && subCompletedTime && (
									<span className="ml-2 text-sm text-gray-400">
									  (Done on{" "}
									  {new Date(subCompletedTime).toLocaleString()}
									  )
									</span>
								  )}
								</div>
							  </li>
							);
						  })}
						</ul>
					  )}

					  {/* Add new subtask form */}
					  <div className="ml-6 mt-2 pl-3 border-l border-gray-200">
						{/* your create subtask form */}
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
