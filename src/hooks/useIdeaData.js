// File: src/hooks/useIdeaData.js

import { useState, useEffect } from "react";

export default function useIdeaData(airtableUser, customIdeaId) {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inline‐editing state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // New top‐level task form
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPosition, setNewTaskPosition] = useState("top");

  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // ──────────── FETCH DATA ────────────
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

	  // A) Idea
	  const ideaResp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Ideas?filterByFormula={IdeaID}="${customIdeaId}"`,
		{ headers: { Authorization: `Bearer ${apiKey}` } }
	  );
	  if (!ideaResp.ok) throw new Error(`Airtable error (Idea): ${ideaResp.status}`);
	  const ideaData = await ideaResp.json();
	  if (ideaData.records.length === 0)
		throw new Error(`No Idea found for custom ID: ${customIdeaId}`);
	  setIdea(ideaData.records[0]);

	  // B) Tasks
	  const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
	  tasksUrl.searchParams.set(
		"filterByFormula",
		`AND({IdeaID}="${customIdeaId}",{UserID}="${userId}")`
	  );
	  tasksUrl.searchParams.set("sort[0][field]", "Order");
	  tasksUrl.searchParams.set("sort[0][direction]", "asc");
	  const tasksResp = await fetch(tasksUrl.toString(), {
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!tasksResp.ok) throw new Error(`Airtable error (Tasks): ${tasksResp.status}`);
	  const tasksData = await tasksResp.json();
	  setTasks(tasksData.records.map((r) => ({ id: r.id, fields: r.fields })));

	  // C) Milestones
	  const msUrl = new URL(`https://api.airtable.com/v0/${baseId}/Milestones`);
	  msUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
	  const msResp = await fetch(msUrl.toString(), {
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!msResp.ok) throw new Error(`Airtable error (Milestones): ${msResp.status}`);
	  const msData = await msResp.json();
	  setAllMilestones(msData.records);
	} catch (err) {
	  console.error(err);
	  setError(err.message || "Failed to load data.");
	} finally {
	  setLoading(false);
	}
  }

  // ──────────── SORT HELPERS ────────────
  function getSortedTopLevel() {
	const top = tasks.filter((t) => !t.fields.ParentTask);
	const inc = top.filter((t) => !t.fields.Completed);
	const comp = top.filter((t) => t.fields.Completed);
	inc.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
	comp.sort((a, b) => {
	  const aTime = a.fields.CompletedTime || "";
	  const bTime = b.fields.CompletedTime || "";
	  return bTime.localeCompare(aTime);
	});
	return [...inc, ...comp];
  }

  function getSortedSubtasks(parentID) {
	const subs = tasks.filter((t) => t.fields.ParentTask === parentID);
	const inc = subs.filter((s) => !s.fields.Completed);
	const comp = subs.filter((s) => s.fields.Completed);
	inc.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));
	comp.sort((a, b) => {
	  const aTime = a.fields.CompletedTime || "";
	  const bTime = b.fields.CompletedTime || "";
	  return bTime.localeCompare(aTime);
	});
	return [...inc, ...comp];
  }

  // ──────────── PATCH HELPERS ────────────
  async function patchOrderToAirtable(arr) {
	const chunkSize = 10;
	for (let i = 0; i < arr.length; i += chunkSize) {
	  const chunk = arr.slice(i, i + chunkSize).map((t) => ({
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
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	}
  }

  async function patchSubOrderInAirtable(arr) {
	const chunkSize = 10;
	for (let i = 0; i < arr.length; i += chunkSize) {
	  const chunk = arr.slice(i, i + chunkSize).map((s) => ({
		id: s.id,
		fields: { SubOrder: s.fields.SubOrder },
	  }));
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({ records: chunk }),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	}
  }

  // ──────────── DRAG & DROP HANDLERS ────────────
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
	setTasks([...updatedInc, ...comp, ...tasks.filter((t) => t.fields.ParentTask)]);
	try {
	  await patchOrderToAirtable(updatedInc);
	} catch (err) {
	  console.error(err);
	  setError("Failed to reorder tasks. Please refresh.");
	}
  }

  async function handleSubtaskSortEnd(evt, parentTask) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;
	const incSubs = tasks.filter(
	  (s) => s.fields.ParentTask === parentTask.fields.TaskID && !s.fields.Completed
	);
	const updatedSubs = [...incSubs];
	const [moved] = updatedSubs.splice(oldIndex, 1);
	updatedSubs.splice(newIndex, 0, moved);
	updatedSubs.forEach((s, i) => {
	  s.fields.SubOrder = i + 1;
	});
	setTasks([
	  ...tasks.filter((t) => t.fields.ParentTask !== parentTask.fields.TaskID),
	  ...updatedSubs,
	]);
	try {
	  await patchSubOrderInAirtable(updatedSubs);
	} catch (err) {
	  console.error(err);
	  setError("Failed to reorder subtasks. Please refresh.");
	}
  }

  // ──────────── CRUD & TOGGLE HANDLERS ────────────
  async function deleteTask(task) {
	setTasks((prev) => prev.filter((t) => t.id !== task.id));
	try {
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to delete task. Please refresh.");
	}
  }

  async function handleCreateTopLevelTask(e) {
	e.preventDefault();
	const name = newTaskName.trim();
	if (!name) return;

	try {
	  // shift others if at top
	  const top = tasks.filter((t) => !t.fields.ParentTask);
	  const incomplete = top.filter((t) => !t.fields.Completed);
	  let newOrder;
	  if (newTaskPosition === "top") {
		if (incomplete.length > 0) {
		  const shifted = incomplete.map((t) => ({
			...t,
			fields: { ...t.fields, Order: (t.fields.Order || 0) + 1 },
		  }));
		  setTasks([...shifted, ...top.filter((t) => t.fields.Completed), ...tasks.filter((t) => t.fields.ParentTask)]);
		  await patchOrderToAirtable(shifted);
		}
		newOrder = 1;
	  } else {
		newOrder = incomplete.length + 1;
	  }

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
				TaskName: name,
				IdeaID: idea.fields.IdeaID,
				ParentTask: "",
				Order: newOrder,
				UserID: userId,
			  },
			},
		  ],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	  const data = await resp.json();
	  setTasks((prev) => [
		...prev,
		{ id: data.records[0].id, fields: data.records[0].fields },
	  ]);
	  setNewTaskName("");
	} catch (err) {
	  console.error(err);
	  setError("Failed to create task. Please refresh.");
	}
  }

  async function handleToggleCompleted(task) {
	const was = task.fields.Completed;
	const now = !was;
	const timestamp = now ? new Date().toISOString() : null;
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Completed: now, CompletedTime: timestamp } }
		  : t
	  )
	);
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
			  fields: { Completed: now, CompletedTime: timestamp },
			},
		  ],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to toggle Completed. Please refresh.");
	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Completed: was, CompletedTime: was ? t.fields.CompletedTime : null } }
			: t
		)
	  );
	}
  }

  async function handleToggleFocus(task) {
	const was = task.fields.Focus === "today";
	const now = was ? "" : "today";
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id ? { ...t, fields: { ...t.fields, Focus: now } } : t
	  )
	);
	try {
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [{ id: task.id, fields: { Focus: now } }],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to toggle Focus. Please refresh.");
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id ? { ...t, fields: { ...t.fields, Focus: was ? "today" : "" } } : t
		)
	  );
	}
  }

  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
	if (!activeTaskForMilestone) return;
	const id = activeTaskForMilestone.id;
	setShowMilestoneModal(false);
	setActiveTaskForMilestone(null);

	setTasks((prev) =>
	  prev.map((t) =>
		t.id === id
		  ? { ...t, fields: { ...t.fields, MilestoneID: milestone.fields.MilestoneID } }
		  : t
	  )
	);
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
			  id,
			  fields: { MilestoneID: milestone.fields.MilestoneID },
			},
		  ],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to assign milestone. Please refresh.");
	}
  }

  async function removeMilestoneFromTask(task) {
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id ? { ...t, fields: { ...t.fields, MilestoneID: "" } } : t
	  )
	);
	try {
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [{ id: task.id, fields: { MilestoneID: "" } }],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

  async function createSubtask(parentTask) {
	const parentID = parentTask.fields.TaskID;
	if (!parentID) return;
	try {
	  const childCount = tasks.filter((t) => t.fields.ParentTask === parentID).length;
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
				ParentTask: parentID,
				IdeaID: parentTask.fields.IdeaID,
				UserID: userId,
				SubOrder: childCount + 1,
			  },
			},
		  ],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	  const data = await resp.json();
	  setTasks((prev) => [
		...prev,
		{ id: data.records[0].id, fields: data.records[0].fields },
	  ]);
	} catch (err) {
	  console.error(err);
	  setError("Failed to create subtask. Please refresh.");
	}
  }

  async function commitTaskNameEdit(task, newName) {
	const trimmed = newName.trim();
	if (trimmed.toLowerCase() === "xxx") {
	  await deleteTask(task);
	  setEditingTaskId(null);
	  setEditingTaskName("");
	  return;
	}
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, TaskName: trimmed || "(No Name)" } }
		  : t
	  )
	);
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
			  fields: { TaskName: trimmed || "(No Name)" },
			},
		  ],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to update task name. Please refresh.");
	} finally {
	  setEditingTaskId(null);
	  setEditingTaskName("");
	}
  }

  async function commitTaskNoteEdit(task, newNotes) {
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, TaskNote: newNotes } }
		  : t
	  )
	);
	try {
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [{ id: task.id, fields: { TaskNote: newNotes } }],
		}),
	  });
	  if (!resp.ok) throw new Error(`Airtable error: ${resp.status}`);
	} catch (err) {
	  console.error(err);
	  setError("Failed to update notes. Please refresh.");
	} finally {
	  setEditingNotesTaskId(null);
	  setEditingNotesText("");
	}
  }

  return {
	idea,
	tasks,
	allMilestones,
	loading,
	error,
	editingTaskId,
	editingTaskName,
	setEditingTaskName,
	editingNotesTaskId,
	editingNotesText,
	setEditingNotesText,
	showMilestoneModal,
	setShowMilestoneModal,
	activeTaskForMilestone,
	setActiveTaskForMilestone,
	newTaskName,
	setNewTaskName,
	newTaskPosition,
	setNewTaskPosition,
	deleteTask,
	handleCreateTopLevelTask,
	handleToggleCompleted,
	handleToggleFocus,
	handlePickMilestone,
	assignMilestoneToTask,
	removeMilestoneFromTask,
	createSubtask,
	commitTaskNameEdit,
	commitTaskNoteEdit,
	getSortedTopLevel,
	getSortedSubtasks,
	handleTopLevelSortEnd,
	handleSubtaskSortEnd,
  };
}
