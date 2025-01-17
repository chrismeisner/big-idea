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
  // 0) Daily countdown to 4:20 PM
  // ------------------------------------------------------------------
  const [dailyCountdown, setDailyCountdown] = useState("");

  useEffect(() => {
	function getTargetTime() {
	  // Build a Date object for "today at 16:20" local time
	  // If it's already past 4:20pm, schedule tomorrow at 16:20
	  const now = new Date();
	  const target = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		16, // 16 = 4pm
		20, // 20 minutes
		0,
		0
	  );
	  if (target < now) {
		target.setDate(target.getDate() + 1);
	  }
	  return target;
	}

	function updateCountdown() {
	  const now = new Date().getTime();
	  const target = getTargetTime().getTime();
	  const diffMs = target - now;

	  if (diffMs <= 0) {
		// If we've passed the time, just reset
		setDailyCountdown("Time’s up!");
		return;
	  }

	  // Convert ms => d/h/m/s
	  const totalSeconds = Math.floor(diffMs / 1000);
	  const days = Math.floor(totalSeconds / 86400);
	  const hours = Math.floor((totalSeconds % 86400) / 3600);
	  const mins = Math.floor((totalSeconds % 3600) / 60);
	  const secs = totalSeconds % 60;

	  // Build a readable string, e.g. "12h 34m 56s"
	  let result = "";
	  if (days > 0) result += `${days}d `;
	  if (days > 0 || hours > 0) result += `${hours}h `;
	  result += `${mins}m ${secs}s`;

	  setDailyCountdown(result + " until 4:20pm");
	}

	updateCountdown(); // run immediately once
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

  // ------------------------------------------------------------------
  // 2) Refs for Sortable
  // ------------------------------------------------------------------
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);
  const subtaskRefs = useRef({}); // subtaskRefs.current[parentTaskID] = DOM

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
  // 3) Fetch tasks, ideas, milestones for the current user
  //    Only tasks where {Focus}="today".
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

		// A) Fetch tasks => {Focus}="today" AND {UserID}=...
		const filterFormula = `AND({Focus}="today", {UserID}="${userId}")`;
		const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		tasksUrl.searchParams.set("filterByFormula", filterFormula);
		// Sort tasks by OrderToday asc
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

		// B) Fetch all Ideas => only for current user
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

		// C) Fetch all Milestones => only for current user
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
		console.error("[TodayView] Error fetching tasks/ideas/milestones:", err);
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
	  const inc = getIncompleteParentTasks(); // only top-level incomplete
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

	// Reorder only the top-level incomplete tasks
	const incompletes = getIncompleteParentTasks();
	const updatedIncompletes = [...incompletes];
	const [moved] = updatedIncompletes.splice(oldIndex, 1);
	updatedIncompletes.splice(newIndex, 0, moved);

	// Reassign OrderToday
	updatedIncompletes.forEach((task, i) => {
	  task.fields.OrderToday = i + 1;
	});

	// Rebuild the entire tasks array
	const completed = tasks.filter((t) => t.fields.Completed);
	const subtasksOnly = tasks.filter((t) => t.fields.ParentTask);

	setTasks([...updatedIncompletes, ...completed, ...subtasksOnly]);

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
  // 4b) Subtask Sortable => one instance per parent
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0) {
	  // For each parent, if there's a subtask list, create a Sortable
	  const parentTasks = tasks.filter((t) => !t.fields.ParentTask);
	  parentTasks.forEach((p) => {
		// We'll only do a Sortable if that parent has incomplete subtasks
		const incompleteSubs = getIncompleteSubtasks(p);
		if (incompleteSubs.length === 0) return;

		const listEl = subtaskRefs.current[p.id];
		if (!listEl) return; // hasn't rendered yet

		// If there's already a Sortable, destroy it first (to re-init)
		if (listEl._sortable) {
		  listEl._sortable.destroy();
		}

		const subSortable = new Sortable(listEl, {
		  animation: 150,
		  handle: ".sub-drag-handle",
		  onEnd: (evt) => handleSubtaskSortEnd(evt, p),
		});
		listEl._sortable = subSortable;
	  });
	}

	return () => {
	  Object.values(subtaskRefs.current).forEach((ul) => {
		if (ul && ul._sortable) {
		  ul._sortable.destroy();
		}
	  });
	};
  }, [loading, tasks]);

  async function handleSubtaskSortEnd(evt, parent) {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const incSubs = getIncompleteSubtasks(parent);
	const updatedSubs = [...incSubs];
	const [moved] = updatedSubs.splice(oldIndex, 1);
	updatedSubs.splice(newIndex, 0, moved);

	// Reassign SubOrder
	updatedSubs.forEach((st, i) => {
	  st.fields.SubOrder = i + 1;
	});

	// Rebuild local tasks
	const allOthers = tasks.filter(
	  (t) => t.fields.ParentTask !== parent.fields.TaskID
	);
	updatedSubs.forEach((u) => {
	  const idx = allOthers.findIndex((x) => x.id === u.id);
	  if (idx >= 0) {
		allOthers[idx] = u;
	  }
	});
	setTasks([...allOthers, ...updatedSubs]);

	try {
	  await patchSubOrderToAirtable(updatedSubs);
	} catch (err) {
	  console.error("Error updating SubOrder in Airtable:", err);
	  setError("Failed to reorder subtasks. Please try again.");
	}
  }

  async function patchSubOrderToAirtable(subArray) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}
	const chunkSize = 10;
	for (let i = 0; i < subArray.length; i += chunkSize) {
	  const chunk = subArray.slice(i, i + chunkSize);
	  const records = chunk.map((task) => ({
		id: task.id,
		fields: {
		  SubOrder: task.fields.SubOrder,
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

  // Toggle Focus => "today" <--> ""
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
  // 6) Helper functions => grouping tasks
  // ------------------------------------------------------------------
  function getIncompleteParentTasks() {
	const parents = tasks.filter(
	  (t) => !t.fields.ParentTask && !t.fields.Completed
	);
	parents.sort((a, b) => (a.fields.OrderToday || 0) - (b.fields.OrderToday || 0));
	return parents;
  }

  function getCompletedParentTasks() {
	const parents = tasks.filter(
	  (t) => !t.fields.ParentTask && t.fields.Completed
	);
	// sort by CompletedTime desc
	parents.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return parents;
  }

  function getIncompleteSubtasks(parentTask) {
	const parentID = parentTask.fields.TaskID;
	if (!parentID) return [];
	const subs = tasks.filter(
	  (s) => s.fields.ParentTask === parentID && !s.fields.Completed
	);
	subs.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));
	return subs;
  }

  function getCompletedSubtasks(parentTask) {
	const parentID = parentTask.fields.TaskID;
	if (!parentID) return [];
	const subs = tasks.filter(
	  (s) => s.fields.ParentTask === parentID && s.fields.Completed
	);
	subs.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});
	return subs;
  }

  // ------------------------------------------------------------------
  // 7) Lookup: Idea / Milestone
  // ------------------------------------------------------------------
  const findIdeaForTask = (task) => {
	const ideaId = task.fields.IdeaID;
	if (!ideaId) return null;
	return ideas.find((i) => i.fields.IdeaID === ideaId) || null;
  };

  const findMilestoneForTask = (task) => {
	const milestoneId = task.fields.MilestoneID;
	if (!milestoneId) return null;
	return (
	  milestones.find((m) => m.fields.MilestoneID === milestoneId) || null
	);
  };

  // ------------------------------------------------------------------
  // 8) Progress calculations => only "Focus = today" tasks
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

  // Gather top-level tasks
  const incompleteParents = getIncompleteParentTasks();
  const completedParents = getCompletedParentTasks();

  // If zero tasks total
  if (tasks.length === 0) {
	return (
	  <div className="m-4">
		<p>No tasks with Focus="today".</p>
	  </div>
	);
  }

  return (
	<div className="container py-6">
	  {/* Daily Countdown */}
	  <div className="mb-2 text-sm text-red-600 font-semibold">
		{dailyCountdown}
	  </div>

	  <h2 className="text-2xl font-bold mb-4">Today's Tasks</h2>

	  {/* Progress Bar => only counting tasks with Focus="today" */}
	  <TodayProgressBar
		completedTasks={completedCount}
		totalTasks={totalTasks}
		percentage={percentage}
	  />

	  {/* ------------- INCOMPLETE PARENTS ------------- */}
	  {incompleteParents.length > 0 && (
		<ul className="divide-y border rounded mb-6" ref={incompleteListRef}>
		  {incompleteParents.map((parent, index) => {
			const isCompleted = parent.fields.Completed || false;
			const completedTime = parent.fields.CompletedTime || null;
			const isFocusToday = parent.fields.Focus === "today";

			// "top item in gold" style
			const topItemClass =
			  index === 0 ? "bg-amber-100" : "hover:bg-gray-50";

			const idea = findIdeaForTask(parent);
			const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = idea?.fields?.IdeaID;

			const milestone = findMilestoneForTask(parent);
			const milestoneName = milestone?.fields?.MilestoneName || "";
			const milestoneCustomId = milestone?.fields?.MilestoneID;

			// Subtasks => incomplete vs completed
			const incSubs = getIncompleteSubtasks(parent);
			const compSubs = getCompletedSubtasks(parent);

			return (
			  <li
				key={parent.id}
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
					onChange={() => handleToggleCompleted(parent)}
					className="mr-3"
				  />

				  {/* Task name */}
				  <div className="flex-1">
					<span
					  className={
						isCompleted ? "line-through text-gray-500" : ""
					  }
					>
					  {parent.fields.TaskName || "(Untitled Task)"}
					</span>
				  </div>

				  {/* Focus toggle => use ☀️ if Focus="today", else 💤 */}
				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(parent)}
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

				{/* =========== SUBTASKS for this parent =========== */}
				{incSubs.length > 0 && (
				  <ul
					className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y"
					ref={(el) => (subtaskRefs.current[parent.id] = el)}
				  >
					{incSubs.map((sub, idx) => {
					  const subCompleted = sub.fields.Completed || false;
					  const subTime = sub.fields.CompletedTime || null;
					  const isFocusSub = sub.fields.Focus === "today";

					  const subIdea = findIdeaForTask(sub);
					  const subIdeaTitle =
						subIdea?.fields?.IdeaTitle || "(Untitled Idea)";
					  const subIdeaCustomId = subIdea?.fields?.IdeaID;

					  const subMile = findMilestoneForTask(sub);
					  const subMileName =
						subMile?.fields?.MilestoneName || "";
					  const subMileID = subMile?.fields?.MilestoneID;

					  return (
						<li key={sub.id} className="py-2 pr-2">
						  {/* Subtask row => sub-drag handle, completed, name, focus */}
						  <div className="flex items-center">
							{/* Drag handle (sub) */}
							<div
							  className="sub-drag-handle mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
							  title="Drag to reorder subtasks"
							>
							  ⇅
							</div>

							{/* Completed checkbox */}
							<input
							  type="checkbox"
							  checked={subCompleted}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>

							{/* Name */}
							<div className="flex-1">
							  <span
								className={
								  subCompleted
									? "line-through text-gray-500"
									: ""
								}
							  >
								{sub.fields.TaskName || "(Untitled Subtask)"}
							  </span>
							</div>

							{/* Focus toggle */}
							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle "Focus" to "today"'
							>
							  {isFocusSub ? "☀️" : "💤"}
							</span>
						  </div>

						  {subCompleted && subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on{" "}
							  {new Date(subTime).toLocaleString()}
							</p>
						  )}

						  {/* Subtask idea link */}
						  {subIdea && (
							<div className="ml-6 mt-1">
							  <Link
								to={`/ideas/${subIdeaCustomId}`}
								className="text-xs text-blue-600 underline"
							  >
								{subIdeaTitle}
							  </Link>
							</div>
						  )}

						  {/* Subtask milestone */}
						  {subMile && (
							<div className="ml-6 mt-1">
							  <span className="text-xs text-blue-700 font-semibold">
								🏔{" "}
								<Link
								  to={`/milestones/${subMileID}`}
								  className="underline"
								>
								  {subMileName || "(Unnamed Milestone)"}
								</Link>
							  </span>
							</div>
						  )}
						</li>
					  );
					})}
				  </ul>
				)}

				{/* COMPLETED SUBTASKS? */}
				{compSubs.length > 0 && (
				  <ul className="mt-1 ml-6 pl-3 border-l border-gray-200 divide-y">
					{compSubs.map((sub) => {
					  const subTime = sub.fields.CompletedTime || null;
					  const isFocusSub = sub.fields.Focus === "today";

					  return (
						<li key={sub.id} className="py-2 pr-2 flex flex-col">
						  <div className="flex items-center">
							{/* Completed checkbox */}
							<input
							  type="checkbox"
							  checked={true}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>
							<div className="flex-1">
							  <span className="line-through text-gray-500">
								{sub.fields.TaskName ||
								  "(Untitled Subtask)"}
							  </span>
							</div>
							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle "Focus" to "today"'
							>
							  {isFocusSub ? "☀️" : "💤"}
							</span>
						  </div>
						  {subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on{" "}
							  {new Date(subTime).toLocaleString()}
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

	  {/* ------------- COMPLETED PARENTS ------------- */}
	  {completedParents.length > 0 && (
		<ul className="divide-y border rounded">
		  {completedParents.map((parent) => {
			const completedTime = parent.fields.CompletedTime || null;
			const isFocusToday = parent.fields.Focus === "today";

			const idea = findIdeaForTask(parent);
			const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = idea?.fields?.IdeaID;

			const milestone = findMilestoneForTask(parent);
			const milestoneName = milestone?.fields?.MilestoneName || "";
			const milestoneCustomId = milestone?.fields?.MilestoneID;

			const incSubs = getIncompleteSubtasks(parent);
			const compSubs = getCompletedSubtasks(parent);

			return (
			  <li
				key={parent.id}
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
					onChange={() => handleToggleCompleted(parent)}
					className="mr-3"
				  />

				  {/* Title */}
				  <div className="flex-1">
					<span className="line-through text-gray-500">
					  {parent.fields.TaskName || "(Untitled Task)"}
					</span>
				  </div>

				  {/* Focus toggle => use ☀️ if Focus="today", else 💤 */}
				  <span
					className="ml-3 cursor-pointer text-xl"
					onClick={() => handleToggleFocus(parent)}
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

				{/* =========== COMPLETED parent's SUBTASKS =========== */}
				{incSubs.length > 0 && (
				  <ul className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y">
					{incSubs.map((sub) => {
					  const subCompleted = sub.fields.Completed || false;
					  const subTime = sub.fields.CompletedTime || null;
					  const isFocusSub = sub.fields.Focus === "today";

					  return (
						<li key={sub.id} className="py-2 pr-2 flex flex-col">
						  <div className="flex items-center">
							{/* Completed checkbox */}
							<input
							  type="checkbox"
							  checked={subCompleted}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>
							<div className="flex-1">
							  <span
								className={
								  subCompleted
									? "line-through text-gray-500"
									: ""
								}
							  >
								{sub.fields.TaskName || "(Untitled Subtask)"}
							  </span>
							</div>
							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle "Focus" to "today"'
							>
							  {isFocusSub ? "☀️" : "💤"}
							</span>
						  </div>
						  {subCompleted && subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on{" "}
							  {new Date(subTime).toLocaleString()}
							</p>
						  )}
						</li>
					  );
					})}
				  </ul>
				)}

				{compSubs.length > 0 && (
				  <ul className="mt-2 ml-6 pl-3 border-l border-gray-200 divide-y">
					{compSubs.map((sub) => {
					  const subTime = sub.fields.CompletedTime || null;
					  const isFocusSub = sub.fields.Focus === "today";

					  return (
						<li key={sub.id} className="py-2 pr-2 flex flex-col">
						  <div className="flex items-center">
							{/* Completed checkbox */}
							<input
							  type="checkbox"
							  checked={true}
							  onChange={() => handleToggleCompleted(sub)}
							  className="mr-3"
							/>
							<div className="flex-1">
							  <span className="line-through text-gray-500">
								{sub.fields.TaskName ||
								  "(Untitled Subtask)"}
							  </span>
							</div>
							<span
							  className="ml-3 cursor-pointer text-xl"
							  onClick={() => handleToggleFocus(sub)}
							  title='Toggle "Focus" to "today"'
							>
							  {isFocusSub ? "☀️" : "💤"}
							</span>
						  </div>
						  {subTime && (
							<p className="text-xs text-gray-500 ml-6 mt-1">
							  Completed on{" "}
							  {new Date(subTime).toLocaleString()}
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

export default TodayView;
