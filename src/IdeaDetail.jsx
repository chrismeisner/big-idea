// File: /Users/chrismeisner/Projects/big-idea/src/IdeaDetail.jsx

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

  // Inline editing for TaskName
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // Inline editing for TaskNote
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // Creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPosition, setNewTaskPosition] = useState("top"); // 'top' or 'bottom'

  const userId = airtableUser?.fields?.UserID || null;
  const { customIdeaId } = useParams();
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Refs for sortable
  const topLevelListRef = useRef(null);
  const topLevelSortableRef = useRef(null);
  const subtaskRefs = useRef({});

  // ─────────────────────────────────────────────────────────────────────────────
  // 1) FETCH DATA (Idea + Tasks + Milestones)
  // ─────────────────────────────────────────────────────────────────────────────
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

	  // A) Fetch the Idea
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

	  // B) Fetch tasks for this idea
	  const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
	  tasksUrl.searchParams.set(
		"filterByFormula",
		`AND({IdeaID}="${customIdeaId}", {UserID}="${userId}")`
	  );
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

	  // C) Fetch all Milestones (for user)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) UTILS: Sorting, Deleting, Creating tasks
  // ─────────────────────────────────────────────────────────────────────────────
  function getSortedTopLevel() {
	const top = tasks.filter((t) => !t.fields.ParentTask);
	const inc = top.filter((t) => !t.fields.Completed);
	const comp = top.filter((t) => t.fields.Completed);

	inc.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
	comp.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return [...inc, ...comp];
  }

  function getSortedSubtasks(parentID) {
	const subs = tasks.filter((t) => t.fields.ParentTask === parentID);
	const inc = subs.filter((s) => !s.fields.Completed);
	const comp = subs.filter((s) => s.fields.Completed);

	inc.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));
	comp.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return [...inc, ...comp];
  }

  async function deleteTask(task) {
	// 1) Remove from local state right away (optimistic removal)
	setTasks((prev) => prev.filter((t) => t.id !== task.id));

	// 2) Delete from Airtable
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	  const delUrl = `https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`;
	  const resp = await fetch(delUrl, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  // If you'd like, re-fetch tasks here. Typically not needed because local state is updated.
	} catch (err) {
	  console.error("Error deleting task =>", err);
	  setError("Failed to delete task. Please refresh.");

	  // Optionally revert local state if needed
	  // setTasks((prev) => [...prev, task]);
	}
  }

  // Top-level task creation
  async function handleCreateTopLevelTask(e) {
	e.preventDefault();
	const trimmed = newTaskName.trim();
	if (!trimmed) return;

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

	  // Shift existing incomplete tasks if adding at the "top"
	  const top = tasks.filter((t) => !t.fields.ParentTask);
	  const incomplete = top.filter((t) => !t.fields.Completed);

	  let newOrder;
	  if (newTaskPosition === "top") {
		// SHIFT existing incomplete tasks by +1
		if (incomplete.length > 0) {
		  const shifted = incomplete.map((task) => ({
			...task,
			fields: {
			  ...task.fields,
			  Order: (task.fields.Order || 0) + 1,
			},
		  }));
		  const completed = top.filter((t) => t.fields.Completed);
		  const subs = tasks.filter((t) => t.fields.ParentTask);
		  setTasks([...shifted, ...completed, ...subs]);
		  await patchOrderToAirtable(shifted);
		}
		newOrder = 1;
	  } else {
		// bottom
		newOrder = incomplete.length + 1;
	  }

	  // Create new record in Airtable
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
				Order: newOrder,
				UserID: userId,
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

  // Helper: patch an array of tasks for updated .Order
  async function patchOrderToAirtable(incompleteArr) {
	if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	const chunkSize = 10;
	for (let i = 0; i < incompleteArr.length; i += chunkSize) {
	  const chunk = incompleteArr.slice(i, i + chunkSize).map((t) => ({
		id: t.id,
		fields: { Order: t.fields.Order },
	  }));
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
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) DRAG-AND-DROP (Top-level & Subtasks)
  // ─────────────────────────────────────────────────────────────────────────────

  // Top-level Sortable
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

	const top = tasks.filter((t) => !t.fields.ParentTask);
	const inc = top.filter((t) => !t.fields.Completed);
	const comp = top.filter((t) => t.fields.Completed);

	const updatedInc = [...inc];
	const [moved] = updatedInc.splice(oldIndex, 1);
	updatedInc.splice(newIndex, 0, moved);

	updatedInc.forEach((t, i) => {
	  t.fields.Order = i + 1;
	});

	const mergedTop = [...updatedInc, ...comp];
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

  // Subtask Sortable
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0) {
	  const parentTasks = tasks.filter((t) => !t.fields.ParentTask);

	  parentTasks.forEach((p) => {
		const subListEl = subtaskRefs.current[p.id];
		if (!subListEl) return;

		const incompleteSubs = tasks.filter(
		  (s) =>
			s.fields.ParentTask === p.fields.TaskID && !s.fields.Completed
		);
		if (incompleteSubs.length === 0) return;

		// Destroy any old instance
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

	updatedSubs.forEach((sub, i) => {
	  sub.fields.SubOrder = i + 1;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 4) TOGGLING COMPLETED / FOCUS / MILESTONES
  // ─────────────────────────────────────────────────────────────────────────────
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
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[handleToggleCompleted] error:", airtableError);
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
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
				CompletedTime: wasCompleted
				  ? t.fields.CompletedTime
				  : null,
			  },
			};
		  }
		  return t;
		})
	  );
	}
  }

  async function handleToggleFocus(task) {
	const wasFocusToday = task.fields.Focus === "today";
	const newValue = wasFocusToday ? "" : "today";

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
				  Focus: newValue,
				},
			  },
			],
		  }),
		}
	  );
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[handleToggleFocus] error:", airtableError);
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
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

  // Linking tasks to milestones
  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
	if (!activeTaskForMilestone) return;
	const targetTask = activeTaskForMilestone;
	setShowMilestoneModal(false);
	setActiveTaskForMilestone(null);

	// local
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

	// patch
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
				id: targetTask.id,
				fields: {
				  MilestoneID: milestone.fields.MilestoneID,
				},
			  },
			],
		  }),
		}
	  );
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[assignMilestoneToTask] error:", airtableError);
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error assigning milestone:", err);
	  setError("Failed to assign milestone. Please refresh.");
	}
  }

  async function removeMilestoneFromTask(task) {
	if (!task) return;
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, MilestoneID: "" } }
		  : t
	  )
	);

	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
				fields: { MilestoneID: "" },
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
	  console.error("Error removing milestone:", err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5) CREATING SUBTASK
  // ─────────────────────────────────────────────────────────────────────────────
  async function createSubtask(parentTask) {
	if (!parentTask) return;
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	  const parentTaskID = parentTask.fields.TaskID || null;
	  if (!parentTaskID) {
		throw new Error("Parent task lacks a TaskID field.");
	  }

	  const childSubs = tasks.filter(
		(t) => t.fields.ParentTask === parentTaskID
	  );
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
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	  const data = await resp.json();
	  const newRecord = data.records[0];

	  setTasks((prev) => [...prev, { id: newRecord.id, fields: newRecord.fields }]);
	} catch (err) {
	  console.error("Error creating subtask:", err);
	  setError("Failed to create subtask. Please refresh.");
	}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6) EDITING TASK NAME & NOTES
  // ─────────────────────────────────────────────────────────────────────────────
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

	// If user typed "xxx" => delete
	if (newName.toLowerCase() === "xxx") {
	  // Delete immediately
	  await deleteTask(task);
	  cancelEditingTask();
	  return;
	}

	// Otherwise rename
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
				  TaskName: newName || "(No Name)",
				},
			  },
			],
		  }),
		}
	  );
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[commitTaskNameEdit] error:", airtableError);
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error updating TaskName:", err);
	  setError("Failed to update task name. Please refresh.");
	} finally {
	  cancelEditingTask();
	}
  }

  function startEditingNotes(task) {
	setEditingNotesTaskId(task.id);
	setEditingNotesText(task.fields.TaskNote || "");
  }

  function cancelEditingNotes() {
	setEditingNotesTaskId(null);
	setEditingNotesText("");
  }

  async function commitTaskNoteEdit(task) {
	const newNotes = editingNotesText.trim();

	// Local update
	const updated = tasks.map((t) => {
	  if (t.id === task.id) {
		return {
		  ...t,
		  fields: {
			...t.fields,
			TaskNote: newNotes,
		  },
		};
	  }
	  return t;
	});
	setTasks(updated);

	// Patch to Airtable
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
				  TaskNote: newNotes,
				},
			  },
			],
		  }),
		}
	  );
	  if (!patchResp.ok) {
		const airtableError = await patchResp.json().catch(() => ({}));
		console.error("[commitTaskNoteEdit] error:", airtableError);
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error updating TaskNote:", err);
	  setError("Failed to update notes. Please refresh.");
	} finally {
	  // Clear out editing UI
	  cancelEditingNotes();
	}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7) TASK PROGRESS
  // ─────────────────────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.fields.Completed).length;
  const percentage =
	totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const finalTopTasks = getSortedTopLevel();

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
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

	  {/* Back link */}
	  <Link to="/" className="text-blue-600 underline">
		← Back
	  </Link>

	  {/* Idea Title */}
	  <h2 className="text-2xl font-bold mt-2">{ideaTitle}</h2>

	  {/* Progress Bar */}
	  <TaskProgressBar
		completedTasks={completedTasks}
		totalTasks={totalTasks}
		percentage={percentage}
	  />

	  {/* New top-level Task form */}
	  <form
		onSubmit={handleCreateTopLevelTask}
		className="mt-4 flex flex-col gap-2 max-w-md"
	  >
		<div className="flex gap-2">
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
		</div>

		<div className="flex items-center space-x-6">
		  <label className="inline-flex items-center space-x-2">
			<input
			  type="radio"
			  name="taskPosition"
			  checked={newTaskPosition === "top"}
			  onChange={() => setNewTaskPosition("top")}
			/>
			<span className="text-sm">Top of list</span>
		  </label>

		  <label className="inline-flex items-center space-x-2">
			<input
			  type="radio"
			  name="taskPosition"
			  checked={newTaskPosition === "bottom"}
			  onChange={() => setNewTaskPosition("bottom")}
			/>
			<span className="text-sm">Bottom of list</span>
		  </label>
		</div>
	  </form>

	  <h3 className="mt-4 text-lg font-semibold">Tasks:</h3>
	  {finalTopTasks.length === 0 ? (
		<p className="text-gray-600">No tasks yet.</p>
	  ) : (
		<ul ref={topLevelListRef} className="space-y-3 mt-2">
		  {finalTopTasks.map((task) => {
			const {
			  TaskName,
			  TaskNote,
			  Completed,
			  CompletedTime,
			  Focus,
			  TaskID,
			  MilestoneID,
			  MilestoneName,
			} = task.fields;

			const isEditingTitle = editingTaskId === task.id;
			const isEditingNotes = editingNotesTaskId === task.id;
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

			// Focus emoji
			const focusEmoji = Focus === "today" ? "☀️" : "💤";

			// Milestone row
			let milestoneRow = null;
			if (MilestoneID) {
			  let mileName = MilestoneName || "";
			  if (!mileName) {
				const foundM = allMilestones.find(
				  (m) => m.fields.MilestoneID === MilestoneID
				);
				mileName =
				  foundM?.fields?.MilestoneName || "(Unknown Milestone)";
			  }
			  milestoneRow = (
				<div className="group mb-1 inline-flex items-center">
				  <p className="text-sm text-blue-700 font-semibold">
					🏔{" "}
					<Link to={`/milestones/${MilestoneID}`} className="underline">
					  {mileName}
					</Link>
				  </p>
				  <span
					className="
					  ml-2 text-xs text-blue-600 underline cursor-pointer
					  hidden group-hover:inline-block
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

			// Subtasks
			const childTasks = getSortedSubtasks(TaskID);

			return (
			  <li key={task.id} className="border border-gray-300 rounded p-3">
				{/* MILESTONE ROW (TOP-LEVEL TASK) */}
				{milestoneRow}

				{/* PARENT TASK ROW */}
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
					title="Toggle Focus"
				  >
					{focusEmoji}
				  </span>

				  <input
					type="checkbox"
					checked={!!Completed}
					onChange={() => handleToggleCompleted(task)}
				  />

				  {/* TaskName => Inline Edit */}
				  {isEditingTitle ? (
					<input
					  type="text"
					  value={editingTaskName}
					  onChange={(e) => setEditingTaskName(e.target.value)}
					  onBlur={() => commitTaskNameEdit(task)}
					  onKeyDown={(e) => {
						if (e.key === "Enter") commitTaskNameEdit(task);
						else if (e.key === "Escape") cancelEditingTask();
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
				  <p className="ml-6 mt-1 text-xs text-gray-500">
					Completed on {completedLabel}
				  </p>
				)}

				{/* NOTES EDITING */}
				<div className="ml-6 mt-2">
				  {isEditingNotes ? (
					<div className="space-y-2">
					  <textarea
						rows={3}
						className="w-full border p-1 rounded"
						value={editingNotesText}
						onChange={(e) => setEditingNotesText(e.target.value)}
					  />
					  <div className="flex space-x-2">
						<button
						  onClick={() => commitTaskNoteEdit(task)}
						  className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
						>
						  Save
						</button>
						<button
						  onClick={cancelEditingNotes}
						  className="text-xs bg-gray-300 px-2 py-1 rounded"
						>
						  Cancel
						</button>
					  </div>
					</div>
				  ) : (
					<>
					  {TaskNote && TaskNote.trim().length > 0 ? (
						<p
						  className="text-sm text-gray-600 cursor-pointer hover:underline"
						  onClick={() => startEditingNotes(task)}
						>
						  {TaskNote}
						</p>
					  ) : (
						<p
						  className="text-xs text-blue-600 underline cursor-pointer"
						  onClick={() => startEditingNotes(task)}
						>
						  + Add Notes
						</p>
					  )}
					</>
				  )}
				</div>

				{/* ADD SUBTASK LINK */}
				{!Completed && (
				  <div className="ml-6 mt-1">
					<span
					  className="text-xs text-blue-600 underline cursor-pointer"
					  onClick={() => createSubtask(task)}
					>
					  + Add Subtask
					</span>
				  </div>
				)}

				{/* SUBTASKS */}
				{childTasks.length > 0 && (
				  <ul
					className="mt-2 ml-6 border-l border-gray-200 space-y-2"
					ref={(el) => (subtaskRefs.current[task.id] = el)}
				  >
					{childTasks.map((sub) => {
					  const {
						TaskName: subName,
						TaskNote: subNotes,
						Completed: subCompleted,
						CompletedTime: subCT,
						Focus: subFocus,
					  } = sub.fields;

					  const isEditingSubTitle = editingTaskId === sub.id;
					  const isEditingSubNotes = editingNotesTaskId === sub.id;

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
					  const subFocusEmoji = subFocus === "today" ? "☀️" : "💤";

					  return (
						<li
						  key={sub.id}
						  className="pl-2 border-b last:border-b-0 pb-2"
						>
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
							  title="Toggle Focus"
							>
							  {subFocusEmoji}
							</span>

							<input
							  type="checkbox"
							  checked={!!subCompleted}
							  onChange={() => handleToggleCompleted(sub)}
							/>

							{isEditingSubTitle ? (
							  <input
								type="text"
								value={editingTaskName}
								onChange={(e) => setEditingTaskName(e.target.value)}
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
							  Completed on {subCompletedLabel}
							</p>
						  )}

						  {/* Subtask NOTES EDIT */}
						  <div className="ml-6 mt-2">
							{isEditingSubNotes ? (
							  <div className="space-y-2">
								<textarea
								  rows={3}
								  className="w-full border p-1 rounded"
								  value={editingNotesText}
								  onChange={(e) =>
									setEditingNotesText(e.target.value)
								  }
								/>
								<div className="flex space-x-2">
								  <button
									onClick={() => commitTaskNoteEdit(sub)}
									className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
								  >
									Save
								  </button>
								  <button
									onClick={cancelEditingNotes}
									className="text-xs bg-gray-300 px-2 py-1 rounded"
								  >
									Cancel
								  </button>
								</div>
							  </div>
							) : (
							  <>
								{subNotes && subNotes.trim().length > 0 ? (
								  <p
									className="text-sm text-gray-600 cursor-pointer hover:underline"
									onClick={() => startEditingNotes(sub)}
								  >
									{subNotes}
								  </p>
								) : (
								  <p
									className="text-xs text-blue-600 underline cursor-pointer"
									onClick={() => startEditingNotes(sub)}
								  >
									+ Add Notes
								  </p>
								)}
							  </>
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
	  )}
	</div>
  );
}

export default IdeaDetail;
