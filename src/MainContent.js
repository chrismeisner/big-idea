// File: /src/MainContent.js
import React, { useEffect, useState, useRef } from "react";
import Sortable from "sortablejs";
import IdeaList from "./IdeaList";

function MainContent({ airtableUser }) {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState(""); // optional now

  const [hoveredIdeaId, setHoveredIdeaId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({});

  const ideasListRef = useRef(null);
  const sortableRef = useRef(null);

  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
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

		// Fetch Ideas
		const ideasUrl = new URL(`https://api.airtable.com/v0/${baseId}/Ideas`);
		ideasUrl.searchParams.set("sort[0][field]", "Order");
		ideasUrl.searchParams.set("sort[0][direction]", "asc");
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

		// Fetch Tasks
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
		console.error("[MainContent] fetchData =>", err);
		setError("Failed to fetch data. Please try again later.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [userId, baseId, apiKey]);

  // Initialize Sortable
  useEffect(() => {
	if (!loading && ideas.length > 0 && ideasListRef.current && !sortableRef.current) {
	  sortableRef.current = new Sortable(ideasListRef.current, {
		animation: 150,
		handle: ".grab-idea-handle",
		onEnd: handleSortEnd,
	  });
	}
  }, [loading, ideas]);

  useEffect(() => {
	return () => {
	  if (sortableRef.current) {
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, []);

  const handleSortEnd = async (evt) => {
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const updated = [...ideas];
	const [movedItem] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, movedItem);

	const reordered = updated.map((idea, i) => ({
	  ...idea,
	  fields: {
		...idea.fields,
		Order: i + 1,
	  },
	}));
	setIdeas(reordered);

	try {
	  await updateIdeasOrderInAirtable(reordered);
	} catch (err) {
	  console.error("Error reordering ideas =>", err);
	  setError("Failed to reorder ideas. Please try again later.");
	}
  };

  async function updateIdeasOrderInAirtable(list) {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder update");
	}
	const chunkSize = 10;
	for (let i = 0; i < list.length; i += chunkSize) {
	  const chunk = list.slice(i, i + chunkSize).map((idea) => ({
		id: idea.id,
		fields: { Order: idea.fields.Order },
	  }));
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
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

  const handleCreateIdea = async (e) => {
	e.preventDefault();
	setError(null);

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
	  // Shift existing ideas' Order by +1
	  const shifted = ideas.map((idea) => ({
		...idea,
		fields: {
		  ...idea.fields,
		  Order: (idea.fields.Order || 0) + 1,
		},
	  }));
	  if (shifted.length > 0) {
		await updateIdeasOrderInAirtable(shifted);
	  }

	  // Create new idea with Order=1
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
				IdeaSummary: newIdeaSummary, // optional
				UserMobile: airtableUser.fields.Mobile,
				UserID: userId,
				Order: 1,
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

	  setIdeas([createdRecord, ...shifted]);
	  setNewIdeaTitle("");
	  setNewIdeaSummary(""); // clear
	} catch (err) {
	  console.error("Error creating idea:", err);
	  setError("Failed to create idea. Please try again later.");
	}
  };

  async function handleDeleteIdea(idea) {
	setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
	try {
	  await fetch(`https://api.airtable.com/v0/${baseId}/Ideas/${idea.id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	} catch (err) {
	  console.error("Failed to delete idea from Airtable:", err);
	}
  }

  const createTask = async (ideaCustomId, taskName) => {
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
				CompletedTime: null,
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
	  console.error("Error creating task:", err);
	  setError("Failed to create task. Please try again.");
	}
  };

  if (loading) {
	return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  return (
	<div className="container py-6">
	  <h2 className="text-2xl font-bold mb-4">Your Ideas</h2>

	  {/* Create Idea form */}
	  <form
		onSubmit={handleCreateIdea}
		className="mb-6 p-4 border rounded bg-gray-100"
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
			placeholder="e.g. Revolutionize the coffee industry"
			value={newIdeaTitle}
			onChange={(e) => setNewIdeaTitle(e.target.value)}
			required
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
			rows={4}
			placeholder="(Brief description)"
			value={newIdeaSummary}
			onChange={(e) => setNewIdeaSummary(e.target.value)}
			// removed "required"
		  />
		</div>

		<button
		  type="submit"
		  className="py-2 px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
		>
		  Create Idea
		</button>
	  </form>

	  {/* Idea List */}
	  <IdeaList
		ideas={ideas}
		tasks={tasks}
		ideasListRef={ideasListRef}
		hoveredIdeaId={hoveredIdeaId}
		setHoveredIdeaId={setHoveredIdeaId}
		deleteConfirm={deleteConfirm}
		handleDeleteClick={() => {}}
		onCreateTask={createTask}
		onDeleteIdea={handleDeleteIdea}
	  />
	</div>
  );
}

export default MainContent;
