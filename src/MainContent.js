// File: /src/MainContent.js

import React, { useEffect, useState } from "react";
import IdeaList from "./IdeaList";

function MainContent({ airtableUser }) {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating new ideas
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Get userId
  const userId = airtableUser?.fields?.UserID || null;

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
		setError(null);

		// A) Fetch Ideas => order by "Order"
		const ideasUrl = new URL(`https://api.airtable.com/v0/${baseId}/Ideas`);
		ideasUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);
		ideasUrl.searchParams.set("sort[0][field]", "Order");
		ideasUrl.searchParams.set("sort[0][direction]", "asc");

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

		// B) Fetch Tasks => filter by userId
		const tasksUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		tasksUrl.searchParams.set("filterByFormula", `{UserID}="${userId}"`);

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
	  } catch (err) {
		console.error("[MainContent] Error fetching data:", err);
		setError("Failed to fetch data. Please try again later.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [userId, baseId, apiKey]);

  // --------------------------------------------------------------------------
  // Create a new Idea => just POST with your fields
  // --------------------------------------------------------------------------
  async function handleCreateIdea(e) {
	e.preventDefault();
	if (!newIdeaTitle.trim()) return;
	if (!userId) {
	  setError("No user ID. Please log in again.");
	  return;
	}
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  // POST a new idea
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "POST",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  fields: {
				IdeaTitle: newIdeaTitle,
				IdeaSummary: newIdeaSummary,
				UserMobile: airtableUser.fields.Mobile || "",
				UserID: userId,
			  },
			},
		  ],
		  typecast: true,
		}),
	  });
	  if (!resp.ok) {
		const errorBody = await resp.json().catch(() => ({}));
		console.error("[MainContent] create idea error:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  const data = await resp.json();
	  const createdRecord = data.records[0];

	  // local
	  setIdeas((prev) => [...prev, createdRecord]);

	  setNewIdeaTitle("");
	  setNewIdeaSummary("");
	} catch (err) {
	  console.error("Error creating idea =>", err);
	  setError("Failed to create idea. Please try again.");
	}
  }

  // --------------------------------------------------------------------------
  // Delete Idea
  // --------------------------------------------------------------------------
  async function handleDeleteIdea(idea) {
	setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
	try {
	  await fetch(`https://api.airtable.com/v0/${baseId}/Ideas/${idea.id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	} catch (err) {
	  console.error("Failed to delete idea =>", err);
	  // optionally revert
	}
  }

  // --------------------------------------------------------------------------
  // Create a new Task => same logic as before
  // --------------------------------------------------------------------------
  async function createTask(ideaCustomId, taskName) {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}
	try {
	  const orderValue = tasks.length + 1;
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
				TaskName: taskName,
				IdeaID: ideaCustomId,
				UserID: userId,
				Order: orderValue,
				Completed: false,
			  },
			},
		  ],
		  typecast: true,
		}),
	  });
	  if (!resp.ok) {
		const errorBody = await resp.json().catch(() => ({}));
		console.error("[MainContent] create task error:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	  const data = await resp.json();
	  setTasks((prev) => [...prev, data.records[0]]);
	} catch (err) {
	  console.error("Error creating task =>", err);
	  setError("Failed to create task. Please try again.");
	}
  }

  // --------------------------------------------------------------------------
  // Reorder Ideas => assign new Order field, patch to Airtable
  // --------------------------------------------------------------------------
  async function handleReorderIdea(targetIdea, newPosition) {
	// 1) Make a copy of the ideas array, sorted by .Order ascending
	const sorted = [...ideas].sort(
	  (a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
	);

	// 2) Find the old index
	const oldIndex = sorted.findIndex((i) => i.id === targetIdea.id);
	if (oldIndex === -1) return;

	// 3) Remove from array
	const [removed] = sorted.splice(oldIndex, 1);

	// 4) Insert at newPosition - 1
	sorted.splice(newPosition - 1, 0, removed);

	// 5) Reassign fields.Order = i+1
	sorted.forEach((rec, i) => {
	  rec.fields.Order = i + 1;
	});

	// 6) Update local state
	setIdeas(sorted);

	// 7) Patch new Orders to Airtable in chunks
	try {
	  const chunkSize = 10;
	  for (let i = 0; i < sorted.length; i += chunkSize) {
		const chunk = sorted.slice(i, i + chunkSize);
		const records = chunk.map((r) => ({
		  id: r.id,
		  fields: { Order: r.fields.Order },
		}));

		const patchResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Ideas`,
		  {
			method: "PATCH",
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			  "Content-Type": "application/json",
			},
			body: JSON.stringify({ records }),
		  }
		);
		if (!patchResp.ok) {
		  throw new Error(
			`Airtable patch error: ${patchResp.status} ${patchResp.statusText}`
		  );
		}
	  }
	} catch (err) {
	  console.error("Error reordering ideas in Airtable:", err);
	  // optionally revert local state if needed
	}
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  // Sort ideas by .Order for display
  const sortedIdeas = [...ideas].sort(
	(a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
  );

  return (
	<div className="container py-6">
	  <h2 className="text-2xl font-bold mb-4">Your Ideas</h2>

	  {/* Create Idea form */}
	  <form
		onSubmit={handleCreateIdea}
		className="mb-6 p-4 border rounded bg-gray-100"
		autoComplete="off"  // <-- Disable autofill at the form level
	  >
		<div className="mb-4">
		  <label
			htmlFor="newIdeaTitle"
			className="block text-sm font-medium mb-1"
		  >
			Idea Title
		  </label>
		  <input
			id="newIdeaTitle"
			type="text"
			className="border p-2 w-full text-sm"
			placeholder="e.g. Next big startup..."
			value={newIdeaTitle}
			onChange={(e) => setNewIdeaTitle(e.target.value)}
			required
			autoComplete="off"  // <-- Also disable autofill on this input
		  />
		</div>

		<div className="mb-4">
		  <label
			htmlFor="newIdeaSummary"
			className="block text-sm font-medium mb-1"
		  >
			Idea Summary (Optional)
		  </label>
		  <textarea
			id="newIdeaSummary"
			className="border p-2 w-full text-sm"
			rows={3}
			placeholder="(Brief description)"
			value={newIdeaSummary}
			onChange={(e) => setNewIdeaSummary(e.target.value)}
		  />
		</div>

		<button
		  type="submit"
		  className="py-2 px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
		>
		  Create Idea
		</button>
	  </form>

	  {/* Idea List => passing onReorderIdea */}
	  <IdeaList
		ideas={sortedIdeas}
		tasks={tasks}
		onDeleteIdea={handleDeleteIdea}
		onCreateTask={createTask}
		onReorderIdea={handleReorderIdea}
	  />
	</div>
  );
}

export default MainContent;
