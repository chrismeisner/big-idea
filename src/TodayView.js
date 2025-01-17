import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect
} from "react";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Link } from "react-router-dom";

import MilestoneModal from "./MilestoneModal"; // Import your MilestoneModal component if not already

function TodayView({ airtableUser }) {
  // ------------------------------------------------------------------
  // 0) Daily countdown to 4:20 PM
  // ------------------------------------------------------------------
  const [dailyCountdown, setDailyCountdown] = useState("");

  useEffect(() => {
	function getTargetTime() {
	  const now = new Date();
	  const target = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		16, // 16 = 4pm
		20,
		0,
		0
	  );
	  if (target < now) {
		target.setDate(target.getDate() + 1);
	  }
	  return target;
	}

	function updateCountdown() {
	  const now = Date.now();
	  const diff = getTargetTime().getTime() - now;
	  if (diff <= 0) {
		setDailyCountdown("Time’s up!");
		return;
	  }
	  const totalSec = Math.floor(diff / 1000);
	  const days = Math.floor(totalSec / 86400);
	  const hours = Math.floor((totalSec % 86400) / 3600);
	  const mins = Math.floor((totalSec % 3600) / 60);
	  const secs = totalSec % 60;

	  let result = "";
	  if (days > 0) result += `${days}d `;
	  if (days > 0 || hours > 0) result += `${hours}h `;
	  result += `${mins}m ${secs}s`;

	  setDailyCountdown(result + " until 4:20pm");
	}

	updateCountdown();
	const timerId = setInterval(updateCountdown, 1000);
	return () => clearInterval(timerId);
  }, []);

  // ------------------------------------------------------------------
  // 1) State
  // ------------------------------------------------------------------
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [milestones, setMilestones] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline editing
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // ------------------------------------------------------------------
  // 2) Refs for Sortable
  // ------------------------------------------------------------------
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);
  const subtaskRefs = useRef({});

  // ------------------------------------------------------------------
  // Airtable ENV
  // ------------------------------------------------------------------
  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // ------------------------------------------------------------------
  // Subcomponent: TodayProgressBar
  // ------------------------------------------------------------------
  function TodayProgressBar({ completedTasks, totalTasks, percentage }) {
	if (totalTasks === 0) {
	  return <p className="text-sm text-gray-500">No tasks for Today yet.</p>;
	}
	return (
	  <div className="my-4">
		<p className="text-sm text-gray-600">
		  {completedTasks} of {totalTasks} completed
		  <span className="ml-2">({percentage}%)</span>
		</p>
		<div className="bg-gray-200 h-3 rounded mt-1 w-full">
		  <div
			className="bg-green-500 h-3 rounded"
			style={{ width: `${percentage}%` }}
		  />
		</div>
	  </div>
	);
  }

  // ------------------------------------------------------------------
  // 3) Fetch tasks, ideas, milestones
  // ------------------------------------------------------------------
  useEffect(() => {
	if (!userId) {
	  setError("No user ID found. Please log in again.");
	  setLoading(false);
	  return;
	}
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  setLoading(false);
	  return;
	}

	async function fetchData() {
	  try {
		setLoading(true);

		// Double-check Firebase Auth
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  throw new Error("No logged-in user found in Firebase Auth.");
		}

		// A) Tasks => {Focus}="today"
		const filterFormula = `AND({Focus}="today", {UserID}="${userId}")`;
		const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		tasksUrl.searchParams.set("filterByFormula", filterFormula);
		tasksUrl.searchParams.set("sort[0][field]", "OrderToday");
		tasksUrl.searchParams.set("sort[0][direction]", "asc");

		const tasksResp = await fetch(tasksUrl.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!tasksResp.ok) {
		  throw new Error(`Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`);
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// B) Ideas => for current user
		const ideasUrl = new URL(`https://api.airtable.com/v0/${baseId}/Ideas`);
		ideasUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
		const ideasResp = await fetch(ideasUrl.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!ideasResp.ok) {
		  throw new Error(`Airtable error (Ideas): ${ideasResp.status} ${ideasResp.statusText}`);
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);

		// C) Milestones => for current user
		const msUrl = new URL(`https://api.airtable.com/v0/${baseId}/Milestones`);
		msUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
		const msResp = await fetch(msUrl.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!msResp.ok) {
		  throw new Error(`Airtable error (Milestones): ${msResp.status} ${msResp.statusText}`);
		}
		const msData = await msResp.json();
		setMilestones(msData.records);

	  } catch (err) {
		console.error("[TodayView] Error fetching data:", err);
		setError(err.message || "Failed to load tasks for Today.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [userId, baseId, apiKey]);

  // ------------------------------------------------------------------
  // 4) "Top-level" Sortable for incomplete tasks
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && incompleteListRef.current && !sortableRef.current) {
	  const inc = getIncompleteParentTasks();
	  if (inc.length > 0) {
		sortableRef.current = new Sortable(incompleteListRef.current, {
		  animation: 150,
		  handle: ".drag-handle",
		  onEnd: handleSortEnd,
		});
	  }
	}
	return () => {
	  if (sortableRef.current) {
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, [loading, tasks]);

  const handleSortEnd = async (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const inc = getIncompleteParentTasks();
	const updated = [...inc];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// Reassign .OrderToday
	updated.forEach((t, i) => {
	  t.fields.OrderToday = i + 1;
	});

	// Rebuild tasks array
	const completed = tasks.filter((t) => t.fields.Completed);
	const subs = tasks.filter((t) => t.fields.ParentTask);
	setTasks([...updated, ...completed, ...subs]);

	// Patch
	try {
	  await patchOrderTodayToAirtable(updated);
	} catch (err) {
	  console.error("Error updating OrderToday =>", err);
	  setError("Failed to reorder tasks for Today. Please try again.");
	}
  };

  async function patchOrderTodayToAirtable(incompleteArr) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for patching order.");
	}
	const chunkSize = 10;
	for (let i = 0; i < incompleteArr.length; i += chunkSize) {
	  const chunk = incompleteArr.slice(i, i + chunkSize).map((t) => ({
		id: t.id,
		fields: { OrderToday: t.fields.OrderToday },
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

  // ------------------------------------------------------------------
  // 4b) Subtask Sortable => one instance per parent
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0) {
	  const parentTasks = tasks.filter((t) => !t.fields.ParentTask);
	  parentTasks.forEach((p) => {
		const incSubs = getIncompleteSubtasks(p);
		if (incSubs.length === 0) return;

		const listEl = subtaskRefs.current[p.id];
		if (!listEl) return;

		if (listEl._sortable) listEl._sortable.destroy();

		listEl._sortable = new Sortable(listEl, {
		  animation: 150,
		  handle: ".sub-drag-handle",
		  onEnd: (evt) => handleSubtaskSortEnd(evt, p),
		});
	  });
	}
	return () => {
	  Object.values(subtaskRefs.current).forEach((el) => {
		if (el && el._sortable) el._sortable.destroy();
	  });
	};
  }, [loading, tasks]);

  async function handleSubtaskSortEnd(evt, parent) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const incSubs = getIncompleteSubtasks(parent);
	const updated = [...incSubs];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	updated.forEach((st, i) => {
	  st.fields.SubOrder = i + 1;
	});

	const others = tasks.filter((t) => t.fields.ParentTask !== parent.fields.TaskID);
	updated.forEach((u) => {
	  const idx = others.findIndex((x) => x.id === u.id);
	  if (idx >= 0) others[idx] = u;
	});
	setTasks([...others, ...updated]);

	try {
	  await patchSubOrderToAirtable(updated);
	} catch (err) {
	  console.error("Error updating SubOrder =>", err);
	  setError("Failed to reorder subtasks. Please try again.");
	}
  }

  async function patchSubOrderToAirtable(subArr) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for patching SubOrder.");
	}
	const chunkSize = 10;
	for (let i = 0; i < subArr.length; i += chunkSize) {
	  const chunk = subArr.slice(i, i + chunkSize).map((t) => ({
		id: t.id,
		fields: { SubOrder: t.fields.SubOrder },
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

  // ------------------------------------------------------------------
  // 5) Toggling Completed / Focus
  // ------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = !!task.fields.Completed;
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
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling Completed =>", err);
	  setError("Failed to toggle Completed. Please try again.");

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

  const handleToggleFocus = async (task) => {
	const wasFocusToday = (task.fields.Focus === "today");
	const newValue = wasFocusToday ? "" : "today";

	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Focus: newValue } }
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
			  fields: { Focus: newValue },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(`Airtable error: ${patchResp.status} ${patchResp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error toggling Focus =>", err);
	  setError("Failed to toggle Focus. Please try again.");

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
  };

  // ------------------------------------------------------------------
  // 6) Inline editing for a task => "xxx" = delete
  // ------------------------------------------------------------------
  function startEditingTask(task) {
	setEditingTaskId(task.id);
	setEditingTaskName(task.fields.TaskName || "");
  }

  function cancelEditingTask() {
	setEditingTaskId(null);
	setEditingTaskName("");
  }

  async function commitTaskEdit(task) {
	const trimmed = editingTaskName.trim();
	if (!trimmed) {
	  cancelEditingTask();
	  return;
	}

	// "xxx" => delete
	if (trimmed.toLowerCase() === "xxx") {
	  await deleteTask(task);
	  cancelEditingTask();
	  return;
	}

	// Otherwise rename
	try {
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  TaskName: trimmed,
				},
			  }
			: t
		)
	  );

	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
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
			  fields: { TaskName: trimmed },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		const eData = await resp.json().catch(() => ({}));
		console.error("commitTaskEdit =>", eData);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	} catch (err) {
	  console.error("Error editing task =>", err);
	  setError("Failed to update task name. Please try again.");
	} finally {
	  cancelEditingTask();
	}
  }

  async function deleteTask(task) {
	setTasks((prev) => prev.filter((t) => t.id !== task.id));
	if (!baseId || !apiKey) return;

	try {
	  const delUrl = `https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`;
	  const resp = await fetch(delUrl, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!resp.ok) {
		const eData = await resp.json().catch(() => ({}));
		console.error("[TodayView] deleteTask =>", eData);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	} catch (err) {
	  console.error("Failed to delete task =>", err);
	  // optionally revert local
	}
  }

  // ------------------------------------------------------------------
  // 7) Helper => grouping tasks
  // ------------------------------------------------------------------
  function getIncompleteParentTasks() {
	const parents = tasks.filter((t) => !t.fields.ParentTask && !t.fields.Completed);
	parents.sort((a,b) => (a.fields.OrderToday || 0) - (b.fields.OrderToday || 0));
	return parents;
  }
  function getCompletedParentTasks() {
	const parents = tasks.filter((t) => !t.fields.ParentTask && t.fields.Completed);
	parents.sort((a,b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return parents;
  }
  function getIncompleteSubtasks(parentTask) {
	const pid = parentTask.fields.TaskID;
	if (!pid) return [];
	const subs = tasks.filter((s) => s.fields.ParentTask === pid && !s.fields.Completed);
	subs.sort((a,b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));
	return subs;
  }
  function getCompletedSubtasks(parentTask) {
	const pid = parentTask.fields.TaskID;
	if (!pid) return [];
	const subs = tasks.filter((s) => s.fields.ParentTask === pid && s.fields.Completed);
	subs.sort((a,b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return subs;
  }

  // ------------------------------------------------------------------
  // 8) Lookup: Idea / Milestone
  // ------------------------------------------------------------------
  const findIdeaForTask = (task) => {
	const ideaId = task.fields.IdeaID;
	if (!ideaId) return null;
	return ideas.find((i) => i.fields.IdeaID === ideaId) || null;
  };
  const findMilestoneForTask = (task) => {
	const milestoneId = task.fields.MilestoneID;
	if (!milestoneId) return null;
	return milestones.find((m) => m.fields.MilestoneID === milestoneId) || null;
  };

  // ------------------------------------------------------------------
  // 8b) "Add/Edit" Milestone logic
  // ------------------------------------------------------------------
  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
	if (!activeTaskForMilestone) return;
	const target = activeTaskForMilestone;
	setShowMilestoneModal(false);
	setActiveTaskForMilestone(null);

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === target.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				MilestoneID: milestone.fields.MilestoneID,
			  },
			}
		  : t
	  )
	);

	// Patch
	if (!baseId || !apiKey) return;
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
			  id: target.id,
			  fields: {
				MilestoneID: milestone.fields.MilestoneID,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error (assignMilestoneToTask): ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error assigning milestone =>", err);
	  setError("Failed to assign milestone. Please refresh.");
	}
  }

  async function removeMilestoneFromTask(task) {
	if (!task) return;
	// local => clear
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, MilestoneID: "" } }
		  : t
	  )
	);

	// patch
	if (!baseId || !apiKey) return;
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
			  fields: { MilestoneID: "" },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error (removeMilestoneFromTask): ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error removing milestone =>", err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

  // ------------------------------------------------------------------
  // 9) Progress calculations => only tasks with Focus="today"
  // ------------------------------------------------------------------
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.fields.Completed).length;
  const percentage = (totalTasks > 0)
	? Math.round((completedCount / totalTasks) * 100)
	: 0;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  const incompleteParents = getIncompleteParentTasks();
  const completedParents = getCompletedParentTasks();

  if (tasks.length === 0) {
	return (
	  <div className="m-4">
		<p>No tasks with Focus="today".</p>
	  </div>
	);
  }

  return (
	<div className="container py-6">
	  {/* Milestone Modal */}
	  {showMilestoneModal && (
		<MilestoneModal
		  allMilestones={milestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		  onRemove={() => removeMilestoneFromTask(activeTaskForMilestone)}
		/>
	  )}

	  {/* Daily Countdown */}
	  <div className="mb-2 text-sm text-red-600 font-semibold">
		{dailyCountdown}
	  </div>

	  <h2 className="text-2xl font-bold mb-4">Today's Tasks</h2>

	  <TodayProgressBar
		completedTasks={completedCount}
		totalTasks={totalTasks}
		percentage={percentage}
	  />

	  {/* INCOMPLETE PARENTS */}
	  {incompleteParents.length > 0 && (
		<ul className="divide-y border rounded mb-6" ref={incompleteListRef}>
		  {incompleteParents.map((parent, index) => {
			const isCompleted = !!parent.fields.Completed;
			const completedTime = parent.fields.CompletedTime || null;
			const isFocus = (parent.fields.Focus === "today");
			const isEditingThis = (editingTaskId === parent.id);

			const milestone = findMilestoneForTask(parent);
			const idea = findIdeaForTask(parent);

			const incSubs = getIncompleteSubtasks(parent);
			const compSubs = getCompletedSubtasks(parent);

			const topItemClass = (index === 0)
			  ? "bg-amber-100"
			  : "hover:bg-gray-50";

			return (
			  <li
				key={parent.id}
				className={`p-3 flex flex-col transition-colors ${topItemClass}`}
			  >
				{/* Milestone row => either milestone name + "Edit", or "Add Milestone" */}
				<div className="mb-1 inline-flex items-center ml-6">
				  {milestone ? (
					<div className="group">
					  <span className="text-sm text-blue-700 font-semibold">
						🏔{" "}
						<Link
						  to={`/milestones/${milestone.fields.MilestoneID}`}
						  className="underline"
						>
						  {milestone.fields.MilestoneName || "(Unnamed Milestone)"}
						</Link>
					  </span>
					  <span
						className="
						  ml-2 text-xs text-blue-600 underline cursor-pointer
						  hidden group-hover:inline-block
						"
						onClick={() => handlePickMilestone(parent)}
					  >
						Edit
					  </span>
					</div>
				  ) : (
					<button
					  className="text-xs text-blue-600 underline"
					  onClick={() => handlePickMilestone(parent)}
					>
					  + Add Milestone
					</button>
				  )}
				</div>

				<div className="flex items-center">
				  <div
					className="drag-handle mr-3 text-gray-400 cursor-grab active:cursor-grabbing"
					title="Drag to reorder tasks"
				  >
					<svg
					  className="h-5 w-5"
					  fill="none"
					  stroke="currentColor"
					  strokeWidth="1.5"
					  viewBox="0 0 24 24"
					>
					  <path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M3.75 5h16.5M3.75 12h16.5m-16.5 7h16.5"
					  />
					</svg>
				  </div>

				  <input
					type="checkbox"
					checked={isCompleted}
					onChange={() => handleToggleCompleted(parent)}
					className="mr-3"
				  />

				  {/* Inline edit */}
				  <div className="flex-1">
					{isEditingThis ? (
					  <input
						autoFocus
						type="text"
						className="border-b border-gray-300 focus:outline-none"
						value={editingTaskName}
						onChange={(e) => setEditingTaskName(e.target.value)}
						onBlur={() => commitTaskEdit(parent)}
						onKeyDown={(e) => {
						  if (e.key === "Enter") commitTaskEdit(parent);
						  else if (e.key === "Escape") cancelEditingTask();
						}}
					  />
					) : (
					  <span
						className={isCompleted ? "line-through text-gray-500" : ""}
						onClick={() => startEditingTask(parent)}
					  >
						{parent.fields.TaskName || "(Untitled Task)"}
					  </span>
					)}
				  </div>

				  {/* Focus toggle => ☀️ or 💤 */}
				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(parent)}
					title='Toggle Focus'
				  >
					{isFocus ? "☀️" : "💤"}
				  </span>
				</div>

				{/* Completed date if needed */}
				{isCompleted && completedTime && (
				  <p className="text-xs text-gray-500 ml-6 mt-1">
					Completed on {new Date(completedTime).toLocaleString()}
				  </p>
				)}

				{/* Idea link */}
				{idea && (
				  <div className="ml-6 mt-1">
					<Link
					  to={`/ideas/${idea.fields.IdeaID}`}
					  className="text-sm text-blue-600 underline"
					>
					  {idea.fields.IdeaTitle || "(Untitled Idea)"}
					</Link>
				  </div>
				)}

				{/* Incomplete subtasks */}
				{incSubs.length > 0 && (
				  <ul
					className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y"
					ref={(el) => (subtaskRefs.current[parent.id] = el)}
				  >
					{incSubs.map((sub) => {
					  const subCompleted = !!sub.fields.Completed;
					  const isEditingSub = (editingTaskId === sub.id);
					  const subFocus = (sub.fields.Focus === "today");
					  const subTime = sub.fields.CompletedTime || null;

					  return (
						<li key={sub.id} className="py-2 pr-2">
						  <div className="flex items-center">
							<div
							  className="sub-drag-handle mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
							  title="Drag to reorder subtasks"
							>
							  ⇅
							</div>
							<input
							  type="checkbox"
							  checked={subCompleted}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>

							{/* sub inline-edit */}
							<div className="flex-1">
							  {isEditingSub ? (
								<input
								  autoFocus
								  type="text"
								  className="border-b border-gray-300 focus:outline-none"
								  value={editingTaskName}
								  onChange={(e) => setEditingTaskName(e.target.value)}
								  onBlur={() => commitTaskEdit(sub)}
								  onKeyDown={(e) => {
									if (e.key === "Enter") commitTaskEdit(sub);
									else if (e.key === "Escape") cancelEditingTask();
								  }}
								/>
							  ) : (
								<span
								  className={subCompleted ? "line-through text-gray-500" : ""}
								  onClick={() => startEditingTask(sub)}
								>
								  {sub.fields.TaskName || "(Untitled Subtask)"}
								</span>
							  )}
							</div>

							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle Focus'
							>
							  {subFocus ? "☀️" : "💤"}
							</span>
						  </div>
						  {subCompleted && subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on {new Date(subTime).toLocaleString()}
							</p>
						  )}
						</li>
					  );
					})}
				  </ul>
				)}

				{/* Completed subtasks */}
				{compSubs.length > 0 && (
				  <ul className="mt-1 ml-6 pl-3 border-l border-gray-200 divide-y">
					{compSubs.map((sub) => {
					  const subTime = sub.fields.CompletedTime || null;
					  const subFocus = (sub.fields.Focus === "today");
					  const isEditingSub = (editingTaskId === sub.id);

					  return (
						<li key={sub.id} className="py-2 pr-2 flex flex-col">
						  <div className="flex items-center">
							<input
							  type="checkbox"
							  checked={true}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>
							<div className="flex-1">
							  {isEditingSub ? (
								<input
								  autoFocus
								  type="text"
								  className="border-b border-gray-300 focus:outline-none"
								  value={editingTaskName}
								  onChange={(e) => setEditingTaskName(e.target.value)}
								  onBlur={() => commitTaskEdit(sub)}
								  onKeyDown={(e) => {
									if (e.key === "Enter") commitTaskEdit(sub);
									else if (e.key === "Escape") cancelEditingTask();
								  }}
								/>
							  ) : (
								<span
								  className="line-through text-gray-500"
								  onClick={() => startEditingTask(sub)}
								>
								  {sub.fields.TaskName || "(Untitled Subtask)"}
								</span>
							  )}
							</div>
							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle Focus'
							>
							  {subFocus ? "☀️" : "💤"}
							</span>
						  </div>
						  {subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on {new Date(subTime).toLocaleString()}
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

	  {/* COMPLETED PARENTS */}
	  {completedParents.length > 0 && (
		<ul className="divide-y border rounded">
		  {completedParents.map((parent) => {
			const completedTime = parent.fields.CompletedTime || null;
			const isFocusToday = (parent.fields.Focus === "today");
			const isEditingThis = (editingTaskId === parent.id);

			const milestone = findMilestoneForTask(parent);
			const idea = findIdeaForTask(parent);

			const incSubs = getIncompleteSubtasks(parent);
			const compSubs = getCompletedSubtasks(parent);

			return (
			  <li key={parent.id} className="p-3 flex flex-col hover:bg-gray-50">
				{/* If there's a milestone => show name + “Edit” link, else “+ Add Milestone” */}
				<div className="mb-1 inline-flex items-center ml-6">
				  {milestone ? (
					<div className="group">
					  <span className="text-sm text-blue-700 font-semibold">
						🏔{" "}
						<Link
						  to={`/milestones/${milestone.fields.MilestoneID}`}
						  className="underline"
						>
						  {milestone.fields.MilestoneName || "(Unnamed Milestone)"}
						</Link>
					  </span>
					  <span
						className="
						  ml-2 text-xs text-blue-600 underline cursor-pointer
						  hidden group-hover:inline-block
						"
						onClick={() => handlePickMilestone(parent)}
					  >
						Edit
					  </span>
					</div>
				  ) : (
					<button
					  className="text-xs text-blue-600 underline"
					  onClick={() => handlePickMilestone(parent)}
					>
					  + Add Milestone
					</button>
				  )}
				</div>

				<div className="flex items-center">
				  <input
					type="checkbox"
					checked={true}
					onChange={() => handleToggleCompleted(parent)}
					className="mr-3"
				  />

				  {/* Inline edit */}
				  <div className="flex-1">
					{isEditingThis ? (
					  <input
						autoFocus
						type="text"
						className="border-b border-gray-300 focus:outline-none"
						value={editingTaskName}
						onChange={(e) => setEditingTaskName(e.target.value)}
						onBlur={() => commitTaskEdit(parent)}
						onKeyDown={(e) => {
						  if (e.key === "Enter") commitTaskEdit(parent);
						  else if (e.key === "Escape") cancelEditingTask();
						}}
					  />
					) : (
					  <span
						className="line-through text-gray-500"
						onClick={() => startEditingTask(parent)}
					  >
						{parent.fields.TaskName || "(Untitled Task)"}
					  </span>
					)}
				  </div>

				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(parent)}
					title='Toggle Focus'
				  >
					{isFocusToday ? "☀️" : "💤"}
				  </span>
				</div>

				{completedTime && (
				  <p className="text-xs text-gray-500 ml-6 mt-1">
					Completed on {new Date(completedTime).toLocaleString()}
				  </p>
				)}

				{idea && (
				  <div className="ml-6 mt-1">
					<Link
					  to={`/ideas/${idea.fields.IdeaID}`}
					  className="text-sm text-blue-600 underline"
					>
					  {idea.fields.IdeaTitle || "(Untitled Idea)"}
					</Link>
				  </div>
				)}

				{/* incomplete & completed subtasks */}
				{incSubs.length > 0 && (
				  <ul className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y">
					{incSubs.map((sub) => {
					  const isEditingSub = (editingTaskId === sub.id);
					  const subCompleted = !!sub.fields.Completed;

					  return (
						<li key={sub.id} className="py-2 pr-2 flex items-center">
						  <input
							type="checkbox"
							checked={subCompleted}
							onChange={() => handleToggleCompleted(sub)}
							className="mr-3"
						  />
						  {isEditingSub ? (
							<input
							  autoFocus
							  type="text"
							  className="border-b border-gray-300 focus:outline-none"
							  value={editingTaskName}
							  onChange={(e) => setEditingTaskName(e.target.value)}
							  onBlur={() => commitTaskEdit(sub)}
							  onKeyDown={(e) => {
								if (e.key === "Enter") commitTaskEdit(sub);
								else if (e.key === "Escape") cancelEditingTask();
							  }}
							/>
						  ) : (
							<span
							  className={
								subCompleted ? "line-through text-gray-500" : ""
							  }
							  onClick={() => startEditingTask(sub)}
							>
							  {sub.fields.TaskName || "(Untitled Subtask)"}
							</span>
						  )}
						</li>
					  );
					})}
				  </ul>
				)}

				{compSubs.length > 0 && (
				  <ul className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y">
					{compSubs.map((sub) => {
					  const isEditingSub = (editingTaskId === sub.id);

					  return (
						<li key={sub.id} className="py-2 pr-2 flex flex-col">
						  <div className="flex items-center">
							<input
							  type="checkbox"
							  checked={true}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>
							{isEditingSub ? (
							  <input
								autoFocus
								type="text"
								className="border-b border-gray-300 focus:outline-none"
								value={editingTaskName}
								onChange={(e) => setEditingTaskName(e.target.value)}
								onBlur={() => commitTaskEdit(sub)}
								onKeyDown={(e) => {
								  if (e.key === "Enter") commitTaskEdit(sub);
								  else if (e.key === "Escape") cancelEditingTask();
								}}
							  />
							) : (
							  <span
								className="line-through text-gray-500"
								onClick={() => startEditingTask(sub)}
							  >
								{sub.fields.TaskName || "(Untitled Subtask)"}
							  </span>
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

export default TodayView;
