// File: /src/IdeaDetail.js

import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Bars3Icon } from "@heroicons/react/24/outline";
import MilestoneModal from "./MilestoneModal"; // reuse our existing MilestoneModal

function IdeaDetail({ airtableUser }) {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating a new top-level task
  const [newTaskName, setNewTaskName] = useState("");

  // Inline editing states for tasks
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // —————————————————————————————————————————————————————
  // 1) Title hover/edit logic
  // —————————————————————————————————————————————————————
  const [titleHovered, setTitleHovered] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");

  // —————————————————————————————————————————————————————
  // 2) Summary hover/edit logic
  // —————————————————————————————————————————————————————
  const [summaryHovered, setSummaryHovered] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editingSummary, setEditingSummary] = useState("");

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

  // We’ll also derive the userId from airtableUser:
  const userId = airtableUser?.fields?.UserID || null;

  // --------------------------------------------------------------------------
  //  Fetch Idea, Tasks, and Milestones
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
		console.log("[IdeaDetail] Fetching idea by ID:", customIdeaId);
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
		console.log("[IdeaDetail] Found idea record:", foundIdea);
		setIdea(foundIdea);

		// B) Fetch Tasks for this Idea
		console.log("[IdeaDetail] Fetching tasks for idea:", customIdeaId);
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
		console.log("[IdeaDetail] Fetched tasks count:", tasksData.records.length);
		setTasks(tasksData.records);

		// C) Fetch ALL Milestones
		console.log("[IdeaDetail] Fetching all milestones...");
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
		console.log(
		  "[IdeaDetail] Fetched milestones count:",
		  milestonesData.records.length
		);
		setMilestones(milestonesData.records);
	  } catch (err) {
		console.error("[IdeaDetail] Error fetching idea/tasks/milestones:", err);
		setError("Failed to fetch idea details. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey, customIdeaId]);

  // --------------------------------------------------------------------------
  //  Initialize Sortable for top-level tasks - only after data is loaded
  // --------------------------------------------------------------------------
  useLayoutEffect(() => {
	if (
	  !loading &&
	  tasks.length > 0 &&
	  topLevelRef.current &&
	  !topLevelSortableRef.current
	) {
	  console.log("[IdeaDetail] Initializing top-level Sortable once...");
	  topLevelSortableRef.current = new Sortable(topLevelRef.current, {
		animation: 150,
		handle: ".grab-handle",
		onEnd: handleTopLevelSortEnd,
	  });
	}

	// Cleanup => if tasks becomes empty or we unmount
	return () => {
	  if (topLevelSortableRef.current) {
		console.log("[IdeaDetail] Cleanup -> destroy top-level Sortable instance");
		topLevelSortableRef.current.destroy();
		topLevelSortableRef.current = null;
	  }
	};
  }, [loading, tasks]);

  const handleTopLevelSortEnd = async (evt) => {
	const { oldIndex, newIndex } = evt;
	console.log(
	  "[IdeaDetail] top-level onEnd -> oldIndex:",
	  oldIndex,
	  "newIndex:",
	  newIndex
	);

	if (oldIndex === newIndex) {
	  console.log("[IdeaDetail] No movement, skipping reorder");
	  return;
	}

	const topLevel = tasks.filter((t) => !t.fields.ParentTask);
	const subTasks = tasks.filter((t) => t.fields.ParentTask);

	if (oldIndex < 0 || oldIndex >= topLevel.length) {
	  console.warn("[IdeaDetail] Invalid oldIndex:", oldIndex);
	  return;
	}
	if (newIndex < 0 || newIndex >= topLevel.length) {
	  console.warn("[IdeaDetail] Invalid newIndex:", newIndex);
	  return;
	}

	// Move item in local array
	const updated = [...topLevel];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) {
	  console.warn("[IdeaDetail] Could not find item to move at oldIndex:", oldIndex);
	  return;
	}
	updated.splice(newIndex, 0, moved);

	// Reassign "Order"
	updated.forEach((parent, idx) => {
	  parent.fields.Order = idx + 1;
	});

	// Merge with subtasks
	const merged = [...updated, ...subTasks];
	setTasks(merged);

	// Patch to Airtable
	try {
	  await patchTopLevelOrder(updated);
	} catch (err) {
	  console.error("[IdeaDetail] Error reordering top-level tasks:", err);
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
  //  Initialize Sortable for subtasks - also only after data is loaded
  // --------------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0) {
	  // Destroy existing subtask Sortables before rebuilding
	  Object.entries(subtaskSortableRefs.current).forEach(([parentId, sortable]) => {
		if (sortable) {
		  sortable.destroy();
		}
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
	}

	// Cleanup when unmount or tasks array changes
	return () => {
	  Object.entries(subtaskSortableRefs.current).forEach(([parentId, sortable]) => {
		if (sortable) {
		  sortable.destroy();
		}
	  });
	  subtaskSortableRefs.current = {};
	};
  }, [loading, tasks]);

  const handleSubtaskSortEnd = async (evt, parentTask) => {
	const { oldIndex, newIndex } = evt;
	console.log(
	  "[IdeaDetail] subtask onEnd -> oldIndex:",
	  oldIndex,
	  "newIndex:",
	  newIndex,
	  "parentTask:",
	  parentTask.id
	);

	if (oldIndex === newIndex) {
	  console.log("[IdeaDetail] No movement in subtask reorder, skipping");
	  return;
	}

	const parentID = parentTask.fields.TaskID;
	const subArray = tasks.filter((t) => t.fields.ParentTask === parentID);
	const others = tasks.filter((t) => t.fields.ParentTask !== parentID);

	if (oldIndex < 0 || oldIndex >= subArray.length) {
	  console.warn("[IdeaDetail] Invalid oldIndex for subtask:", oldIndex);
	  return;
	}
	if (newIndex < 0 || newIndex >= subArray.length) {
	  console.warn("[IdeaDetail] Invalid newIndex for subtask:", newIndex);
	  return;
	}

	const updated = [...subArray];
	const [moved] = updated.splice(oldIndex, 1);
	if (!moved) {
	  console.warn("[IdeaDetail] Could not find subtask to move at oldIndex:", oldIndex);
	  return;
	}
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
	  console.error("[IdeaDetail] Error reordering subtasks:", err);
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
  //  CREATE top-level or sub
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

	  // Ensure we have a userId before proceeding
	  if (!userId) {
		setError("No user ID found. Please log in again.");
		return;
	  }

	  const newOrderValue = tasks.length + 1;
	  const customID = idea.fields.IdeaID;

	  console.log("[IdeaDetail] Creating top-level task with name:", taskName);
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
				  UserID: userId, // <--- ensure we set the user ID
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
		  `Airtable error (createTask): ${response.status} ${response.statusText}`
		);
	  }
	  const data = await response.json();
	  const newRec = data.records[0];
	  console.log("[IdeaDetail] Created new top-level task record:", newRec);
	  setTasks((prev) => [...prev, newRec]);
	} catch (err) {
	  console.error("[IdeaDetail] Error creating task:", err);
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
	  if (!userId) {
		setError("No user ID found. Please log in again.");
		return;
	  }

	  const customID = idea.fields.IdeaID;
	  const newSubOrderVal = tasks.length + 1;
	  const parentID = parentTask.fields.TaskID;

	  console.log("[IdeaDetail] Creating subtask under parent:", parentTask.id);
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
				  UserID: userId, // <--- also set user ID for subtask
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
		  `Airtable error (createSubtask): ${response.status} ${response.statusText}`
		);
	  }
	  const data = await response.json();
	  const newSub = data.records[0];
	  console.log("[IdeaDetail] Created new subtask record:", newSub);
	  setTasks((prev) => [...prev, newSub]);
	} catch (err) {
	  console.error("[IdeaDetail] Error creating subtask:", err);
	  setError("Failed to create subtask. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  //  Inline editing => tasks => "XXX" => DELETE, etc.
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
	console.log("[IdeaDetail] handleEditSave -> taskId:", taskId, "newName:", newName);
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
	  console.error("[IdeaDetail] Error updating task name:", err);
	  setError("Failed to save updated task name to Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  //  Delete (parent + orphan children)
  // --------------------------------------------------------------------------
  const handleDeleteTask = async (taskId) => {
	console.log("[IdeaDetail] handleDeleteTask -> taskId:", taskId);
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
		console.error("[IdeaDetail] Error removing ParentTask from child tasks:", err);
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
	  console.error("[IdeaDetail] Error deleting task from Airtable:", err);
	  setError("Failed to delete the task from Airtable.");
	}
  };

  // --------------------------------------------------------------------------
  //  Toggling Completed & Today
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
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("[IdeaDetail] Error toggling completion:", err);
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
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("[IdeaDetail] Error toggling Today:", err);
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
  //  Organize tasks: top-level vs. sub-tasks
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
  //  Single Milestone reference
  // --------------------------------------------------------------------------
  const getMilestoneForTask = (task) => {
	const milestoneId = task.fields.MilestoneID;
	if (!milestoneId) return null;
	return milestones.find((m) => m.id === milestoneId) || null;
  };

  const handlePickMilestone = (task) => {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  };

  const assignMilestoneToTask = async (milestone) => {
	if (!activeTaskForMilestone) return;
	console.log(
	  "[IdeaDetail] assignMilestoneToTask -> milestone:",
	  milestone.id,
	  "task:",
	  activeTaskForMilestone.id
	);
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
	  console.error("[IdeaDetail] Error assigning milestone:", err);
	  setError("Failed to assign milestone. Please try again.");
	} finally {
	  setShowMilestoneModal(false);
	  setActiveTaskForMilestone(null);
	}
  };

  // --------------------------------------------------------------------------
  //  PATCH helper for updating the Idea fields
  // --------------------------------------------------------------------------
  async function patchIdeaField(fieldName, fieldValue) {
	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  if (!idea) return;

	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: idea.id,
			  fields: {
				[fieldName]: fieldValue,
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
	  console.error("[IdeaDetail] Error updating idea field:", err);
	  setError("Failed to update idea. Please try again.");
	}
  }

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

  // For convenience
  const ideaTitle = idea.fields.IdeaTitle || "(Untitled Idea)";
  const ideaSummary = idea.fields.IdeaSummary || "";

  // --------------------------------------------------------------------------
  //  Title & Summary Editing Handlers
  // --------------------------------------------------------------------------
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingTitle(ideaTitle);
  };

  const startEditingSummary = () => {
	setIsEditingSummary(true);
	setEditingSummary(ideaSummary);
  };

  const handleTitleKeyDown = async (e) => {
	if (e.key === "Enter") {
	  await commitTitleEdit();
	} else if (e.key === "Escape") {
	  cancelTitleEdit();
	}
  };

  const handleSummaryKeyDown = async (e) => {
	if (e.key === "Enter") {
	  e.preventDefault(); // Prevent newline
	  await commitSummaryEdit();
	} else if (e.key === "Escape") {
	  cancelSummaryEdit();
	}
  };

  const commitTitleEdit = async () => {
	setIsEditingTitle(false);
	// Optimistic local update
	idea.fields.IdeaTitle = editingTitle;
	await patchIdeaField("IdeaTitle", editingTitle);
  };

  const commitSummaryEdit = async () => {
	setIsEditingSummary(false);
	// Optimistic local update
	idea.fields.IdeaSummary = editingSummary;
	await patchIdeaField("IdeaSummary", editingSummary);
  };

  const cancelTitleEdit = () => {
	setIsEditingTitle(false);
	setEditingTitle(ideaTitle); // revert local
  };

  const cancelSummaryEdit = () => {
	setIsEditingSummary(false);
	setEditingSummary(ideaSummary); // revert local
  };

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  {/* If modal is open, render the shared MilestoneModal */}
	  {showMilestoneModal && (
		<MilestoneModal
		  allMilestones={milestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		/>
	  )}

	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your ideas
	  </Link>

	  {/* 
		1) IDEA TITLE with hover => pencil => inline editing
	  */}
	  <div
		className="mt-4"
		onMouseEnter={() => setTitleHovered(true)}
		onMouseLeave={() => setTitleHovered(false)}
	  >
		{isEditingTitle ? (
		  <input
			type="text"
			className="text-2xl font-bold border-b border-gray-300 focus:outline-none"
			value={editingTitle}
			onChange={(e) => setEditingTitle(e.target.value)}
			onBlur={commitTitleEdit}
			onKeyDown={handleTitleKeyDown}
			autoFocus
		  />
		) : (
		  <h2 className="text-2xl font-bold inline-block">
			{ideaTitle}
			{titleHovered && (
			  <span
				className="ml-2 cursor-pointer text-sm"
				onClick={startEditingTitle}
				title="Edit Title"
			  >
				✏️
			  </span>
			)}
		  </h2>
		)}
	  </div>

	  {/* 
		2) IDEA SUMMARY with hover => pencil => inline editing
	  */}
	  <div
		className="mt-2 text-gray-700"
		onMouseEnter={() => setSummaryHovered(true)}
		onMouseLeave={() => setSummaryHovered(false)}
	  >
		{isEditingSummary ? (
		  <textarea
			className="border border-gray-300 rounded w-full p-1"
			rows={3}
			value={editingSummary}
			onChange={(e) => setEditingSummary(e.target.value)}
			onBlur={commitSummaryEdit}
			onKeyDown={handleSummaryKeyDown}
			autoFocus
		  />
		) : (
		  <p className="inline-block">
			{ideaSummary}
			{summaryHovered && (
			  <span
				className="ml-2 cursor-pointer text-sm"
				onClick={startEditingSummary}
				title="Edit Summary"
			  >
				✏️
			  </span>
			)}
		  </p>
		)}
	  </div>

	  {/* CREATE NEW TOP-LEVEL TASK */}
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
		<ul className="divide-y divide-gray-200 border rounded" ref={topLevelRef}>
		  {topLevelTasks.map((parent) => {
			const parentCompleted = parent.fields.Completed || false;
			const parentCompletedTime = parent.fields.CompletedTime || null;
			const isTodayParent = parent.fields.Today || false;

			const parentMilestone = getMilestoneForTask(parent);
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
						(Done on {new Date(parentCompletedTime).toLocaleString()})
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
					<p
					  className="text-sm text-blue-600 underline cursor-pointer"
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
						<li key={sub.id} className="py-2 pl-3 hover:bg-gray-50">
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
									subCompleted ? "line-through text-gray-500" : ""
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
								  (Done on {new Date(subCompletedTime).toLocaleString()})
								</span>
							  )}
							</div>

							{/* "Today" checkbox for subtask (only if not completed) */}
							{!subCompleted && (
							  <div className="ml-2 flex items-center space-x-1">
								<input
								  type="checkbox"
								  checked={sub.fields.Today || false}
								  onChange={() => handleToggleToday(sub)}
								/>
								<label className="text-sm">Today</label>
							  </div>
							)}
						  </div>

						  {/* MILESTONE for this subtask */}
						  <div className="ml-6 mt-1 pl-3 border-l border-gray-200">
							<h4 className="font-semibold text-sm">Milestone:</h4>
							{subMilestone ? (
							  <p className="text-sm">
								<strong>{subMilestone.fields.MilestoneName}</strong>
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
