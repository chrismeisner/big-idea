// File: /Users/chrismeisner/Projects/big-idea/src/IdeaDetail.js
// File: /src/IdeaDetail.js

import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";

function IdeaDetail() {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");

  // Inline editing states
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // We'll reference one UL for top-level tasks, plus one UL per parent's subtasks
  const topLevelRef = useRef(null);
  const topLevelSortableRef = useRef(null);

  // We'll store references for each parent's subtask UL
  const subtaskRefs = useRef({});
  const subtaskSortableRefs = useRef({});

  const { ideaId } = useParams();
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch Idea + tasks => sorted by "Order" then "SubOrder"
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

		// 1) Fetch the Idea record
		const ideaResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Ideas/${ideaId}`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!ideaResp.ok) {
		  throw new Error(
			`Airtable error: ${ideaResp.status} ${ideaResp.statusText}`
		  );
		}
		const ideaData = await ideaResp.json();
		setIdea(ideaData);

		// 2) Fetch tasks => sorted by Order, then SubOrder
		const tasksResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={IdeaID}="${ideaId}"&sort[0][field]=Order&sort[0][direction]=asc&sort[1][field]=SubOrder&sort[1][direction]=asc`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!tasksResp.ok) {
		  throw new Error(
			`Airtable error: ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);
	  } catch (err) {
		console.error("Error fetching idea or tasks:", err);
		setError("Failed to fetch idea details. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey, ideaId]);

  // --------------------------------------------------------------------------
  // 2) Sortable for top-level tasks => reorder by "Order"
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (!topLevelRef.current || tasks.length === 0) return;

	if (!topLevelSortableRef.current) {
	  topLevelSortableRef.current = new Sortable(topLevelRef.current, {
		animation: 150,
		handle: ".grab-handle",
		onEnd: handleTopLevelSortEnd,
	  });
	}

	return () => {
	  if (topLevelSortableRef.current) {
		topLevelSortableRef.current.destroy();
		topLevelSortableRef.current = null;
	  }
	};
  }, [tasks]);

  const handleTopLevelSortEnd = async (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// Separate top-level from sub tasks
	const topLevel = tasks.filter((t) => !t.fields.ParentTask);
	const subTasks = tasks.filter((t) => t.fields.ParentTask);

	if (oldIndex < 0 || oldIndex >= topLevel.length) return;
	if (newIndex < 0 || newIndex >= topLevel.length) return;

	const updated = [...topLevel];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// Reassign "Order"
	updated.forEach((parent, idx) => {
	  parent.fields.Order = idx + 1;
	});

	// Merge back
	const merged = [...updated, ...subTasks];
	setTasks(merged);

	// Patch top-level tasks to Airtable
	try {
	  await patchTopLevelOrder(updated);
	} catch (err) {
	  console.error("Error reordering top-level tasks:", err);
	  setError("Failed to reorder tasks in Airtable.");
	}
  };

  const patchTopLevelOrder = async (topArray) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}
	const records = topArray.map((p) => ({
	  id: p.id,
	  fields: { Order: p.fields.Order },
	}));
	const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
	  method: "PATCH",
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({ records }),
	});
	if (!resp.ok) {
	  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	}
  };

  // --------------------------------------------------------------------------
  // 3) Sortable for each parent's subtasks => reorder by "SubOrder"
  // --------------------------------------------------------------------------
  useEffect(() => {
	// For each parent
	const topLevelTasks = tasks.filter((t) => !t.fields.ParentTask);
	topLevelTasks.forEach((parent) => {
	  const parentId = parent.id; // actual record ID in Airtable
	  const el = subtaskRefs.current[parentId];
	  if (!el) return;
	  if (!subtaskSortableRefs.current[parentId]) {
		subtaskSortableRefs.current[parentId] = new Sortable(el, {
		  animation: 150,
		  handle: ".sub-grab-handle",
		  onEnd: (evt) => handleSubtaskSortEnd(evt, parent),
		});
	  }
	});

	return () => {
	  Object.values(subtaskSortableRefs.current).forEach((sortable) => {
		if (sortable) sortable.destroy();
	  });
	  subtaskSortableRefs.current = {};
	};
  }, [tasks]);

  const handleSubtaskSortEnd = async (evt, parentTask) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const parentID = parentTask.fields.TaskID; // parent's unique TaskID
	const subArray = tasks.filter((t) => t.fields.ParentTask === parentID);
	const others = tasks.filter((t) => t.fields.ParentTask !== parentID);

	if (oldIndex < 0 || oldIndex >= subArray.length) return;
	if (newIndex < 0 || newIndex >= subArray.length) return;

	const updated = [...subArray];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// reassign "SubOrder"
	updated.forEach((sub, idx) => {
	  sub.fields.SubOrder = idx + 1;
	});

	// merge
	const merged = [...others, ...updated];
	setTasks(merged);

	// Patch to Airtable
	try {
	  await patchSubtaskOrder(updated);
	} catch (err) {
	  console.error("Error reordering subtasks:", err);
	  setError("Failed to reorder subtasks in Airtable.");
	}
  };

  const patchSubtaskOrder = async (subArray) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for subtasks reorder");
	}
	const records = subArray.map((sub) => ({
	  id: sub.id,
	  fields: { SubOrder: sub.fields.SubOrder },
	}));

	const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
	  method: "PATCH",
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({ records }),
	});
	if (!resp.ok) {
	  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	}
  };

  // --------------------------------------------------------------------------
  // 4) CREATE top-level or sub
  // --------------------------------------------------------------------------
  const createTask = async (taskName) => {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}
	try {
	  const auth = getAuth();
	  const currentUser = auth.currentUser;
	  if (!currentUser) {
		setError("No logged-in user.");
		return;
	  }
	  const newOrderValue = tasks.length + 1;

	  const response = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks`,
		{
		  method: "POST",
		  headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			records: [
			  {
				fields: {
				  TaskName: taskName,
				  IdeaID: ideaId,
				  Order: newOrderValue,
				  SubOrder: 0,
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: "",
				  Today: false,
				},
			  },
			],
		  }),
		}
	  );
	  if (!response.ok) {
		throw new Error(
		  `Airtable error: ${response.status} ${response.statusText}`
		);
	  }
	  const data = await response.json();
	  const newRec = data.records[0];
	  setTasks((prev) => [...prev, newRec]);
	} catch (err) {
	  console.error("Error creating task:", err);
	  setError("Failed to create task. Please try again.");
	}
  };

  const createSubtask = async (parentTask) => {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}
	try {
	  const auth = getAuth();
	  const currentUser = auth.currentUser;
	  if (!currentUser) {
		setError("No logged-in user.");
		return;
	  }
	  const newSubOrderVal = tasks.length + 1;
	  const parentID = parentTask.fields.TaskID;

	  const response = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks`,
		{
		  method: "POST",
		  headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			records: [
			  {
				fields: {
				  TaskName: "New subtask...",
				  IdeaID: ideaId,
				  Order: 0,
				  SubOrder: newSubOrderVal,
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: parentID,
				  Today: false,
				},
			  },
			],
		  }),
		}
	  );
	  if (!response.ok) {
		throw new Error(
		  `Airtable error: ${response.status} ${response.statusText}`
		);
	  }
	  const data = await response.json();
	  const newSub = data.records[0];
	  setTasks((prev) => [...prev, newSub]);
	} catch (err) {
	  console.error("Error creating subtask:", err);
	  setError("Failed to create subtask. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  // 5) Inline editing => "XXX" => DELETE parent & orphan children
  // --------------------------------------------------------------------------
  const startEditingTask = (taskId, currentName) => {
	setEditingTaskId(taskId);
	setEditingTaskName(currentName);
  };

  const handleEditNameChange = (val) => {
	setEditingTaskName(val);
  };

  const commitEdit = async (taskId) => {
	if (editingTaskName.trim().toUpperCase() === "XXX") {
	  // If user typed "XXX", we delete + orphan children
	  await handleDeleteTask(taskId);
	  return;
	}
	// Otherwise just rename
	await handleEditSave(taskId, editingTaskName);
  };

  const cancelEditing = () => {
	setEditingTaskId(null);
	setEditingTaskName("");
  };

  const handleEditSave = async (taskId, newName) => {
	// local rename
	const updated = tasks.map((t) => {
	  if (t.id === taskId) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			TaskName: newName,
		  },
		};
	  }
	  return t;
	});
	setTasks(updated);

	// clear editing
	setEditingTaskId(null);
	setEditingTaskName("");

	// patch
	try {
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
			  id: taskId,
			  fields: { TaskName: newName },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error updating task name:", err);
	  setError("Failed to save updated task name to Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  // 6) handleDeleteTask => Remove parent, orphan children
  // --------------------------------------------------------------------------
  const handleDeleteTask = async (taskId) => {
	// 1) locate the parent's unique TaskID
	const taskToDelete = tasks.find((t) => t.id === taskId);
	if (!taskToDelete) return;

	const parentUniqueID = taskToDelete.fields.TaskID; 
	// e.g. "task_abc123"

	// 2) remove from local state immediately
	setTasks((prev) => prev.filter((t) => t.id !== taskId));

	// 3) find child tasks referencing the parent's TaskID
	const childTasks = tasks.filter(
	  (t) => t.fields.ParentTask === parentUniqueID
	);

	// 3a) patch them in Airtable => clear out ParentTask
	if (childTasks.length > 0) {
	  try {
		const recordsToPatch = childTasks.map((ct) => ({
		  id: ct.id,
		  fields: {
			ParentTask: "", // or null
		  },
		}));

		const chunkSize = 10;
		for (let i = 0; i < recordsToPatch.length; i += chunkSize) {
		  const chunk = recordsToPatch.slice(i, i + chunkSize);
		  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
			method: "PATCH",
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			  "Content-Type": "application/json",
			},
			body: JSON.stringify({ records: chunk }),
		  });
		  if (!patchResp.ok) {
			throw new Error(
			  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
			);
		  }
		}

		// also update local state => remove ParentTask from those child tasks
		setTasks((prev) =>
		  prev.map((ct) =>
			ct.fields.ParentTask === parentUniqueID
			  ? {
				  ...ct,
				  fields: {
					...ct.fields,
					ParentTask: "",
				  },
				}
			  : ct
		  )
		);
	  } catch (err) {
		console.error("Error removing ParentTask from child tasks:", err);
		// optional: revert local if needed
	  }
	}

	// 4) now delete the parent from Airtable
	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const delUrl = `https://api.airtable.com/v0/${baseId}/Tasks/${taskId}`;
	  const resp = await fetch(delUrl, {
		method: "DELETE",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		},
	  });
	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  console.log(`Record ${taskId} deleted (due to 'XXX'), children are now orphaned.`);
	} catch (err) {
	  console.error("Error deleting task from Airtable:", err);
	  setError("Failed to delete the task from Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  // 7) Toggling Completed & Today
  // --------------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// optimistic UI
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				Completed: newValue,
				CompletedTime: newTime,
			  },
			}
		  : t
	  )
	);

	// patch
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
				Completed: newValue,
				CompletedTime: newTime,
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
	  // revert
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
	const wasToday = task.fields.Today || false;
	const newValue = !wasToday;

	// local update
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Today: newValue } }
		  : t
	  )
	);

	// patch
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
  // 8) Group tasks => top-level vs. subtasks
  // --------------------------------------------------------------------------
  const topLevelTasks = tasks.filter((t) => !t.fields.ParentTask);
  // Group sub tasks by parent
  const subtasksByParent = tasks.reduce((acc, t) => {
	const parent = t.fields.ParentTask;
	if (parent) {
	  if (!acc[parent]) acc[parent] = [];
	  acc[parent].push(t);
	}
	return acc;
  }, {});

  // Sort sub tasks by "SubOrder"
  Object.keys(subtasksByParent).forEach((pID) => {
	subtasksByParent[pID].sort(
	  (a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0)
	);
  });

  // Also sort top-level by "Order"
  topLevelTasks.sort(
	(a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading idea details...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (!idea) {
	return <p className="m-4">No idea found with ID {ideaId}.</p>;
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  {/* Back link */}
	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your ideas
	  </Link>

	  {/* Idea details */}
	  <h2 className="text-2xl font-bold mt-4">{idea.fields.IdeaTitle}</h2>
	  <p className="mt-2 text-gray-700">{idea.fields.IdeaSummary}</p>

	  {/* Add a new top-level Task form */}
	  <form
		className="mt-4"
		onSubmit={(e) => {
		  e.preventDefault();
		  if (!newTaskName.trim()) return;
		  createTask(newTaskName);
		  setNewTaskName("");
		}}
	  >
		<label className="block font-semibold mb-1">Add a Task:</label>
		<div className="flex items-center space-x-2">
		  <input
			type="text"
			value={newTaskName}
			onChange={(e) => setNewTaskName(e.target.value)}
			placeholder="New task name..."
			className="border border-gray-300 rounded px-2 py-1 flex-1"
		  />
		  <button
			type="submit"
			className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
		  >
			Add
		  </button>
		</div>
	  </form>

	  {/* Tasks List => Sortable for top-level */}
	  <h3 className="text-xl font-semibold mt-6 mb-2">Tasks for this Idea:</h3>
	  {tasks.length > 0 ? (
		<ul
		  className="divide-y divide-gray-200 border rounded"
		  ref={topLevelRef}
		>
		  {topLevelTasks.map((parent) => {
			const childTasks = subtasksByParent[parent.fields.TaskID] || [];
			const isEditingParent = editingTaskId === parent.id;
			const parentCompleted = parent.fields.Completed || false;
			const parentCompletedTime = parent.fields.CompletedTime || null;
			const isTodayParent = parent.fields.Today || false;

			// We'll store a ref callback for this parent's UL
			const parentRefCb = (el) => {
			  if (el) {
				subtaskRefs.current[parent.id] = el;
			  }
			};

			return (
			  <li key={parent.id} className="p-4 hover:bg-gray-50">
				<div className="flex items-center">
				  {/* handle for parent */}
				  <div
					className="grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
					title="Drag to reorder parent tasks"
				  >
					<Bars3Icon className="h-5 w-5" />
				  </div>
				  {/* Completed? */}
				  <input
					type="checkbox"
					className="mr-2"
					checked={parentCompleted}
					onChange={() => handleToggleCompleted(parent)}
				  />
				  <div className="flex-1">
					{isEditingParent ? (
					  <input
						autoFocus
						className="border-b border-gray-300 focus:outline-none"
						value={editingTaskName}
						onChange={(e) => handleEditNameChange(e.target.value)}
						onBlur={() => commitEdit(parent.id)}
						onKeyDown={(e) => {
						  if (e.key === "Enter") commitEdit(parent.id);
						  else if (e.key === "Escape") cancelEditing();
						}}
					  />
					) : (
					  <span
						className={`cursor-pointer ${
						  parentCompleted ? "line-through text-gray-500" : ""
						}`}
						onClick={() =>
						  startEditingTask(parent.id, parent.fields.TaskName)
						}
					  >
						{parent.fields.TaskName}
					  </span>
					)}
					{parentCompleted && parentCompletedTime && (
					  <span className="ml-2 text-sm text-gray-400">
						(Done on{" "}
						{new Date(parentCompletedTime).toLocaleString()})
					  </span>
					)}
				  </div>

				  {/* "Today" checkbox if not completed */}
				  {!parentCompleted && (
					<div className="ml-2 flex items-center space-x-1">
					  <input
						type="checkbox"
						checked={isTodayParent}
						onChange={() => handleToggleToday(parent)}
					  />
					  <label className="text-sm">Today</label>
					</div>
				  )}
				</div>

				{/* Subtasks => UL ref for Sortable => reorder by "SubOrder" */}
				{childTasks.length > 0 && (
				  <ul
					ref={parentRefCb}
					className="ml-6 mt-2 border-l border-gray-200"
				  >
					{childTasks.map((sub) => {
					  const isEditingSub = editingTaskId === sub.id;
					  const subCompleted = sub.fields.Completed || false;
					  const subCompletedTime = sub.fields.CompletedTime || null;
					  // if you want to show sub's "Today" as well, optional

					  return (
						<li
						  key={sub.id}
						  className="py-2 pl-3 hover:bg-gray-50 flex items-center"
						>
						  {/* handle for subtask => reorder by SubOrder */}
						  <div
							className="sub-grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
							title="Drag to reorder subtasks"
						  >
							<Bars3Icon className="h-4 w-4" />
						  </div>
						  {/* subtask Completed? */}
						  <input
							type="checkbox"
							className="mr-2"
							checked={subCompleted}
							onChange={() => handleToggleCompleted(sub)}
						  />
						  <div className="flex-1">
							{isEditingSub ? (
							  <input
								autoFocus
								className="border-b border-gray-300 focus:outline-none"
								value={editingTaskName}
								onChange={(e) =>
								  handleEditNameChange(e.target.value)
								}
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
								onClick={() =>
								  startEditingTask(sub.id, sub.fields.TaskName)
								}
							  >
								{sub.fields.TaskName}
							  </span>
							)}
							{subCompleted && subCompletedTime && (
							  <span className="ml-2 text-sm text-gray-400">
								(Done on{" "}
								{new Date(subCompletedTime).toLocaleString()})
							  </span>
							)}
						  </div>
						</li>
					  );
					})}
				  </ul>
				)}

				{/* Add new subtask */}
				<div className="ml-6 mt-2 pl-3 border-l border-gray-200">
				  <form
					onSubmit={(e) => {
					  e.preventDefault();
					  createSubtask(parent);
					}}
					className="flex items-center space-x-2"
				  >
					<button
					  type="submit"
					  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
					>
					  + Subtask
					</button>
				  </form>
				</div>
			  </li>
			);
		  })}
		</ul>
	  ) : (
		<p className="text-sm text-gray-500">No tasks yet.</p>
	  )}
	</div>
  );
}

export default IdeaDetail;
