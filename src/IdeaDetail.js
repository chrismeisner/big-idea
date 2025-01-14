// File: /src/IdeaDetail.js

import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";

import TaskRow from "./TaskRow"; // sub-component

function IdeaDetail() {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");

  // For inline editing a task’s name (one at a time)
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  const { ideaId } = useParams();
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // We'll reference the UL element for SortableJS
  const tasksListRef = useRef(null);

  // --------------------------------------------------------------------------
  // Fetch Idea + tasks (sorted by Order)
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
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  }
		);
		if (!ideaResp.ok) {
		  throw new Error(
			`Airtable error: ${ideaResp.status} ${ideaResp.statusText}`
		  );
		}
		const ideaData = await ideaResp.json();
		setIdea(ideaData);

		// 2) Fetch associated Tasks, sorted by Order ascending
		const tasksResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={IdeaID}="${ideaId}"&sort[0][field]=Order&sort[0][direction]=asc`,
		  {
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
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
  // Initialize Sortable when tasks change
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (tasksListRef.current && tasks.length > 0) {
	  const sortable = new Sortable(tasksListRef.current, {
		animation: 150,
		handle: ".grab-handle",
		onEnd: handleSortEnd,
	  });
	  return () => {
		sortable.destroy();
	  };
	}
  }, [tasks]);

  // --------------------------------------------------------------------------
  // DRAG END => reorder tasks + update Airtable
  // --------------------------------------------------------------------------
  const handleSortEnd = async (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const updatedTasks = [...tasks];
	const [movedItem] = updatedTasks.splice(oldIndex, 1);
	updatedTasks.splice(newIndex, 0, movedItem);

	// Reassign Order field
	const reorderedTasks = updatedTasks.map((task, i) => ({
	  ...task,
	  fields: {
		...task.fields,
		Order: i + 1,
	  },
	}));
	setTasks(reorderedTasks);

	try {
	  await updateTaskOrderInAirtable(reorderedTasks);
	} catch (err) {
	  console.error("Error updating task order:", err);
	  setError("Failed to reorder tasks in Airtable. Please try again.");
	}
  };

  // PATCH updated Orders in Airtable
  const updateTaskOrderInAirtable = async (reorderedTasks) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder update");
	}

	const recordsToUpdate = reorderedTasks.map((task) => ({
	  id: task.id,
	  fields: {
		Order: task.fields.Order,
	  },
	}));

	const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
	  method: "PATCH",
	  headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	  },
	  body: JSON.stringify({ records: recordsToUpdate }),
	});
	if (!resp.ok) {
	  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	}
  };

  // --------------------------------------------------------------------------
  // CREATE a new top-level Task (no ParentTask)
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
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: "", // top-level tasks have no Parent
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
	  const createdTask = data.records[0];
	  setTasks((prev) => [...prev, createdTask]);
	} catch (err) {
	  console.error("Error creating task:", err);
	  setError("Failed to create task. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  // CREATE a Subtask
  // --------------------------------------------------------------------------
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
	  const newOrderValue = tasks.length + 1;

	  const parentTaskID = parentTask.fields.TaskID; // parent's unique ID
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
				  TaskName: "New subtask...", // placeholder
				  IdeaID: ideaId,
				  Order: newOrderValue,
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: parentTaskID,
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
	  const createdSubtask = data.records[0];
	  setTasks((prev) => [...prev, createdSubtask]);
	} catch (err) {
	  console.error("Error creating subtask:", err);
	  setError("Failed to create subtask. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  // Inline editing for Task Name
  // --------------------------------------------------------------------------
  // 1) Start editing
  const startEditingTask = (taskId, currentName) => {
	setEditingTaskId(taskId);
	setEditingTaskName(currentName);
  };

  // 2) As user types, we do NOT patch
  const handleEditNameChange = (newName) => {
	setEditingTaskName(newName);
  };

  // 3) Commit on Enter or Blur => patch
  const commitEdit = async (taskId) => {
	// Patch in Airtable (and local state) via handleEditSave
	await handleEditSave(taskId, editingTaskName);
  };

  // 4) Cancel editing
  const cancelEditing = () => {
	setEditingTaskId(null);
	setEditingTaskName("");
  };

  // The actual function that patches to Airtable
  const handleEditSave = async (taskId, newName) => {
	// Locally update tasks for immediate feedback
	const updatedTasks = tasks.map((t) => {
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
	setTasks(updatedTasks);

	// Clear editing states
	setEditingTaskId(null);
	setEditingTaskName("");

	// Patch to Airtable
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
	} catch (err) {
	  console.error("Failed to update task name:", err);
	  setError("Failed to save updated task name to Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  // Toggle Completion
  // --------------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const currentlyCompleted = task.fields.Completed || false;
	const newCompletedValue = !currentlyCompleted;
	const newCompletedTime = newCompletedValue ? new Date().toISOString() : null;

	// 1) Optimistic UI
	setTasks((prevTasks) =>
	  prevTasks.map((t) => {
		if (t.id === task.id) {
		  return {
			...t,
			fields: {
			  ...t.fields,
			  Completed: newCompletedValue,
			  CompletedTime: newCompletedTime,
			},
		  };
		}
		return t;
	  })
	);

	// 2) Patch to Airtable
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
			  id: task.id,
			  fields: {
				Completed: newCompletedValue,
				CompletedTime: newCompletedTime,
			  },
			},
		  ],
		}),
	  });

	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling task completion:", err);
	  setError("Failed to toggle completion. Please try again.");

	  // (Optional) revert local changes if patch fails
	  setTasks((prevTasks) =>
		prevTasks.map((t) => {
		  if (t.id === task.id) {
			return {
			  ...t,
			  fields: {
				...t.fields,
				Completed: currentlyCompleted,
				CompletedTime: currentlyCompleted
				  ? task.fields.CompletedTime
				  : null,
			  },
			};
		  }
		  return t;
		})
	  );
	}
  };

  // --------------------------------------------------------------------------
  // Group tasks by ParentTask => allows nesting
  // --------------------------------------------------------------------------
  const topLevelTasks = tasks.filter((t) => !t.fields.ParentTask);
  const subtasksByParent = tasks.reduce((acc, t) => {
	const parent = t.fields.ParentTask;
	if (parent) {
	  if (!acc[parent]) acc[parent] = [];
	  acc[parent].push(t);
	}
	return acc;
  }, {});

  // --------------------------------------------------------------------------
  // RENDER
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

	  {/* Tasks List (Sortable) */}
	  <h3 className="text-xl font-semibold mt-6 mb-2">Tasks for this Idea:</h3>
	  {tasks.length > 0 ? (
		<ul
		  className="divide-y divide-gray-200 border rounded"
		  ref={tasksListRef}
		>
		  {topLevelTasks.map((task) => {
			const childTasks = subtasksByParent[task.fields.TaskID] || [];
			return (
			  <TaskRow
				key={task.id}
				task={task}
				subtasks={childTasks}
				editingTaskId={editingTaskId}
				editingTaskName={editingTaskName}
				onStartEditing={startEditingTask}
				onEditNameChange={handleEditNameChange}
				onCommitEdit={commitEdit}
				onCancelEditing={cancelEditing}
				onToggleCompleted={handleToggleCompleted}
				onCreateSubtask={createSubtask}
			  />
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
