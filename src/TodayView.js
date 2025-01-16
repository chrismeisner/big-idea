// File: /src/TodayView.js

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

/**
 * TodayView
 * 
 * Shows only tasks from the *logged-in user* (matching {UserID}),
 * where {Today} is TRUE in Airtable.
 */
function TodayView({ airtableUser }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // If user hasn't loaded or no fields, bail out
  const userId = airtableUser?.fields?.UserID || null;

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  useEffect(() => {
	// If we have no user ID, or missing environment, just stop
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
		// Booleans in Airtable are either 0/1 or false/true. If your field
		// is a checkbox, you can typically do {Today}=TRUE() or =1.
		const filterFormula = `AND({Today}=TRUE(), {UserID}="${userId}")`;

		const url = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		url.searchParams.set("filterByFormula", filterFormula);
		// Optional: sort by something, e.g. "OrderToday"
		// url.searchParams.append("sort[0][field]", "OrderToday");
		// url.searchParams.append("sort[0][direction]", "asc");

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

  // A simple function to toggle the "Today" checkbox off (removes from today's list)
  const handleToggleToday = async (task) => {
	// We'll do an optimistic update
	const wasToday = task.fields.Today === true;
	const newValue = !wasToday;

	// Remove or set "Today" in local state
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id ? { ...t, fields: { ...t.fields, Today: newValue } } : t
	  )
	);

	// Then patch to Airtable
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
				  Today: newValue,
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
	  console.error("Error toggling Today field:", err);
	  setError("Failed to toggle the Today field. Please try again.");
	  // revert local
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Today: wasToday } }
			: t
		)
	  );
	}
  };

  // ----------------------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your tasks for Today...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  // If no tasks found
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
		{tasks.map((task) => (
		  <li key={task.id} className="p-3 hover:bg-gray-50 flex items-center">
			<div className="flex-1">
			  {/* Show the TaskName, or fallback */}
			  {task.fields.TaskName || "(Untitled Task)"}
			</div>
			<div className="ml-2">
			  <label className="mr-1 text-sm">Today</label>
			  <input
				type="checkbox"
				checked={task.fields.Today || false}
				onChange={() => handleToggleToday(task)}
			  />
			</div>
		  </li>
		))}
	  </ul>
	</div>
  );
}

export default TodayView;
