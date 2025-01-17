// File: /src/IdeaDetail.jsx

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Sortable from "sortablejs";

import TaskProgressBar from "./TaskProgressBar";
import MilestoneModal from "./MilestoneModal";

function IdeaDetail({ airtableUser }) {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inline editing
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // Creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");

  // The userId from the Airtable user record
  const userId = airtableUser?.fields?.UserID || null;

  const { customIdeaId } = useParams();
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Sortable ref for uncompleted top-level tasks
  const topLevelListRef = useRef(null);
  const topLevelSortableRef = useRef(null);

  // Refs for subtask lists => subtaskRefs.current[parentTaskID] = DOM <ul>
  const subtaskRefs = useRef({});

  // ------------------------------------------------------------------
  // 1) Fetch Idea + Tasks + Milestones
  // ------------------------------------------------------------------
  useEffect(() => {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  setLoading(false);
	  return;
	}
	if (!userId) {
	  setError("No user ID found. Please log in again.");
	  setLoading(false);
	  return;
	}

	fetchData();
  }, [baseId, apiKey, customIdeaId, userId]);

  async function fetchData() {
	try {
	  setLoading(true);
	  setError(null);

	  // A) Fetch Idea by {IdeaID} = customIdeaId (still no user check here,
	  //    since the idea might have a unique custom ID)
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
		throw new Error(`No Idea found for custom ID: ${customIdeaId}`);
	  }
	  setIdea(ideaData.records[0]);

	  // B) Fetch Tasks => only tasks with {IdeaID}=customIdeaId AND {UserID}=userId
	  const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
	  tasksUrl.searchParams.set(
		"filterByFormula",
		`AND({IdeaID}="${customIdeaId}", {UserID}="${userId}")`
	  );
	  // Sort tasks by Order asc
	  tasksUrl.searchParams.set("sort[0][field]", "Order");
	  tasksUrl.searchParams.set("sort[0][direction]", "asc");

	  const tasksResp = await fetch(tasksUrl.toString(), {
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!tasksResp.ok) {
		throw new Error(
		  `Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`
		);
	  }
	  const tasksData = await tasksResp.json();
	  const mappedTasks = tasksData.records.map((r) => ({
		id: r.id,
		fields: r.fields,
	  }));
	  setTasks(mappedTasks);

	  // C) Fetch all Milestones => optional filter by user
	  const msUrl = new URL(`https://api.airtable.com/v0/${baseId}/Milestones`);
	  msUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
	  const msResp = await fetch(msUrl.toString(), {
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!msResp.ok) {
		throw new Error(
		  `Airtable error (Milestones): ${msResp.status} ${msResp.statusText}`
		);
	  }
	  const msData = await msResp.json();
	  setAllMilestones(msData.records);

	} catch (err) {
	  console.error("Error fetching data:", err);
	  setError(err.message || "Failed to load data.");
	} finally {
	  setLoading(false);
	}
  }

  // ------------------------------------------------------------------
  // 2) Auto-sort logic => uncompleted tasks at top, completed after
  // ------------------------------------------------------------------
  function getSortedTopLevel() {
	// top-level => tasks with no ParentTask
	const top = tasks.filter((t) => !t.fields.ParentTask);
	const incomplete = top.filter((t) => !t.fields.Completed);
	const completed = top.filter((t) => t.fields.Completed);

	// incomplete => sort by .Order ascending
	incomplete.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));

	// completed => sort by CompletedTime desc
	completed.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});

	return [...incomplete, ...completed];
  }

  function getSortedSubtasks(parentID) {
	const subs = tasks.filter((t) => t.fields.ParentTask === parentID);
	const inc = subs.filter((s) => !s.fields.Completed);
	const comp = subs.filter((s) => s.fields.Completed);

	// uncompleted => sort by SubOrder ascending
	inc.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));

	// completed => CompletedTime desc
	comp.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});

	return [...inc, ...comp];
  }

  // ------------------------------------------------------------------
  // 3) Sortable for uncompleted top-level tasks
  // ------------------------------------------------------------------
  useEffect(() => {
	if (!loading && tasks.length > 0 && topLevelListRef.current) {
	  if (!topLevelSortableRef.current) {
		topLevelSortableRef.current = new Sortable(topLevelListRef.current, {
		  animation: 150,
		  handle: ".drag-handle",
		  onEnd: handleTopLevelSortEnd,
		});
	  }
	}
	return () => {
	  if (topLevelSortableRef.current) {
		topLevelSortableRef.current.destroy();
		topLevelSortableRef.current = null;
	  }
	};
  }, [loading, tasks]);

  async function handleTopLevelSortEnd(evt) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	// We'll reorder only uncompleted tasks
	const top = tasks.filter((t) => !t.fields.ParentTask);
	const incomplete = top.filter((t) => !t.fields.Completed);
	const completed = top.filter((t) => t.fields.Completed);

	const updatedInc = [...incomplete];
	const [movedItem] = updatedInc.splice(oldIndex, 1);
	updatedInc.splice(newIndex, 0, movedItem);

	updatedInc.forEach((t, idx) => {
	  t.fields.Order = idx + 1;
	});

	const mergedTop = [...updatedInc, ...completed];
	const subs = tasks.filter((t) => t.fields.ParentTask);
	const newAll = [...mergedTop, ...subs];
	setTasks(newAll);

	try {
	  await patchOrderToAirtable(updatedInc);
	} catch (err) {
	  console.error("Error reordering top-level tasks:", err);
	  setError("Failed to reorder tasks. Please refresh.");
	}
  }

  async function patchOrderToAirtable(incompleteArr) {
	if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

	// Chunk in groups of 10
	const chunkSize = 10;
	for (let i = 0; i < incompleteArr.length; i += chunkSize) {
	  const chunk = incompleteArr.slice(i, i + chunkSize);
	  const records = chunk.map((t) => ({
		id: t.id,
		fields: { Order: t.fields.Order },
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
	}
  }

  // ------------------------------------------------------------------
  // 3b) Sortable for each subtask list
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0) {
	  const parentTasks = tasks.filter((t) => !t.fields.ParentTask);
	  parentTasks.forEach((p) => {
		const subListEl = subtaskRefs.current[p.id];
		if (!subListEl) return;

		// only reorder incomplete subtasks
		const incompleteSubs = tasks.filter(
		  (s) => s.fields.ParentTask === p.fields.TaskID && !s.fields.Completed
		);
		if (incompleteSubs.length === 0) return;

		if (subListEl._sortable) {
		  subListEl._sortable.destroy();
		}

		subListEl._sortable = new Sortable(subListEl, {
		  animation: 150,
		  handle: ".sub-drag-handle",
		  onEnd: (evt) => handleSubtaskSortEnd(evt, p),
		});
	  });
	}

	return () => {
	  Object.values(subtaskRefs.current).forEach((el) => {
		if (el && el._sortable) {
		  el._sortable.destroy();
		}
	  });
	};
  }, [loading, tasks]);

  async function handleSubtaskSortEnd(evt, parentTask) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const incSubs = tasks.filter(
	  (s) =>
		s.fields.ParentTask === parentTask.fields.TaskID && !s.fields.Completed
	);

	const updatedSubs = [...incSubs];
	const [movedItem] = updatedSubs.splice(oldIndex, 1);
	updatedSubs.splice(newIndex, 0, movedItem);

	updatedSubs.forEach((sub, idx) => {
	  sub.fields.SubOrder = idx + 1;
	});

	const otherTasks = tasks.filter(
	  (t) => t.fields.ParentTask !== parentTask.fields.TaskID
	);
	const newAll = [...otherTasks, ...updatedSubs];
	setTasks(newAll);

	try {
	  await patchSubOrderInAirtable(updatedSubs);
	} catch (err) {
	  console.error("Error reordering subtasks:", err);
	  setError("Failed to reorder subtasks. Please refresh.");
	}
  }

  async function patchSubOrderInAirtable(subArr) {
	if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

	const chunkSize = 10;
	for (let i = 0; i < subArr.length; i += chunkSize) {
	  const chunk = subArr.slice(i, i + chunkSize);
	  const records = chunk.map((s) => ({
		id: s.id,
		fields: { SubOrder: s.fields.SubOrder },
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
		throw new Error(
		  `Airtable error (subtasks): ${resp.status} ${resp.statusText}`
		);
	  }
	}
  }

  // ------------------------------------------------------------------
  // 4) Create new top-level Task => top of uncompleted
  // ------------------------------------------------------------------
  async function handleCreateTopLevelTask(e) {
	e.preventDefault();
	const trimmed = newTaskName.trim();
	if (!trimmed) return;

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

	  // SHIFT uncompleted tasks => +1
	  const top = tasks.filter((t) => !t.fields.ParentTask);
	  const incomplete = top.filter((t) => !t.fields.Completed);

	  if (incomplete.length > 0) {
		const shifted = incomplete.map((task) => {
		  task.fields.Order = (task.fields.Order || 0) + 1;
		  return task;
		});
		const completed = top.filter((t) => t.fields.Completed);
		const subs = tasks.filter((t) => t.fields.ParentTask);

		setTasks([...shifted, ...completed, ...subs]);
		await patchOrderToAirtable(shifted);
	  }

	  // Create new at Order=1 => include userId
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "POST",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  fields: {
				TaskName: trimmed,
				IdeaID: idea?.fields?.IdeaID || "",
				ParentTask: "",
				Order: 1,
				UserID: userId, // store the user
			  },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		const airtableError = await resp.json().catch(() => ({}));
		console.error("Airtable create task error:", airtableError);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  const data = await resp.json();
	  const newRec = data.records[0];

	  setTasks((prev) => [...prev, { id: newRec.id, fields: newRec.fields }]);
	  setNewTaskName("");
	} catch (err) {
	  console.error("Error creating new top-level task:", err);
	  setError("Failed to create task. Please refresh.");
	}
  }

  // ------------------------------------------------------------------
  // 5) Delete => we removed the separate delete button approach. 
  //    If your "xxx" approach is in place, do it in your inline editing code. 
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // 6) Toggling Completed
  // ------------------------------------------------------------------
  async function handleToggleCompleted(task) {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	const updated = tasks.map((t) => {
	  if (t.id === task.id) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			Completed: newValue,
			CompletedTime: newTime,
		  },
		};
	  }
	  return t;
	});
	setTasks(updated);

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[handleToggleCompleted] error:", airtableError);
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling Completed:", err);
	  setError("Failed to toggle Completed. Please refresh.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) => {
		  if (t.id === task.id) {
			return {
			  ...t,
			  fields: {
				...t.fields,
				Completed: wasCompleted,
				CompletedTime: wasCompleted ? t.fields.CompletedTime : null,
			  },
			};
		  }
		  return t;
		})
	  );
	}
  }

  // ------------------------------------------------------------------
  // 7) Inline Editing
  // ------------------------------------------------------------------
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

  async function commitTaskNameEdit(task) {
	const newName = editingTaskName.trim();

	// If the user typed "xxx", do your delete logic here if you want
	if (newName.toLowerCase() === "xxx") {
	  // e.g. deleteTask(task)
	  cancelEditingTask();
	  return;
	}

	const updated = tasks.map((t) => {
	  if (t.id === task.id) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			TaskName: newName || "(No Name)",
		  },
		};
	  }
	  return t;
	});
	setTasks(updated);

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
				TaskName: newName || "(No Name)",
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[commitTaskNameEdit] error:", airtableError);
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error updating TaskName:", err);
	  setError("Failed to update task name. Please refresh.");
	} finally {
	  cancelEditingTask();
	}
  }

  // ------------------------------------------------------------------
  // 8) Toggle Focus
  // ------------------------------------------------------------------
  async function handleToggleFocus(task) {
	const wasFocusToday = task.fields.Focus === "today";
	const newValue = wasFocusToday ? "" : "today";

	// optimistic local update
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				Focus: newValue,
			  },
			}
		  : t
	  )
	);

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
				Focus: newValue,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[handleToggleFocus] error:", airtableError);
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling Focus:", err);
	  setError("Failed to toggle Focus. Please refresh.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  Focus: wasFocusToday ? "today" : "",
				},
			  }
			: t
		)
	  );
	}
  }

  // ------------------------------------------------------------------
  // 9) Milestone picking
  // ------------------------------------------------------------------
  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
	if (!activeTaskForMilestone) return;
	const targetTask = activeTaskForMilestone;
	setShowMilestoneModal(false);
	setActiveTaskForMilestone(null);

	// local update
	const updated = tasks.map((t) => {
	  if (t.id === targetTask.id) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			MilestoneID: milestone.fields.MilestoneID,
		  },
		};
	  }
	  return t;
	});
	setTasks(updated);

	// Patch
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: targetTask.id,
			  fields: {
				MilestoneID: milestone.fields.MilestoneID,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[assignMilestoneToTask] error:", airtableError);
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error assigning milestone:", err);
	  setError("Failed to assign milestone. Please refresh.");
	}
  }

  async function removeMilestoneFromTask(task) {
	if (!task) return;
	// local update => clear
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, MilestoneID: "" } }
		  : t
	  )
	);

	// patch
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
			  fields: { MilestoneID: "" },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error removing milestone:", err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

  // ------------------------------------------------------------------
  // 10) Create Subtask
  // ------------------------------------------------------------------
  async function createSubtask(parentTask) {
	if (!parentTask) return;
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	  const parentTaskID = parentTask.fields.TaskID || null;
	  if (!parentTaskID) {
		throw new Error("Parent task lacks a TaskID field.");
	  }

	  // We'll store SubOrder as childSubs.length + 1
	  const childSubs = tasks.filter((t) => t.fields.ParentTask === parentTaskID);
	  const nextSubOrder = childSubs.length + 1;

	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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
				ParentTask: parentTaskID,
				IdeaID: parentTask.fields.IdeaID,
				UserID: userId,
				SubOrder: nextSubOrder,
			  },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		const airtableError = await resp.json().catch(() => ({}));
		console.error("[createSubtask] error:", airtableError);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  const data = await resp.json();
	  const newRecord = data.records[0];

	  setTasks((prev) => [...prev, { id: newRecord.id, fields: newRecord.fields }]);
	} catch (err) {
	  console.error("Error creating subtask:", err);
	  setError("Failed to create subtask. Please refresh.");
	}
  }

  // ------------------------------------------------------------------
  // 11) Task progress
  // ------------------------------------------------------------------
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.fields.Completed).length;
  const percentage =
	totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Final top-level array => uncompleted then completed
  const finalTopTasks = getSortedTopLevel();

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading data...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (!idea) {
	return (
	  <p className="m-4">
		No idea found for custom ID: <strong>{customIdeaId}</strong>
	  </p>
	);
  }

  const ideaTitle = idea.fields.IdeaTitle || "(Untitled Idea)";

  return (
	<div className="container p-4">
	  {/* Milestone Modal */}
	  {showMilestoneModal && (
		<MilestoneModal
		  allMilestones={allMilestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		  onRemove={() => removeMilestoneFromTask(activeTaskForMilestone)}
		/>
	  )}

	  {/* Back link above the Title */}
	  <Link to="/" className="text-blue-600 underline">
		← Back
	  </Link>
	  <h2 className="text-2xl font-bold mt-2">{ideaTitle}</h2>

	  {/* Progress bar */}
	  <TaskProgressBar
		completedTasks={completedTasks}
		totalTasks={totalTasks}
		percentage={percentage}
	  />

	  {/* New top-level Task form */}
	  <form onSubmit={handleCreateTopLevelTask} className="mt-4 flex gap-2">
		<input
		  type="text"
		  placeholder="New top-level task..."
		  value={newTaskName}
		  onChange={(e) => setNewTaskName(e.target.value)}
		  className="border border-gray-300 rounded px-2 py-1 flex-1"
		/>
		<button
		  type="submit"
		  className="bg-green-600 text-white px-3 rounded hover:bg-green-700"
		>
		  Add
		</button>
	  </form>

	  <h3 className="mt-4 text-lg font-semibold">Tasks:</h3>
	  {finalTopTasks.length === 0 ? (
		<p className="text-gray-600">No tasks yet.</p>
	  ) : (
		<ul ref={topLevelListRef} className="space-y-3 mt-2">
		  {finalTopTasks.map((task) => {
			const {
			  TaskName,
			  Completed,
			  CompletedTime,
			  Focus,
			  TaskID,
			  MilestoneID,
			  MilestoneName,
			} = task.fields;

			const isEditing = editingTaskId === task.id;
			const titleClasses = `font-semibold ${
			  Completed ? "line-through text-gray-500" : ""
			}`;

			let completedLabel = "";
			if (Completed && CompletedTime) {
			  try {
				const d = new Date(CompletedTime);
				completedLabel = d.toLocaleString();
			  } catch {
				completedLabel = "Invalid date";
			  }
			}

			const focusEmoji = Focus === "today" ? "☀️" : "💤";

			let milestoneRow = null;
			if (MilestoneID) {
			  let mileName = MilestoneName || "";
			  if (!mileName) {
				const foundM = allMilestones.find(
				  (m) => m.fields.MilestoneID === MilestoneID
				);
				mileName = foundM?.fields?.MilestoneName || "(Unknown Milestone)";
			  }
			  milestoneRow = (
				<div className="group mb-1 inline-flex items-center">
				  <p className="text-sm text-blue-700 font-semibold">
					🏔{" "}
					<Link
					  to={`/milestones/${MilestoneID}`}
					  className="underline"
					>
					  {mileName}
					</Link>
				  </p>
				  <span
					className="
					  ml-2 
					  text-xs 
					  text-blue-600 
					  underline 
					  cursor-pointer 
					  hidden 
					  group-hover:inline-block
					"
					onClick={() => handlePickMilestone(task)}
				  >
					Edit
				  </span>
				</div>
			  );
			} else {
			  milestoneRow = (
				<p
				  className="text-sm text-blue-600 underline mb-1 cursor-pointer"
				  onClick={() => handlePickMilestone(task)}
				>
				  Add Milestone
				</p>
			  );
			}

			const childTasks = getSortedSubtasks(TaskID);

			return (
			  <li
				key={task.id}
				className="border border-gray-300 rounded p-3"
			  >
				{milestoneRow}

				<div className="flex items-center gap-2">
				  {!Completed && (
					<div
					  className="drag-handle text-gray-400 cursor-grab active:cursor-grabbing"
					  title="Drag to reorder"
					>
					  ⇅
					</div>
				  )}

				  <span
					className="cursor-pointer"
					onClick={() => handleToggleFocus(task)}
					title="Click to toggle Focus"
				  >
					{focusEmoji}
				  </span>

				  <input
					type="checkbox"
					checked={!!Completed}
					onChange={() => handleToggleCompleted(task)}
				  />

				  {isEditing ? (
					<input
					  type="text"
					  value={editingTaskName}
					  onChange={(e) => setEditingTaskName(e.target.value)}
					  onBlur={() => commitTaskNameEdit(task)}
					  onKeyDown={(e) => {
						if (e.key === "Enter") {
						  commitTaskNameEdit(task);
						} else if (e.key === "Escape") {
						  cancelEditingTask();
						}
					  }}
					  autoFocus
					  className="border-b border-gray-300 focus:outline-none"
					/>
				  ) : (
					<span
					  className={titleClasses}
					  onClick={() => startEditingTask(task)}
					>
					  {TaskName || "Untitled Task"}
					</span>
				  )}
				</div>

				{Completed && completedLabel && (
				  <p className="text-xs text-gray-500 ml-6 mt-1">
					{completedLabel}
				  </p>
				)}

				<div className="ml-6 mt-1">
				  <span
					className="text-xs text-blue-600 underline cursor-pointer"
					onClick={() => createSubtask(task)}
				  >
					+ Add Subtask
				  </span>
				</div>

				{childTasks.length > 0 && (
				  <ul
					className="mt-2 ml-6 border-l border-gray-200 space-y-2"
					ref={(el) => (subtaskRefs.current[task.id] = el)}
				  >
					{childTasks.map((sub) => {
					  const subId = sub.id;
					  const {
						TaskName: subName,
						Completed: subCompleted,
						CompletedTime: subCT,
						Focus: subFocus,
						MilestoneID: subMileID,
						MilestoneName: subMileName,
					  } = sub.fields;

					  const isEditingSub = editingTaskId === subId;
					  const subTitleClasses = subCompleted
						? "line-through text-gray-500"
						: "";

					  let subCompletedLabel = "";
					  if (subCompleted && subCT) {
						try {
						  const d = new Date(subCT);
						  subCompletedLabel = d.toLocaleString();
						} catch {
						  subCompletedLabel = "Invalid date";
						}
					  }

					  const subFocusEmoji =
						subFocus === "today" ? "☀️" : "💤";

					  let subMilesRow = null;
					  if (subMileID) {
						let actualName = subMileName || "";
						if (!actualName) {
						  const fm = allMilestones.find(
							(m) => m.fields.MilestoneID === subMileID
						  );
						  actualName =
							fm?.fields?.MilestoneName || "(Unknown)";
						}
						subMilesRow = (
						  <div className="group mb-1 inline-flex items-center">
							<p className="text-sm text-blue-700 font-semibold">
							  🏔{" "}
							  <Link
								to={`/milestones/${subMileID}`}
								className="underline"
							  >
								{actualName}
							  </Link>
							</p>
							<span
							  className="
								ml-2
								text-xs
								text-blue-600
								underline
								cursor-pointer
								hidden
								group-hover:inline-block
							  "
							  onClick={() => handlePickMilestone(sub)}
							>
							  Edit
							</span>
						  </div>
						);
					  }

					  return (
						<li
						  key={subId}
						  className="pl-2 border-b last:border-b-0 pb-2"
						>
						  {subMilesRow}

						  <div className="flex items-center gap-2">
							{!subCompleted && (
							  <div
								className="sub-drag-handle text-gray-400 cursor-grab active:cursor-grabbing"
								title="Drag to reorder subtasks"
							  >
								⇅
							  </div>
							)}

							<span
							  className="cursor-pointer"
							  onClick={() => handleToggleFocus(sub)}
							>
							  {subFocusEmoji}
							</span>

							<input
							  type="checkbox"
							  checked={!!subCompleted}
							  onChange={() => handleToggleCompleted(sub)}
							/>

							{isEditingSub ? (
							  <input
								type="text"
								value={editingTaskName}
								onChange={(e) =>
								  setEditingTaskName(e.target.value)
								}
								onBlur={() => commitTaskNameEdit(sub)}
								onKeyDown={(e) => {
								  if (e.key === "Enter") {
									commitTaskNameEdit(sub);
								  } else if (e.key === "Escape") {
									cancelEditingTask();
								  }
								}}
								autoFocus
								className="border-b border-gray-300 focus:outline-none"
							  />
							) : (
							  <span
								className={subTitleClasses}
								onClick={() => startEditingTask(sub)}
							  >
								{subName || "Untitled Subtask"}
							  </span>
							)}
						  </div>

						  {subCompleted && subCompletedLabel && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  {subCompletedLabel}
							</p>
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
	  )}
	</div>
  );
}

export default IdeaDetail;
