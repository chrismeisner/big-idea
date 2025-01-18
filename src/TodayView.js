// File: /src/TodayView.js

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
  // 0) Daily countdown to 4:20 PM
  // ------------------------------------------------------------------
  const [dailyCountdown, setDailyCountdown] = useState("");

  useEffect(() => {
	function getTargetTime() {
	  const now = new Date();
	  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 20, 0, 0);
	  if (target < now) {
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

  // Airtable env
  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Refs for Sortable
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);

  // ------------------------------------------------------------------
  // 2) Helpers for idea & milestone
  // ------------------------------------------------------------------
  function findIdeaTitle(task) {
	if (!task?.fields?.IdeaID) return "";
	const found = ideas.find((i) => i.fields.IdeaID === task.fields.IdeaID);
	return found?.fields?.IdeaTitle || "";
  }

  function findMilestoneName(task) {
	if (!task?.fields?.MilestoneID) return "";
	const rec = milestones.find((m) => m.fields.MilestoneID === task.fields.MilestoneID);
	return rec?.fields?.MilestoneName || "";
  }

  // ------------------------------------------------------------------
  // 3) Fetch tasks (Focus="today"), plus ideas + milestones
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
  // 4) Sortable for incomplete tasks
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
  // 5) Toggling Completed / Focus
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
  // 6) Inline editing => rename or "xxx" => delete
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
  // 7) Milestone assignment
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
  // 8) Today’s progress stats & partition tasks
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

	  <h2 className="text-2xl font-bold mb-2">Today's Tasks</h2>

	  {/* Progress summary */}
	  <p className="text-sm text-gray-600">
		{completedCount} of {totalTasks} tasks completed ({percentage}%)
	  </p>
	  {/* Actual progress bar */}
	  <div className="bg-gray-200 h-3 rounded mt-1 w-full max-w-md mb-4">
		<div
		  className="bg-green-500 h-3 rounded"
		  style={{ width: `${percentage}%` }}
		/>
	  </div>

	  {/* INCOMPLETE LIST */}
	  <ul className="mb-6 border rounded divide-y" ref={incompleteListRef}>
		{incompleteTasks.map((task, idx) => {
		  const isFirstItem = idx === 0;
		  const isEditing = editingTaskId === task.id;
		  const isCompleted = !!task.fields.Completed;
		  const completedTime = task.fields.CompletedTime || null;

		  const ideaTitle = findIdeaTitle(task);
		  const milestoneName = findMilestoneName(task);

		  const rowClasses = isFirstItem
			? "p-3 bg-amber-100 flex flex-col group"
			: "p-3 hover:bg-gray-50 flex flex-col group";

		  // Check if Focus = "today" => show ☀️, else 💤
		  const isFocus = (task.fields.Focus === "today");
		  const focusEmoji = isFocus ? "☀️" : "💤";

		  return (
			<li key={task.id} className={rowClasses}>
			  <div className="flex items-center">
				<div
				  className="drag-handle mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
				  title="Drag to reorder"
				>
				  ⇅
				</div>

				<input
				  type="checkbox"
				  className="mr-2"
				  checked={isCompleted}
				  onChange={() => handleToggleCompleted(task)}
				/>

				{isEditing ? (
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
				  <span
					className="flex-1 cursor-pointer"
					onClick={() => startEditingTask(task)}
				  >
					{task.fields.TaskName || "(Untitled Task)"}
					{ideaTitle && ` (${ideaTitle})`}
				  </span>
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

			  {/* Milestone link => either milestoneName or "+ Add Milestone" */}
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

	  {/* COMPLETED LIST */}
	  {completedTasks.length > 0 && (
		<>
		  <h3 className="text-md font-semibold mb-2">Completed</h3>
		  <ul className="border rounded divide-y">
			{completedTasks.map((task) => {
			  const isEditing = editingTaskId === task.id;
			  const completedTime = task.fields.CompletedTime || null;
			  const ideaTitle = findIdeaTitle(task);
			  const milestoneName = findMilestoneName(task);

			  // Check focus
			  const isFocus = (task.fields.Focus === "today");
			  const focusEmoji = isFocus ? "☀️" : "💤";

			  return (
				<li key={task.id} className="p-3 hover:bg-gray-50 flex flex-col group">
				  <div className="flex items-center">
					<input
					  type="checkbox"
					  className="mr-2"
					  checked={true}
					  onChange={() => handleToggleCompleted(task)}
					/>

					{isEditing ? (
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
					  <span
						className="flex-1 line-through text-gray-500 cursor-pointer"
						onClick={() => startEditingTask(task)}
					  >
						{task.fields.TaskName || "(Untitled Task)"}
						{ideaTitle && ` (${ideaTitle})`}
					  </span>
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
