// File: /src/IdeaDetail.js

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";

// A simple modal component for picking a milestone
function PickMilestoneModal({ allMilestones, onClose, onSelectMilestone }) {
  return (
	<div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
	  <div className="bg-white p-4 rounded shadow-lg w-80">
		<h3 className="text-lg font-semibold mb-3">Pick a Milestone</h3>

		<ul className="max-h-64 overflow-y-auto border rounded divide-y">
		  {allMilestones.map((m) => (
			<li key={m.id}>
			  <button
				className="w-full text-left p-2 hover:bg-gray-100"
				onClick={() => onSelectMilestone(m)}
			  >
				{m.fields.MilestoneName || "(Untitled Milestone)"}
			  </button>
			</li>
		  ))}
		</ul>

		<button
		  onClick={onClose}
		  className="mt-3 px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
		>
		  Cancel
		</button>
	  </div>
	</div>
  );
}

function IdeaDetail() {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");

  // Inline editing states
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // For modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // Refs for Sortable
  const topLevelRef = useRef(null);
  const topLevelSortableRef = useRef(null);
  const subtaskRefs = useRef({});
  const subtaskSortableRefs = useRef({});

  // Param from react-router
  const { customIdeaId } = useParams();

  // Airtable environment variables
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch Idea, Tasks, and Milestones
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

		// A) Fetch the single Idea record (by customIdeaId)
		const ideaResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Ideas?filterByFormula={IdeaID}="${customIdeaId}"`,
		  { headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!ideaResp.ok) {
		  throw new Error(
			`Airtable error (Idea): ${ideaResp.status} ${ideaResp.statusText}`
		  );
		}
		const ideaData = await ideaResp.json();
		if (ideaData.records.length === 0) {
		  setError(`No Idea found for custom ID: ${customIdeaId}`);
		  setLoading(false);
		  return;
		}
		const foundIdea = ideaData.records[0];
		setIdea(foundIdea);

		// B) Fetch Tasks for this Idea
		const tasksResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={IdeaID}="${customIdeaId}"&sort[0][field]=Order&sort[0][direction]=asc&sort[1][field]=SubOrder&sort[1][direction]=asc`,
		  { headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!tasksResp.ok) {
		  throw new Error(
			`Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// C) Fetch ALL Milestones
		//    (Now we do NOT rely on TaskID in Milestones. We'll store the chosen milestone in Task.fields.MilestoneID.)
		const milestonesResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones`,
		  { headers: { Authorization: `Bearer ${apiKey}` } }
		);
		if (!milestonesResp.ok) {
		  throw new Error(
			`Airtable error (Milestones): ${milestonesResp.status} ${milestonesResp.statusText}`
		  );
		}
		const milestonesData = await milestonesResp.json();
		setMilestones(milestonesData.records);
	  } catch (err) {
		console.error("Error fetching idea/tasks/milestones:", err);
		setError("Failed to fetch idea details. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey, customIdeaId]);

  // --------------------------------------------------------------------------
  // 2) Sortable for top-level tasks
  // --------------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!topLevelRef.current) return;

	// Destroy old instance if any
	if (topLevelSortableRef.current) {
	  topLevelSortableRef.current.destroy();
	  topLevelSortableRef.current = null;
	}

	// Initialize
	topLevelSortableRef.current = new Sortable(topLevelRef.current, {
	  animation: 150,
	  handle: ".grab-handle",
	  onEnd: handleTopLevelSortEnd,
	});

	// Cleanup
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

	// Merge with all subtasks
	const merged = [...updated, ...subTasks];
	setTasks(merged);

	// Optional: Patch to Airtable if you want to store "Order" updates
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
  // 3) Sortable for each parent's subtasks
  // --------------------------------------------------------------------------
  useLayoutEffect(() => {
	// Destroy existing subtask Sortables
	Object.values(subtaskSortableRefs.current).forEach((sortable) => {
	  if (sortable) sortable.destroy();
	});
	subtaskSortableRefs.current = {};

	// Re-init for each top-level parent
	const topLevelTasks = tasks.filter((t) => !t.fields.ParentTask);
	topLevelTasks.forEach((parent) => {
	  const parentId = parent.id;
	  const el = subtaskRefs.current[parentId];
	  if (!el) return;
	  subtaskSortableRefs.current[parentId] = new Sortable(el, {
		animation: 150,
		handle: ".sub-grab-handle",
		onEnd: (evt) => handleSubtaskSortEnd(evt, parent),
	  });
	});

	// Cleanup
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

	const parentID = parentTask.fields.TaskID;
	const subArray = tasks.filter((t) => t.fields.ParentTask === parentID);
	const others = tasks.filter((t) => t.fields.ParentTask !== parentID);

	if (oldIndex < 0 || oldIndex >= subArray.length) return;
	if (newIndex < 0 || newIndex >= subArray.length) return;

	const updated = [...subArray];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// Reassign "SubOrder"
	updated.forEach((sub, idx) => {
	  sub.fields.SubOrder = idx + 1;
	});

	const merged = [...others, ...updated];
	setTasks(merged);

	try {
	  await patchSubtaskOrder(updated);
	} catch (err) {
	  console.error("Error reordering subtasks:", err);
	  setError("Failed to reorder subtasks in Airtable.");
	}
  };

  const patchSubtaskOrder = async (subArray) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
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
	if (!idea) return;
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
	  const customID = idea.fields.IdeaID;

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
				  IdeaID: customID,
				  Order: newOrderValue,
				  SubOrder: 0,
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: "",
				  Today: false,
				  // We'll add MilestoneID if chosen, but for new tasks, it's empty
				},
			  },
			],
		  }),
		}
	  );
	  if (!response.ok) {
		throw new Error(
		  `Airtable error (createTask): ${response.status} ${response.statusText}`
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
	if (!idea) return;
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
	  const customID = idea.fields.IdeaID;
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
				  IdeaID: customID,
				  Order: 0,
				  SubOrder: newSubOrderVal,
				  Completed: false,
				  CompletedTime: null,
				  ParentTask: parentID,
				  Today: false,
				  // MilestoneID empty, by default
				},
			  },
			],
		  }),
		}
	  );
	  if (!response.ok) {
		throw new Error(
		  `Airtable error (createSubtask): ${response.status} ${response.statusText}`
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
	  await handleDeleteTask(taskId);
	  return;
	}
	await handleEditSave(taskId, editingTaskName);
  };

  const cancelEditing = () => {
	setEditingTaskId(null);
	setEditingTaskName("");
  };

  const handleEditSave = async (taskId, newName) => {
	const updated = tasks.map((t) =>
	  t.id === taskId
		? { ...t, fields: { ...t.fields, TaskName: newName } }
		: t
	);
	setTasks(updated);
	setEditingTaskId(null);
	setEditingTaskName("");

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
	const toDelete = tasks.find((t) => t.id === taskId);
	if (!toDelete) return;

	const parentUniqueID = toDelete.fields.TaskID;

	// remove parent from local
	setTasks((prev) => prev.filter((t) => t.id !== taskId));

	// locate child tasks referencing parent's TaskID => clear their ParentTask
	const childTasks = tasks.filter((t) => t.fields.ParentTask === parentUniqueID);
	if (childTasks.length > 0) {
	  try {
		const recordsToPatch = childTasks.map((ct) => ({
		  id: ct.id,
		  fields: { ParentTask: "" },
		}));

		const chunkSize = 10;
		for (let i = 0; i < recordsToPatch.length; i += chunkSize) {
		  const chunk = recordsToPatch.slice(i, i + chunkSize);
		  const patchResp = await fetch(
			`https://api.airtable.com/v0/${baseId}/Tasks`,
			{
			  method: "PATCH",
			  headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			  },
			  body: JSON.stringify({ records: chunk }),
			}
		  );
		  if (!patchResp.ok) {
			throw new Error(
			  `Airtable error (clear children): ${patchResp.status} ${patchResp.statusText}`
			);
		  }
		}

		// Update local
		setTasks((prev) =>
		  prev.map((ct) =>
			ct.fields.ParentTask === parentUniqueID
			  ? { ...ct, fields: { ...ct.fields, ParentTask: "" } }
			  : ct
		  )
		);
	  } catch (err) {
		console.error("Error removing ParentTask from child tasks:", err);
	  }
	}

	// Now delete from Airtable
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
				  CompletedTime: wasCompleted ? t.fields.CompletedTime : null,
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

	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Today: newValue } }
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
  // 8) Organize tasks: top-level vs. sub-tasks
  // --------------------------------------------------------------------------
  const topLevelTasks = tasks.filter((t) => !t.fields.ParentTask);

  // Build a quick subtask map
  const subtasksByParent = {};
  tasks.forEach((t) => {
	const p = t.fields.ParentTask;
	if (p) {
	  if (!subtasksByParent[p]) subtasksByParent[p] = [];
	  subtasksByParent[p].push(t);
	}
  });

  // Sort them
  topLevelTasks.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
  Object.values(subtasksByParent).forEach((arr) =>
	arr.sort((x, y) => (x.fields.SubOrder || 0) - (y.fields.SubOrder || 0))
  );

  // --------------------------------------------------------------------------
  // 9) Handling the single Milestone reference
  // --------------------------------------------------------------------------
  // For each Task, check .fields.MilestoneID => see if we find that milestone
  const getMilestoneForTask = (task) => {
	const milestoneId = task.fields.MilestoneID;
	if (!milestoneId) return null;
	return milestones.find((m) => m.id === milestoneId) || null;
  };

  // Show a modal to pick a Milestone for the given task
  const handlePickMilestone = (task) => {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  };

  // Called by the modal when user picks a milestone
  const assignMilestoneToTask = async (milestone) => {
	if (!activeTaskForMilestone) return;
	try {
	  const updatedTasks = tasks.map((t) =>
		t.id === activeTaskForMilestone.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				MilestoneID: milestone.id,
			  },
			}
		  : t
	  );
	  setTasks(updatedTasks);

	  // Patch the chosen milestone ID to Airtable
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
			  id: activeTaskForMilestone.id,
			  fields: {
				MilestoneID: milestone.id,
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
	  console.error("Error assigning milestone:", err);
	  setError("Failed to assign milestone. Please try again.");
	} finally {
	  setShowMilestoneModal(false);
	  setActiveTaskForMilestone(null);
	}
  };

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
	return (
	  <p className="m-4">
		No idea found for custom ID: <strong>{customIdeaId}</strong>.
	  </p>
	);
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  {/* If modal is open, render it here */}
	  {showMilestoneModal && (
		<PickMilestoneModal
		  allMilestones={milestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelectMilestone={assignMilestoneToTask}
		/>
	  )}

	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your ideas
	  </Link>

	  <h2 className="text-2xl font-bold mt-4">{idea.fields.IdeaTitle}</h2>
	  <p className="mt-2 text-gray-700">{idea.fields.IdeaSummary}</p>

	  {/* Add a new Task */}
	  <form
		className="mt-6"
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

	  <h3 className="text-xl font-semibold mt-6 mb-2">Tasks:</h3>
	  {tasks.length > 0 ? (
		<ul
		  className="divide-y divide-gray-200 border rounded"
		  ref={topLevelRef}
		>
		  {topLevelTasks.map((parent) => {
			const parentCompleted = parent.fields.Completed || false;
			const parentCompletedTime = parent.fields.CompletedTime || null;
			const isTodayParent = parent.fields.Today || false;

			// Single milestone for this parent
			const parentMilestone = getMilestoneForTask(parent);

			// Subtasks
			const childTasks = subtasksByParent[parent.fields.TaskID] || [];

			return (
			  <li key={parent.id} className="p-4 hover:bg-gray-50">
				{/* PARENT TASK ROW */}
				<div className="flex items-center">
				  <div
					className="grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
					title="Drag to reorder parent tasks"
				  >
					<Bars3Icon className="h-5 w-5" />
				  </div>
				  <input
					type="checkbox"
					className="mr-2"
					checked={parentCompleted}
					onChange={() => handleToggleCompleted(parent)}
				  />
				  <div className="flex-1">
					{editingTaskId === parent.id ? (
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

				{/* MILESTONE for THIS PARENT TASK */}
				<div className="ml-6 mt-2 pl-3 border-l border-gray-200">
				  <h4 className="font-semibold text-sm">Milestone:</h4>
				  {parentMilestone ? (
					<p className="text-sm">
					  <strong>{parentMilestone.fields.MilestoneName}</strong>
					</p>
				  ) : (
					<p className="text-sm text-blue-600 underline cursor-pointer"
					  onClick={() => handlePickMilestone(parent)}
					>
					  No milestone yet. (Click to add)
					</p>
				  )}
				</div>

				{/* SUBTASK LIST */}
				{childTasks.length > 0 && (
				  <ul
					ref={(el) => (subtaskRefs.current[parent.id] = el)}
					className="ml-6 mt-2 border-l border-gray-200"
				  >
					{childTasks.map((sub) => {
					  const subCompleted = sub.fields.Completed || false;
					  const subCompletedTime = sub.fields.CompletedTime || null;
					  const subMilestone = getMilestoneForTask(sub);

					  return (
						<li
						  key={sub.id}
						  className="py-2 pl-3 hover:bg-gray-50"
						>
						  <div className="flex items-center">
							<div
							  className="sub-grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
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
							  {editingTaskId === sub.id ? (
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
									else if (e.key === "Escape")
									  cancelEditing();
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
								  {new Date(
									subCompletedTime
								  ).toLocaleString()}
								  )
								</span>
							  )}
							</div>
						  </div>

						  {/* MILESTONE for this subtask */}
						  <div className="ml-6 mt-1 pl-3 border-l border-gray-200">
							<h4 className="font-semibold text-sm">
							  Milestone:
							</h4>
							{subMilestone ? (
							  <p className="text-sm">
								<strong>
								  {subMilestone.fields.MilestoneName}
								</strong>
							  </p>
							) : (
							  <p
								className="text-sm text-blue-600 underline cursor-pointer"
								onClick={() => handlePickMilestone(sub)}
							  >
								No milestone yet. (Click to add)
							  </p>
							)}
						  </div>
						</li>
					  );
					})}
				  </ul>
				)}

				{/* BUTTON to create a new subtask for this parent */}
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
