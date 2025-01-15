// File: /src/TodayView.js

import React, { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";

// (Optional) A simple placeholder for a milestone picker
// In a real app, you'd create a modal like in IdeaDetail or do an inline select.
function MilestonePickerModal({ allMilestones, onClose, onSelect }) {
  return (
	<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
	  <div className="bg-white p-4 rounded shadow-lg w-80">
		<h3 className="font-bold mb-2">Pick a Milestone</h3>
		<ul className="divide-y max-h-64 overflow-y-auto">
		  {allMilestones.map((m) => (
			<li key={m.id}>
			  <button
				onClick={() => onSelect(m)}
				className="w-full text-left py-2 px-2 hover:bg-gray-100"
			  >
				{m.fields.MilestoneName || "(Untitled)"}
			  </button>
			</li>
		  ))}
		</ul>
		<button
		  className="mt-3 px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
		  onClick={onClose}
		>
		  Cancel
		</button>
	  </div>
	</div>
  );
}

function TodayView() {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [milestones, setMilestones] = useState([]); // <-- fetch all milestones
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For inline editing tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // For optional milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // Refs for sorting
  const ideasListRef = useRef(null);
  const tasksSortableRefs = useRef({});
  const subtaskSortableRefs = useRef({});

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch tasks + ideas + milestones => tasks sorted by "OrderToday" & "SubOrder"
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

		// A) Fetch tasks
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

		// B) Fetch Ideas
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

		// C) Fetch Milestones
		const milestonesUrl = `https://api.airtable.com/v0/${baseId}/Milestones?sort%5B0%5D%5Bfield%5D=MilestoneName&sort%5B0%5D%5Bdirection%5D=asc`;
		const milestonesResp = await fetch(milestonesUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!milestonesResp.ok) {
		  throw new Error(
			`Milestones error: ${milestonesResp.status} ${milestonesResp.statusText}`
		  );
		}
		const milestonesData = await milestonesResp.json();
		setMilestones(milestonesData.records);
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

  // We'll show only ideas that have at least one parent task with Today=true
  const relevantIdeas = ideas.filter((idea) => {
	const ideaId = idea.id;
	const tasksForIdea = tasksByIdea[ideaId] || [];
	return tasksForIdea.some(
	  (tsk) => tsk.fields.Today && !tsk.fields.ParentTask
	);
  });

  // --------------------------------------------------------------------------
  // 3) Reorder the *Ideas* themselves
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

	const updated = [...relevantIdeas];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// merge them back with non-relevant
	const nonRelevant = ideas.filter((id) => !relevantIdeas.includes(id));
	const reordered = [...nonRelevant, ...updated];

	// reassign "OrderToday"
	reordered.forEach((idea, i) => {
	  idea.fields.OrderToday = i + 1;
	});

	setIdeas(reordered);

	// patch to Airtable
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

	// Patch in chunks of 10
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
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 4) Reorder parent tasks by "OrderToday"
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

	const tasksForIdea = tasksByIdea[ideaId] || [];
	const parentToday = tasksForIdea.filter(
	  (t) => t.fields.Today && !t.fields.ParentTask
	);

	if (oldIndex < 0 || oldIndex >= parentToday.length) return;
	if (newIndex < 0 || newIndex >= parentToday.length) return;

	const updated = [...parentToday];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// reassign "OrderToday"
	updated.forEach((task, idx) => {
	  task.fields.OrderToday = idx + 1;
	});

	// merge with all other tasks
	const otherTasks = tasks.filter(
	  (t) =>
		!(t.fields.IdeaID === ideaId && t.fields.Today && !t.fields.ParentTask)
	);
	const reordered = [...otherTasks, ...updated];
	setTasks(reordered);

	// patch
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
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
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
		// This is a parent task in Today
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

	const parentId = parentTask.fields.TaskID;
	const mySubtasks = tasks.filter((t) => t.fields.ParentTask === parentId);

	if (oldIndex < 0 || oldIndex >= mySubtasks.length) return;
	if (newIndex < 0 || newIndex >= mySubtasks.length) return;

	const updated = [...mySubtasks];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) return;
	updated.splice(newIndex, 0, moved);

	// reassign "SubOrder"
	updated.forEach((sub, idx) => {
	  sub.fields.SubOrder = idx + 1;
	});

	// merge with the rest
	const others = tasks.filter((t) => t.fields.ParentTask !== parentId);
	const newAll = [...others, ...updated];
	setTasks(newAll);

	// patch
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
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// local update (optimistic)
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

	// patch to Airtable
	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const patchResp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks`,
		{
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
		}
	  );
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
	  const patchResp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks`,
		{
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
		}
	  );
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
  // 7) Inline editing => "XXX" => delete parent + orphan children
  // --------------------------------------------------------------------------
  const startEditingTask = (task) => {
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName);
  };

  const handleEditNameChange = (val) => {
	setEditingTaskName(val);
  };

  const commitEdit = async (taskId) => {
	// If user typed "XXX", we do a special delete
	if (editingTaskName.trim().toUpperCase() === "XXX") {
	  await handleDeleteTask(taskId);
	  return;
	}

	// Normal rename
	const updatedTasks = tasks.map((t) =>
	  t.id === taskId
		? { ...t, fields: { ...t.fields, TaskName: editingTaskName } }
		: t
	);
	setTasks(updatedTasks);
	setEditingTaskId(null);
	setEditingTaskName("");

	// Patch to Airtable
	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const patchResp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks`,
		{
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
		}
	  );
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
  // 8) handleDeleteTask => remove parent, orphan children
  // --------------------------------------------------------------------------
  const handleDeleteTask = async (taskId) => {
	const toDelete = tasks.find((t) => t.id === taskId);
	if (!toDelete) return;

	const parentUniqueID = toDelete.fields.TaskID;

	// remove parent from local
	setTasks((prev) => prev.filter((t) => t.id !== taskId));

	// locate child tasks referencing the parent's TaskID => clear their ParentTask
	const childTasks = tasks.filter((t) => t.fields.ParentTask === parentUniqueID);
	if (childTasks.length > 0) {
	  try {
		const recordsToPatch = childTasks.map((ct) => ({
		  id: ct.id,
		  fields: {
			ParentTask: "", // orphan them
		  },
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

		// also update local => remove ParentTask from children
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
	  }
	}

	// now delete the parent from Airtable
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
	  console.log(`Task ${taskId} was deleted (due to 'XXX'), children orphaned.`);
	} catch (err) {
	  console.error("Error deleting task from Airtable:", err);
	  setError("Failed to delete the task from Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  // 9) Single milestone approach => a helper to find a milestone for each task
  // --------------------------------------------------------------------------
  const getTaskMilestone = (task) => {
	if (!task.fields.MilestoneID) return null;
	return milestones.find((m) => m.id === task.fields.MilestoneID) || null;
  };

  // Optional: function to handle picking a milestone
  const handlePickMilestone = (task) => {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  };

  // Called when user selects a milestone in the modal
  const assignMilestoneToTask = async (milestone) => {
	if (!activeTaskForMilestone) return;
	try {
	  // local update
	  const updated = tasks.map((t) =>
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
	  setTasks(updated);

	  // patch to Airtable
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
		  `Airtable error (assign milestone): ${patchResp.status} ${patchResp.statusText}`
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
	  {/* Milestone Modal if needed */}
	  {showMilestoneModal && (
		<MilestonePickerModal
		  allMilestones={milestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		/>
	  )}

	  <h2 className="text-2xl font-bold mb-4">Tasks for Today</h2>
	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your Ideas
	  </Link>

	  {/* Sortable UL for the RELEVANT IDEAS */}
	  <ul ref={ideasListRef} className="mt-4 space-y-4">
		{relevantIdeas.map((idea) => {
		  const ideaId = idea.id;
		  const ideaTitle = idea.fields.IdeaTitle || "Untitled Idea";

		  const tasksForIdea = tasksByIdea[ideaId] || [];
		  // filter only the parent tasks with Today==true
		  const parentToday = tasksForIdea.filter(
			(t) => t.fields.Today && !t.fields.ParentTask
		  );

		  return (
			<li key={ideaId} className="bg-gray-50 p-3 rounded shadow">
			  {/* "Handle" to reorder the Idea block */}
			  <div
				className="idea-drag-handle cursor-grab active:cursor-grabbing text-gray-400 flex items-center space-x-2 mb-1"
				title="Drag to reorder ideas"
			  >
				<Bars3Icon className="w-4 h-4" />
				<h3 className="text-xl font-semibold">{ideaTitle}</h3>
			  </div>

			  {/* Sortable UL for parent tasks */}
			  <ul
				id={`tasks-ul-${idea.id}`}
				className="border rounded divide-y divide-gray-200"
			  >
				{parentToday.map((task) => {
				  const isEditing = editingTaskId === task.id;
				  const isCompleted = task.fields.Completed || false;
				  const completedTime = task.fields.CompletedTime || null;

				  // All subtasks for this parent
				  const subList = subtasksByParent[task.fields.TaskID] || [];

				  // Single milestone for this Task
				  const milestone = getTaskMilestone(task);

				  return (
					<li key={task.id} className="p-4 hover:bg-gray-50">
					  {/* PARENT TASK ROW */}
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
						{/* Name (inline edit => "XXX" => delete) */}
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
						{/* Today toggle */}
						<div className="ml-2 flex items-center space-x-1">
						  <input
							type="checkbox"
							checked={task.fields.Today || false}
							onChange={() => handleToggleToday(task)}
						  />
						  <label className="text-sm">Today</label>
						</div>
					  </div>

					  {/* MILESTONE => single reference */}
					  <div className="ml-6 mt-2 pl-3 border-l border-gray-200">
						<h4 className="text-sm font-semibold">Milestone:</h4>
						{milestone ? (
						  <p className="text-sm text-blue-600">
							{milestone.fields.MilestoneName}
						  </p>
						) : (
						  <p
							className="text-sm text-blue-600 underline cursor-pointer"
							onClick={() => handlePickMilestone(task)}
						  >
							No milestone yet (click to add)
						  </p>
						)}
					  </div>

					  {/* SUBTASKS => each sorted by "SubOrder" */}
					  {subList.length > 0 && (
						<ul
						  id={`subtasks-ul-${task.id}`}
						  className="ml-6 mt-2 border-l border-gray-200"
						>
						  {subList.map((sub) => {
							const subIsEditing = editingTaskId === sub.id;
							const subCompleted = sub.fields.Completed || false;
							const subCompletedTime = sub.fields.CompletedTime || null;
							const subMilestone = getTaskMilestone(sub);

							return (
							  <li
								key={sub.id}
								className="py-2 pl-3 hover:bg-gray-50 flex flex-col"
							  >
								<div className="flex items-center">
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
										onClick={() => startEditingTask(sub)}
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
								</div>

								{/* Single milestone for subtask */}
								<div className="ml-6 mt-1 pl-3 border-l border-gray-200">
								  <h4 className="text-sm font-semibold">
									Milestone:
								  </h4>
								  {subMilestone ? (
									<p className="text-xs text-blue-600">
									  {subMilestone.fields.MilestoneName}
									</p>
								  ) : (
									<p
									  className="text-xs text-blue-600 underline cursor-pointer"
									  onClick={() => handlePickMilestone(sub)}
									>
									  No milestone yet (click to add)
									</p>
								  )}
								</div>
							  </li>
							);
						  })}
						</ul>
					  )}
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
