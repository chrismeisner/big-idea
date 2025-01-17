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

function TodayView({ airtableUser }) {
  // ------------------------------------------------------------------
  // 1) State
  // ------------------------------------------------------------------
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For daily countdown to 4:20 PM
  const [countdown, setCountdown] = useState("");

  // ------------------------------------------------------------------
  // 2) Refs for Sortable
  // ------------------------------------------------------------------
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);

  // ------------------------------------------------------------------
  // Airtable ENV
  // ------------------------------------------------------------------
  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // ------------------------------------------------------------------
  // Daily Countdown => next 4:20 PM
  // ------------------------------------------------------------------
  useEffect(() => {
	function getNext420() {
	  const now = new Date();
	  const target = new Date(now);
	  target.setHours(16, 20, 0, 0); // 16:20:00.000

	  // If 4:20 PM is already past for today, set target to tomorrow
	  if (target <= now) {
		target.setDate(target.getDate() + 1);
	  }
	  return target;
	}

	function updateCountdown() {
	  const now = new Date();
	  const target = getNext420();
	  const diffMs = target - now;
	  if (diffMs <= 0) {
		// Just set to 0:00:00 if somehow negative
		setCountdown("00:00:00");
		return;
	  }

	  const totalSec = Math.floor(diffMs / 1000);
	  const hours = String(Math.floor(totalSec / 3600)).padStart(2, "0");
	  const minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
	  const seconds = String(totalSec % 60).padStart(2, "0");
	  setCountdown(`${hours}:${minutes}:${seconds}`);
	}

	// Update every second
	updateCountdown(); // run once immediately
	const intervalId = setInterval(updateCountdown, 1000);

	return () => clearInterval(intervalId);
  }, []);

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
		  {completedTasks} of {totalTasks} tasks completed
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
  // 3) Fetch tasks, ideas, milestones => tasks where {Focus}="today"
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

		// A) Fetch tasks where {Focus}="today"
		const filterFormula = `AND({Focus}="today", {UserID}="${userId}")`;
		const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		tasksUrl.searchParams.set("filterByFormula", filterFormula);
		// Sort tasks by OrderToday ascending
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

		// B) Fetch all Ideas
		const ideasResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Ideas`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!ideasResp.ok) {
		  throw new Error(
			`Airtable error (Ideas): ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);

		// C) Fetch all Milestones
		const msResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!msResp.ok) {
		  throw new Error(
			`Airtable error (Milestones): ${msResp.status} ${msResp.statusText}`
		  );
		}
		const msData = await msResp.json();
		setMilestones(msData.records);
	  } catch (err) {
		console.error("[TodayView] Error fetching tasks/ideas/milestones:", err);
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
	if (!loading && incompleteListRef.current && !sortableRef.current) {
	  const inc = getIncompleteTasks();
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

	const incompletes = getIncompleteTasks();
	const updatedIncompletes = [...incompletes];
	const [moved] = updatedIncompletes.splice(oldIndex, 1);
	updatedIncompletes.splice(newIndex, 0, moved);

	// Reassign OrderToday
	updatedIncompletes.forEach((task, i) => {
	  task.fields.OrderToday = i + 1;
	});

	// Combine with completed tasks
	const completed = getCompletedTasks();
	setTasks([...updatedIncompletes, ...completed]);

	try {
	  await patchOrderTodayToAirtable(updatedIncompletes);
	} catch (err) {
	  console.error("Error updating OrderToday in Airtable:", err);
	  setError("Failed to reorder tasks for Today. Please try again.");
	}
  };

  async function patchOrderTodayToAirtable(incompletesArr) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}
	const chunkSize = 10;
	for (let i = 0; i < incompletesArr.length; i += chunkSize) {
	  const chunk = incompletesArr.slice(i, i + chunkSize);
	  const records = chunk.map((task) => ({
		id: task.id,
		fields: {
		  OrderToday: task.fields.OrderToday,
		},
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
  // 5) Toggling Completed / Focus
  // ------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// Optimistic local update
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
	  console.error("Error toggling Completed:", err);
	  setError("Failed to toggle the Completed field. Please try again.");

	  // Revert local
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

  /**
   * handleToggleFocus
   * - If `task.fields.Focus === "today"`, switch to `""` (off).
   * - Else switch to `"today"` (on).
   */
  const handleToggleFocus = async (task) => {
	const wasFocusToday = task.fields.Focus === "today";
	const newValue = wasFocusToday ? "" : "today";

	// Optimistic update
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
				Focus: newValue,
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
	  console.error("Error toggling Focus field:", err);
	  setError("Failed to toggle Focus. Please try again.");

	  // Revert local
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
  // 6) Helper functions => incomplete & completed
  // ------------------------------------------------------------------
  function getIncompleteTasks() {
	const inc = tasks.filter((t) => !t.fields.Completed);
	inc.sort((a, b) => (a.fields.OrderToday || 0) - (b.fields.OrderToday || 0));
	return inc;
  }

  function getCompletedTasks() {
	const comp = tasks.filter((t) => t.fields.Completed);
	comp.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return comp;
  }

  // ------------------------------------------------------------------
  // 7) Lookup: Idea / Milestone / Parent Task
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

  /**
   * findParentTaskName:
   *  - If “ParentTask” stores a custom TaskID, then we find that parent among the tasks we have loaded.
   *  - If the parent is not in the “today” list, we might not find it. But we’ll try anyway.
   */
  function findParentTaskName(task) {
	const parentId = task.fields.ParentTask;
	if (!parentId) return null;
	// Among all tasks we have, find one whose fields.TaskID === parentId
	const parent = tasks.find((t) => t.fields.TaskID === parentId);
	if (!parent) return null;
	return parent.fields.TaskName || "(Untitled Parent)";
  }

  // ------------------------------------------------------------------
  // 8) Progress calculations
  // ------------------------------------------------------------------
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.fields.Completed).length;
  const percentage =
	totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  const incompleteTasks = getIncompleteTasks();
  const completedTasks = getCompletedTasks();

  // If zero tasks total
  if (tasks.length === 0) {
	return (
	  <div className="m-4">
		<p>No tasks with Focus="today".</p>
	  </div>
	);
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  {/* DAILY COUNTDOWN => 4:20 PM */}
	  <div className="mb-3 text-lg font-bold text-red-600">
		{countdown}
	  </div>

	  <h2 className="text-2xl font-bold mb-4">Your “Today” Tasks</h2>

	  {/* Progress Bar */}
	  <TodayProgressBar
		completedTasks={completedCount}
		totalTasks={totalTasks}
		percentage={percentage}
	  />

	  {/* ------------- INCOMPLETE TASKS ------------- */}
	  {incompleteTasks.length > 0 && (
		<ul className="divide-y border rounded mb-6" ref={incompleteListRef}>
		  {incompleteTasks.map((task, index) => {
			const isCompleted = task.fields.Completed || false;
			const completedTime = task.fields.CompletedTime || null;
			const isFocusToday = task.fields.Focus === "today";

			// "top item in gold" style
			const topItemClass =
			  index === 0 ? "bg-amber-100" : "hover:bg-gray-50";

			const idea = findIdeaForTask(task);
			const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = idea?.fields?.IdeaID;

			const milestone = findMilestoneForTask(task);
			const milestoneName = milestone?.fields?.MilestoneName || "";
			const milestoneCustomId = milestone?.fields?.MilestoneID;

			// If this task is a subtask => show the parent's name
			const parentName = findParentTaskName(task);

			return (
			  <li
				key={task.id}
				className={`p-3 flex flex-col transition-colors ${topItemClass}`}
			  >
				{/* If there's a milestone, show above the task */}
				{milestone && (
				  <div className="mb-1 inline-flex items-center ml-6">
					<span className="text-sm text-blue-700 font-semibold">
					  🏔{" "}
					  <Link
						to={`/milestones/${milestoneCustomId}`}
						className="underline"
					  >
						{milestoneName || "(Unnamed Milestone)"}
					  </Link>
					</span>
				  </div>
				)}

				{/* Row: drag handle + completed checkbox + name + "Focus" emoji */}
				<div className="flex items-center">
				  {/* Drag handle */}
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

				  {/* Completed checkbox */}
				  <input
					type="checkbox"
					checked={isCompleted}
					onChange={() => handleToggleCompleted(task)}
					className="mr-3"
				  />

				  {/* Task name */}
				  <div className="flex-1">
					<span
					  className={isCompleted ? "line-through text-gray-500" : ""}
					>
					  {task.fields.TaskName || "(Untitled Task)"}
					</span>
				  </div>

				  {/* Focus toggle => use ☀️ if Focus="today", else 💤 */}
				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(task)}
					title='Toggle "Focus" to "today"'
				  >
					{isFocusToday ? "☀️" : "💤"}
				  </span>
				</div>

				{/* Completed date if needed */}
				{isCompleted && completedTime && (
				  <p className="text-xs text-gray-500 ml-6 mt-1">
					Completed on {new Date(completedTime).toLocaleString()}
				  </p>
				)}

				{/* If this is a subtask (i.e. has a parent), display the parent's name */}
				{parentName && (
				  <p className="text-xs font-bold text-gray-600 ml-6 mt-1">
					Parent: {parentName}
				  </p>
				)}

				{/* Idea link underneath */}
				{idea && (
				  <div className="ml-6 mt-1">
					<Link
					  to={`/ideas/${ideaCustomId}`}
					  className="text-sm text-blue-600 underline"
					>
					  {ideaTitle}
					</Link>
				  </div>
				)}
			  </li>
			);
		  })}
		</ul>
	  )}

	  {/* ------------- COMPLETED TASKS ------------- */}
	  {completedTasks.length > 0 && (
		<ul className="divide-y border rounded">
		  {completedTasks.map((task) => {
			const completedTime = task.fields.CompletedTime || null;
			const isFocusToday = task.fields.Focus === "today";

			const idea = findIdeaForTask(task);
			const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = idea?.fields?.IdeaID;

			const milestone = findMilestoneForTask(task);
			const milestoneName = milestone?.fields?.MilestoneName || "";
			const milestoneCustomId = milestone?.fields?.MilestoneID;

			// Possibly show parent name if it’s a subtask
			const parentName = findParentTaskName(task);

			return (
			  <li
				key={task.id}
				className="p-3 flex flex-col hover:bg-gray-50"
			  >
				{/* If there's a milestone, show above */}
				{milestone && (
				  <div className="mb-1 inline-flex items-center ml-6">
					<span className="text-sm text-blue-700 font-semibold">
					  🏔{" "}
					  <Link
						to={`/milestones/${milestoneCustomId}`}
						className="underline"
					  >
						{milestoneName || "(Unnamed Milestone)"}
					  </Link>
					</span>
				  </div>
				)}

				{/* Completed task row => no drag handle */}
				<div className="flex items-center">
				  {/* Completed checkbox */}
				  <input
					type="checkbox"
					checked={true}
					onChange={() => handleToggleCompleted(task)}
					className="mr-3"
				  />

				  {/* Title */}
				  <div className="flex-1">
					<span className="line-through text-gray-500">
					  {task.fields.TaskName || "(Untitled Task)"}
					</span>
				  </div>

				  {/* Focus toggle => use ☀️ if Focus="today", else 💤 */}
				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(task)}
					title='Toggle "Focus" to "today"'
				  >
					{isFocusToday ? "☀️" : "💤"}
				  </span>
				</div>

				{/* Completed time below */}
				{completedTime && (
				  <p className="text-xs text-gray-500 ml-6 mt-1">
					Completed on {new Date(completedTime).toLocaleString()}
				  </p>
				)}

				{/* Parent name if subtask */}
				{parentName && (
				  <p className="text-xs font-bold text-gray-600 ml-6 mt-1">
					Parent: {parentName}
				  </p>
				)}

				{/* Idea link */}
				{idea && (
				  <div className="ml-6 mt-1">
					<Link
					  to={`/ideas/${ideaCustomId}`}
					  className="text-sm text-blue-600 underline"
					>
					  {ideaTitle}
					</Link>
				  </div>
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
