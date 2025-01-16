// File: /src/TodayView.js

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

function TodayView({ airtableUser }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

		// We'll filter tasks by "Today = TRUE" and "UserID = userId"
		const filterFormula = `AND({Today}=TRUE(), {UserID}="${userId}")`;
		const url = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		url.searchParams.set("filterByFormula", filterFormula);

		const resp = await fetch(url.toString(), {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!resp.ok) {
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}
		const data = await resp.json();
		setTasks(data.records);

	  } catch (err) {
		console.error("[TodayView] Error fetching tasks:", err);
		setError(err.message || "Failed to load tasks for Today.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [userId, baseId, apiKey]);

  // ------------------------------------------------------------------
  // Toggle the Completed field (and CompletedTime) for a given task
  // ------------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// Optimistic update in local state
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Completed: newValue, CompletedTime: newTime } }
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

	  // Revert local state
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
  // Toggle the Today field for a given task
  // (already in your existing code)
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
  // Rendering
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

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <h2 className="text-2xl font-bold mb-4">Your Tasks for Today</h2>

	  <ul className="divide-y border rounded">
		{tasks.map((task) => {
		  const isCompleted = task.fields.Completed || false;
		  const completedTime = task.fields.CompletedTime || null;

		  return (
			<li key={task.id} className="p-3 hover:bg-gray-50 flex items-center">
			  {/* Completed checkbox */}
			  <input
				type="checkbox"
				checked={isCompleted}
				onChange={() => handleToggleCompleted(task)}
				className="mr-3"
			  />

			  {/* Task name + optional completed timestamp */}
			  <div className="flex-1">
				{/* Strike-through & grey if completed */}
				<span className={isCompleted ? "line-through text-gray-500" : ""}>
				  {task.fields.TaskName || "(Untitled Task)"}
				</span>

				{/* If completed, show date/time */}
				{isCompleted && completedTime && (
				  <span className="ml-2 text-sm text-gray-400">
					(Done on {new Date(completedTime).toLocaleString()})
				  </span>
				)}
			  </div>

			  {/* "Today" toggle (to remove from Today or add again) */}
			  <div className="ml-4 flex items-center space-x-1">
				<label className="text-sm">Today</label>
				<input
				  type="checkbox"
				  checked={task.fields.Today || false}
				  onChange={() => handleToggleToday(task)}
				/>
			  </div>
			</li>
		  );
		})}
	  </ul>
	</div>
  );
}

export default TodayView;
