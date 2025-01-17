import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect
} from "react";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import { Link } from "react-router-dom"; // import Link so we can link to Idea detail

function TodayView({ airtableUser }) {
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);    // <-- new state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refs for Sortable
  const todayListRef = useRef(null);
  const sortableRef = useRef(null);

  const userId = airtableUser?.fields?.UserID || null;
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

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

		// Double-check that the user is logged in via Firebase
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  throw new Error("No logged-in user found in Firebase Auth.");
		}

		// 1) Fetch 'Today' tasks
		const filterFormula = `AND({Today}=TRUE(), {UserID}="${userId}")`;
		const url = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		url.searchParams.set("filterByFormula", filterFormula);
		// Sort tasks by OrderToday ascending
		url.searchParams.set("sort[0][field]", "OrderToday");
		url.searchParams.set("sort[0][direction]", "asc");

		const resp = await fetch(url.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!resp.ok) {
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}
		const data = await resp.json();
		setTasks(data.records);

		// 2) Fetch all ideas (so we can display the Idea name for each task)
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

	  } catch (err) {
		console.error("[TodayView] Error fetching tasks or ideas:", err);
		setError(err.message || "Failed to load tasks for Today.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [userId, baseId, apiKey]);

  // ------------------------------------------------------------------
  //  Sortable logic for the "OrderToday" field
  // ------------------------------------------------------------------
  useLayoutEffect(() => {
	if (!loading && tasks.length > 0 && todayListRef.current && !sortableRef.current) {
	  sortableRef.current = new Sortable(todayListRef.current, {
		animation: 150,
		handle: ".drag-handle", // Class for the drag icon
		onEnd: handleSortEnd,
	  });
	}

	// Cleanup => if tasks become empty or component unmounts
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

	// Reorder in local state
	const updated = [...tasks];
	const [moved] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, moved);

	// Reassign OrderToday (1-based) in the new order
	updated.forEach((task, i) => {
	  task.fields.OrderToday = i + 1;
	});

	setTasks(updated);

	try {
	  await patchOrderTodayToAirtable(updated);
	} catch (err) {
	  console.error("Error updating OrderToday in Airtable:", err);
	  setError("Failed to reorder tasks for Today. Please try again.");
	}
  };

  async function patchOrderTodayToAirtable(sortedTasks) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials.");
	}
	// optional chunking for large arrays
	const chunkSize = 10;
	for (let i = 0; i < sortedTasks.length; i += chunkSize) {
	  const chunk = sortedTasks.slice(i, i + chunkSize);
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
  //  Toggle Completed
  // ------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// Optimistic update
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

	// Patch to Airtable
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

  // ------------------------------------------------------------------
  //  Toggle Today
  // ------------------------------------------------------------------
  const handleToggleToday = async (task) => {
	const wasToday = task.fields.Today === true;
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
	  console.error("Error toggling Today field:", err);
	  setError("Failed to toggle the Today field. Please try again.");

	  // Revert local
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Today: wasToday } }
			: t
		)
	  );
	}
  };

  // ------------------------------------------------------------------
  //  Rendering
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
		<p>No tasks marked Today.</p>
	  </div>
	);
  }

  // A tiny helper to find an Idea record for a given Task
  const findIdeaForTask = (task) => {
	const ideaId = task.fields.IdeaID; // the custom formula in Airtable
	if (!ideaId) return null;
	return ideas.find((i) => i.fields.IdeaID === ideaId) || null;
  };

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <h2 className="text-2xl font-bold mb-4">Your Tasks for Today</h2>

	  <ul className="divide-y border rounded" ref={todayListRef}>
		{tasks.map((task, index) => {
		  const isCompleted = task.fields.Completed || false;
		  const completedTime = task.fields.CompletedTime || null;
		  // If this task is the top item, give it a gold highlight, etc.
		  const topItemClass = index === 0 ? "bg-amber-300" : "hover:bg-gray-50";

		  // Find the Idea that this task belongs to
		  const idea = findIdeaForTask(task);
		  const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
		  const ideaCustomId = idea?.fields?.IdeaID; // for linking

		  return (
			<li
			  key={task.id}
			  className={`p-3 flex flex-col transition-colors ${topItemClass}`}
			>
			  {/* Top row: drag handle + checkbox + name + 'Today' toggle */}
			  <div className="flex items-center">
				{/* Drag handle */}
				<div
				  className="drag-handle mr-3 text-gray-400 cursor-grab active:cursor-grabbing"
				  title="Drag to reorder tasks for Today"
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

				{/* Task name + optional completed date */}
				<div className="flex-1">
				  <span className={isCompleted ? "line-through text-gray-500" : ""}>
					{task.fields.TaskName || "(Untitled Task)"}
				  </span>
				  {isCompleted && completedTime && (
					<span className="ml-2 text-sm text-gray-400">
					  (Done on {new Date(completedTime).toLocaleString()})
					</span>
				  )}
				</div>

				{/* "Today" toggle */}
				<div className="ml-4 flex items-center space-x-1">
				  <label className="text-sm">Today</label>
				  <input
					type="checkbox"
					checked={task.fields.Today || false}
					onChange={() => handleToggleToday(task)}
				  />
				</div>
			  </div>

			  {/* Additional line under the task showing the Idea name + link */}
			  {idea && (
				<div className="ml-8 mt-1">
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
	</div>
  );
}

export default TodayView;
