import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect
} from "react";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Link } from "react-router-dom";

import MilestoneModal from "./MilestoneModal";

function TodayView({ airtableUser }) {
  // ------------------------------------------------------------------
  // 0) State for daily countdown to user’s chosen time
  // ------------------------------------------------------------------
  const [dailyCountdown, setDailyCountdown] = useState("");

  // New states for editing user’s daily time
  const [showEditTime, setShowEditTime] = useState(false);
  const [tempTime, setTempTime] = useState("");   // hold time while editing
  const [todayTime, setTodayTime] = useState("16:20"); // fallback to 4:20 PM

  // ------------------------------------------------------------------
  // 1) Load user’s TodayTime from the "Users" table (via airtableUser)
  // ------------------------------------------------------------------
  useEffect(() => {
	if (airtableUser && airtableUser.fields.TodayTime) {
	  setTodayTime(airtableUser.fields.TodayTime); // e.g. "15:30"
	} else {
	  setTodayTime("16:20");
	}
  }, [airtableUser]);

  // ------------------------------------------------------------------
  // 2) Countdown logic, using `todayTime` instead of hardcoded 4:20
  // ------------------------------------------------------------------
  useEffect(() => {
	function getTargetTime() {
	  const now = new Date();
	  const [hours, minutes] = todayTime.split(":").map(Number);

	  const target = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		hours,
		minutes,
		0,
		0
	  );
	  if (target <= now) {
		// If the chosen time is already past for today, add 1 day
		target.setDate(target.getDate() + 1);
	  }
	  return target;
	}

	function updateCountdown() {
	  const diff = getTargetTime().getTime() - Date.now();
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

	  setDailyCountdown(result + ` until ${todayTime}`);
	}

	updateCountdown();
	const timerId = setInterval(updateCountdown, 1000);
	return () => clearInterval(timerId);
  }, [todayTime]);

  // ------------------------------------------------------------------
  // 3) Updating user’s chosen time => patch to Airtable
  // ------------------------------------------------------------------
  const [error, setError] = useState(null);

  const handleSaveTimeChange = async () => {
	// 1) Local update so it takes effect immediately
	setTodayTime(tempTime);
	setShowEditTime(false);

	// 2) PATCH to Airtable => user’s "TodayTime" field
	try {
	  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
	  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");
	  if (!airtableUser) throw new Error("No user record to patch.");

	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Users`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: airtableUser.id, // The user’s Airtable record ID
			  fields: {
				TodayTime: tempTime,
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
	  console.error("[TodayView] Error updating TodayTime:", err);
	  setError("Failed to update daily time. Please refresh.");
	}
  };

  // ------------------------------------------------------------------
  // 4) Remaining state/logic for tasks, ideas, etc.
  // ------------------------------------------------------------------
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [milestones, setMilestones] = useState([]);
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

  // Airtable env
  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Refs for Sortable
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);

  // ------------------------------------------------------------------
  // 5) fetch tasks (Focus="today"), plus ideas + milestones
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
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  throw new Error("No logged-in user found in Firebase Auth.");
		}

		// A) Tasks => {Focus}="today"
		const filterFormula = `AND({Focus}="today", {UserID}="${userId}")`;
		const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		tasksUrl.searchParams.set("filterByFormula", filterFormula);
		// sort by OrderToday ascending
		tasksUrl.searchParams.set("sort[0][field]", "OrderToday");
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
		setTasks(tasksData.records);

		// B) Ideas
		const ideasUrl = new URL(`https://api.airtable.com/v0/${baseId}/Ideas`);
		ideasUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
		const ideasResp = await fetch(ideasUrl.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!ideasResp.ok) {
		  throw new Error(
			`Airtable error (Ideas): ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);

		// C) Milestones
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
  // 6) Sortable for incomplete tasks
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0 && incompleteListRef.current && !sortableRef.current) {
	  const incomplete = tasks.filter((t) => !t.fields.Completed);
	  if (incomplete.length > 0) {
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

  async function handleSortEnd(evt) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const incomplete = tasks.filter((t) => !t.fields.Completed);
	const updated = [...incomplete];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// reassign .OrderToday
	updated.forEach((item, idx) => {
	  item.fields.OrderToday = idx + 1;
	});

	// rebuild tasks array
	const completed = tasks.filter((t) => t.fields.Completed);
	setTasks([...updated, ...completed]);

	// patch to airtable
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

	  const chunkSize = 10;
	  for (let i = 0; i < updated.length; i += chunkSize) {
		const chunk = updated.slice(i, i + chunkSize).map((t) => ({
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
		  throw new Error(
			`Airtable error: ${resp.status} ${resp.statusText}`
		  );
		}
	  }
	} catch (err) {
	  console.error("[TodayView] handleSortEnd =>", err);
	  setError("Failed to reorder tasks. Please try again.");
	}
  }

  // ------------------------------------------------------------------
  // 7) Toggling Completed / Focus
  // ------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = !!task.fields.Completed;
	const newVal = !wasCompleted;
	const newTime = newVal ? new Date().toISOString() : null;

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: { ...t.fields, Completed: newVal, CompletedTime: newTime },
			}
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
			  fields: { Completed: newVal, CompletedTime: newTime },
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
	  console.error("[TodayView] handleToggleCompleted =>", err);
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
	const wasFocus = (task.fields.Focus === "today");
	const newVal = wasFocus ? "" : "today";

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Focus: newVal } }
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
			  fields: { Focus: newVal },
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
	  console.error("[TodayView] handleToggleFocus =>", err);
	  setError("Failed to toggle Focus. Please try again.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: { ...t.fields, Focus: wasFocus ? "today" : "" },
			  }
			: t
		)
	  );
	}
  };

  // ------------------------------------------------------------------
  // 8) Inline editing => rename or "xxx" => delete (TaskName)
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
			? { ...t, fields: { ...t.fields, TaskName: trimmed } }
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
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("[TodayView] commitTaskEdit =>", err);
	  setError("Failed to update task name. Please try again.");
	} finally {
	  cancelEditingTask();
	}
  }

  // ------------------------------------------------------------------
  // 9) Inline editing => notes
  // ------------------------------------------------------------------
  function startEditingNotes(task) {
	setEditingNotesTaskId(task.id);
	setEditingNotesText(task.fields.TaskNote || "");
  }
  function cancelEditingNotes() {
	setEditingNotesTaskId(null);
	setEditingNotesText("");
  }
  async function commitNotesEdit(task) {
	const trimmed = editingNotesText.trim();
	// If user clears it out, that’s OK—just store empty string
	// If user typed "xxx" => not necessarily a delete, but we can allow it
	// (No special rule here unless you want to interpret "xxx" in some way.)

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, TaskNote: trimmed } }
		  : t
	  )
	);

	try {
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
			  fields: { TaskNote: trimmed },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("[TodayView] commitNotesEdit =>", err);
	  setError("Failed to update notes. Please try again.");
	} finally {
	  cancelEditingNotes();
	}
  }

  // ------------------------------------------------------------------
  // 10) Deleting a task
  // ------------------------------------------------------------------
  async function deleteTask(task) {
	setTasks((prev) => prev.filter((t) => t.id !== task.id));

	try {
	  if (!baseId || !apiKey) return;
	  const delUrl = `https://api.airtable.com/v0/${baseId}/Tasks/${task.id}`;
	  const resp = await fetch(delUrl, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!resp.ok) {
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	} catch (err) {
	  console.error("Failed to delete task =>", err);
	  // optionally revert
	}
  }

  // ------------------------------------------------------------------
  // 11) Milestone assignment
  // ------------------------------------------------------------------
  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
	if (!activeTaskForMilestone) return;
	const target = activeTaskForMilestone;

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
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("[TodayView] assignMilestoneToTask =>", err);
	  setError("Failed to assign milestone. Please refresh.");
	} finally {
	  setShowMilestoneModal(false);
	  setActiveTaskForMilestone(null);
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
	  if (!baseId || !apiKey) return;
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
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("[TodayView] removeMilestoneFromTask =>", err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

  // ------------------------------------------------------------------
  // 12) Partition tasks into incomplete vs completed
  // ------------------------------------------------------------------
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.fields.Completed).length;
  const percentage = totalTasks
	? Math.round((completedCount / totalTasks) * 100)
	: 0;

  const incompleteTasks = tasks.filter((t) => !t.fields.Completed);
  const completedTasks = tasks.filter((t) => t.fields.Completed);

  // Sort them
  incompleteTasks.sort((a, b) => (a.fields.OrderToday || 0) - (b.fields.OrderToday || 0));
  completedTasks.sort((a, b) => {
	const aTime = a.fields.CompletedTime || "";
	const bTime = b.fields.CompletedTime || "";
	return bTime.localeCompare(aTime);
  });

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  // If no tasks at all, still show countdown + an empty message
  if (tasks.length === 0) {
	return (
	  <div className="m-4">
		{/* Countdown row => with hover 'edit' link */}
		<div className="mb-2 text-sm text-red-600 font-semibold relative group inline-block">
		  {dailyCountdown}
		  <span
			className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 underline cursor-pointer"
			onClick={() => {
			  setTempTime(todayTime);
			  setShowEditTime(true);
			}}
		  >
			edit
		  </span>

		  {/* Time picker + Save if we're editing */}
		  {showEditTime && (
			<div className="mt-2 bg-white p-2 border rounded shadow inline-block">
			  <input
				type="time"
				value={tempTime}
				onChange={(e) => setTempTime(e.target.value)}
				className="border p-1 rounded"
			  />
			  <button
				onClick={handleSaveTimeChange}
				className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
			  >
				Save
			  </button>
			  <button
				onClick={() => setShowEditTime(false)}
				className="ml-1 text-sm text-gray-600 underline"
			  >
				Cancel
			  </button>
			</div>
		  )}
		</div>

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

	  {/* Countdown row => with hover 'edit' link */}
	  <div className="mb-2 text-sm text-red-600 font-semibold relative group inline-block">
		{dailyCountdown}
		<span
		  className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 underline cursor-pointer"
		  onClick={() => {
			setTempTime(todayTime);
			setShowEditTime(true);
		  }}
		>
		  edit
		</span>

		{/* Time picker + Save if user is editing */}
		{showEditTime && (
		  <div className="mt-2 bg-white p-2 border rounded shadow inline-block">
			<input
			  type="time"
			  value={tempTime}
			  onChange={(e) => setTempTime(e.target.value)}
			  className="border p-1 rounded"
			/>
			<button
			  onClick={handleSaveTimeChange}
			  className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
			>
			  Save
			</button>
			<button
			  onClick={() => setShowEditTime(false)}
			  className="ml-1 text-sm text-gray-600 underline"
			>
			  Cancel
			</button>
		  </div>
		)}
	  </div>

	  <h2 className="text-2xl font-bold mb-2">Today's Tasks</h2>

	  {/* Progress summary */}
	  <p className="text-sm text-gray-600">
		{completedCount} of {totalTasks} tasks completed ({percentage}%)
	  </p>
	  <div className="bg-gray-200 h-3 rounded mt-1 w-full max-w-md mb-4">
		<div
		  className="bg-green-500 h-3 rounded"
		  style={{ width: `${percentage}%` }}
		/>
	  </div>

	  {/* INCOMPLETE TASKS (sortable) */}
	  <ul className="mb-6 border rounded divide-y" ref={incompleteListRef}>
		{incompleteTasks.map((task) => {
		  const isEditingName = editingTaskId === task.id;
		  const isEditingNotes = editingNotesTaskId === task.id;

		  const isCompleted = !!task.fields.Completed;
		  const completedTime = task.fields.CompletedTime || null;

		  // Grab the related Idea record
		  const ideaRecord = ideas.find(
			(i) => i.fields.IdeaID === task.fields.IdeaID
		  );
		  const ideaTitle = ideaRecord?.fields.IdeaTitle || "";
		  const ideaCID = ideaRecord?.fields.IdeaID;

		  // Grab the related Milestone
		  const milestoneRecord = milestones.find(
			(m) => m.fields.MilestoneID === task.fields.MilestoneID
		  );
		  const milestoneName = milestoneRecord?.fields.MilestoneName || "";

		  // Focus
		  const isFocus = (task.fields.Focus === "today");
		  const focusEmoji = isFocus ? "☀️" : "💤";

		  return (
			<li key={task.id} className="p-3 hover:bg-gray-50 flex flex-col group">
			  {/* FIRST LINE => TaskName, Idea link, Focus toggle */}
			  <div className="flex items-center">
				{/* Draggable handle */}
				<div
				  className="drag-handle mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
				  title="Drag to reorder"
				>
				  ⇅
				</div>

				{/* Completed checkbox */}
				<input
				  type="checkbox"
				  className="mr-2"
				  checked={isCompleted}
				  onChange={() => handleToggleCompleted(task)}
				/>

				{/* Inline edit (TaskName) vs read-only */}
				{isEditingName ? (
				  <input
					autoFocus
					type="text"
					className="border-b border-gray-300 focus:outline-none flex-1"
					value={editingTaskName}
					onChange={(e) => setEditingTaskName(e.target.value)}
					onBlur={() => commitTaskEdit(task)}
					onKeyDown={(e) => {
					  if (e.key === "Enter") commitTaskEdit(task);
					  else if (e.key === "Escape") cancelEditingTask();
					}}
				  />
				) : (
				  <>
					{/* Task Name */}
					<span
					  className={`flex-1 cursor-pointer ${
						isCompleted ? "line-through text-gray-500" : ""
					  }`}
					  onClick={() => startEditingTask(task)}
					>
					  {task.fields.TaskName || "(Untitled Task)"}
					</span>

					{/* Idea Title Link in parentheses (if any) */}
					{ideaTitle && (
					  <Link
						to={`/ideas/${ideaCID}`}
						className={
						  isCompleted
							? "ml-1 text-sm line-through text-gray-500"
							: "ml-1 text-sm text-blue-600 underline"
						}
					  >
						({ideaTitle})
					  </Link>
					)}
				  </>
				)}

				{/* Toggle Focus (emoji) */}
				<span
				  className="ml-3 cursor-pointer text-xl"
				  title="Toggle Focus"
				  onClick={() => handleToggleFocus(task)}
				>
				  {focusEmoji}
				</span>
			  </div>

			  {/* Completed date/time if completed */}
			  {completedTime && (
				<p className="ml-6 mt-1 text-xs text-gray-500">
				  Completed on {new Date(completedTime).toLocaleString()}
				</p>
			  )}

			  {/* TaskNote (inline) => if we have notes or we’re editing */}
			  <div className="ml-6 mt-2">
				{isEditingNotes ? (
				  <div>
					<textarea
					  className="w-full border p-1 rounded"
					  rows={3}
					  value={editingNotesText}
					  onChange={(e) => setEditingNotesText(e.target.value)}
					/>
					<div className="mt-1 space-x-2">
					  <button
						onClick={() => commitNotesEdit(task)}
						className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
					  >
						Submit
					  </button>
					  <button
						onClick={cancelEditingNotes}
						className="px-2 py-1 text-sm bg-gray-300 rounded"
					  >
						Cancel
					  </button>
					</div>
				  </div>
				) : (
				  <>
					{task.fields.TaskNote && task.fields.TaskNote.trim().length > 0 ? (
					  <p
						className="text-sm text-gray-700 cursor-pointer whitespace-pre-line"
						onClick={() => startEditingNotes(task)}
					  >
						{task.fields.TaskNote}
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

			  {/* Milestone link */}
			  <div className="ml-6 mt-1">
				<span
				  className="text-xs text-blue-600 underline cursor-pointer"
				  onClick={() => handlePickMilestone(task)}
				>
				  {milestoneName ? milestoneName : "+ Add Milestone"}
				</span>
			  </div>
			</li>
		  );
		})}
	  </ul>

	  {/* COMPLETED TASKS */}
	  {completedTasks.length > 0 && (
		<>
		  <h3 className="text-md font-semibold mb-2">Completed</h3>
		  <ul className="border rounded divide-y">
			{completedTasks.map((task) => {
			  const isEditingName = editingTaskId === task.id;
			  const isEditingNotes = editingNotesTaskId === task.id;

			  const completedTime = task.fields.CompletedTime || null;

			  // Grab idea + milestone
			  const ideaRecord = ideas.find(
				(i) => i.fields.IdeaID === task.fields.IdeaID
			  );
			  const ideaTitle = ideaRecord?.fields.IdeaTitle || "";
			  const ideaCID = ideaRecord?.fields.IdeaID;

			  const milestoneRecord = milestones.find(
				(m) => m.fields.MilestoneID === task.fields.MilestoneID
			  );
			  const milestoneName = milestoneRecord?.fields.MilestoneName || "";

			  // Focus
			  const isFocus = (task.fields.Focus === "today");
			  const focusEmoji = isFocus ? "☀️" : "💤";

			  return (
				<li key={task.id} className="p-3 hover:bg-gray-50 flex flex-col group">
				  <div className="flex items-center">
					{/* Completed checkbox */}
					<input
					  type="checkbox"
					  className="mr-2"
					  checked={true}
					  onChange={() => handleToggleCompleted(task)}
					/>

					{isEditingName ? (
					  <input
						autoFocus
						type="text"
						className="border-b border-gray-300 focus:outline-none flex-1"
						value={editingTaskName}
						onChange={(e) => setEditingTaskName(e.target.value)}
						onBlur={() => commitTaskEdit(task)}
						onKeyDown={(e) => {
						  if (e.key === "Enter") commitTaskEdit(task);
						  else if (e.key === "Escape") cancelEditingTask();
						}}
					  />
					) : (
					  <>
						<span
						  className="flex-1 line-through text-gray-500 cursor-pointer"
						  onClick={() => startEditingTask(task)}
						>
						  {task.fields.TaskName || "(Untitled Task)"}
						</span>

						{/* Idea Title Link */}
						{ideaTitle && (
						  <Link
							to={`/ideas/${ideaCID}`}
							className="ml-1 text-sm line-through text-gray-500"
						  >
							({ideaTitle})
						  </Link>
						)}
					  </>
					)}

					<span
					  className="ml-3 cursor-pointer text-xl"
					  title="Toggle Focus"
					  onClick={() => handleToggleFocus(task)}
					>
					  {focusEmoji}
					</span>
				  </div>

				  {completedTime && (
					<p className="ml-6 mt-1 text-xs text-gray-500">
					  Completed on {new Date(completedTime).toLocaleString()}
					</p>
				  )}

				  {/* Notes => if editing or existing text */}
				  <div className="ml-6 mt-2">
					{isEditingNotes ? (
					  <div>
						<textarea
						  className="w-full border p-1 rounded"
						  rows={3}
						  value={editingNotesText}
						  onChange={(e) => setEditingNotesText(e.target.value)}
						/>
						<div className="mt-1 space-x-2">
						  <button
							onClick={() => commitNotesEdit(task)}
							className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
						  >
							Submit
						  </button>
						  <button
							onClick={cancelEditingNotes}
							className="px-2 py-1 text-sm bg-gray-300 rounded"
						  >
							Cancel
						  </button>
						</div>
					  </div>
					) : (
					  <>
						{task.fields.TaskNote && task.fields.TaskNote.trim().length > 0 ? (
						  <p
							className="text-sm text-gray-700 cursor-pointer whitespace-pre-line"
							onClick={() => startEditingNotes(task)}
						  >
							{task.fields.TaskNote}
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

				  <div className="ml-6 mt-1">
					<span
					  className="text-xs text-blue-600 underline cursor-pointer"
					  onClick={() => handlePickMilestone(task)}
					>
					  {milestoneName ? milestoneName : "+ Add Milestone"}
					</span>
				  </div>
				</li>
			  );
			})}
		  </ul>
		</>
	  )}
	</div>
  );
}

export default TodayView;
