// File: /src/MainContent.js
import React, { useEffect, useState } from "react";
import IdeaList from "./IdeaList";
import TurnIntoTaskModal from "./TurnIntoTaskModal"; // NEW import

function MainContent({ airtableUser }) {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating new ideas
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Current user
  const userId = airtableUser?.fields?.UserID || null;

  // -----------------------------------------------------------------
  // New states for "Turn into Task" modal
  // -----------------------------------------------------------------
  const [showTurnModal, setShowTurnModal] = useState(false);
  const [ideaToConvert, setIdeaToConvert] = useState(null);

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

		// 1) Fetch Ideas => order by "Order"
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

		// 2) Fetch Tasks => filter by userId
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

  // -----------------------------------------------------------------
  //  Create a new Idea
  // -----------------------------------------------------------------
  async function handleCreateIdea(e) {
	e.preventDefault();
	if (!newIdeaTitle.trim()) return;
	if (!userId) {
	  setError("No user ID found. Please log in again.");
	  return;
	}
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
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
		console.error("Create Idea error:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }

	  const data = await resp.json();
	  const newIdea = data.records[0];
	  setIdeas((prev) => [...prev, newIdea]);

	  setNewIdeaTitle("");
	  setNewIdeaSummary("");
	} catch (err) {
	  console.error("Error creating idea =>", err);
	  setError("Failed to create idea. Please try again.");
	}
  }

  // -----------------------------------------------------------------
  //  Delete an Idea
  // -----------------------------------------------------------------
  async function handleDeleteIdea(idea) {
	setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
	try {
	  const url = `https://api.airtable.com/v0/${baseId}/Ideas/${idea.id}`;
	  const resp = await fetch(url, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!resp.ok) {
		throw new Error(
		  `Airtable Delete Idea error: ${resp.status} ${resp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Failed to delete idea =>", err);
	  // optionally revert local state if needed
	}
  }

  // -----------------------------------------------------------------
  //  Create a new Task for a given Idea
  // -----------------------------------------------------------------
  async function createTask(ideaCustomId, taskName) {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  const orderValue = tasks.length + 1; // simplistic ordering
	  const createResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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

	  if (!createResp.ok) {
		throw new Error(
		  `Create Task error: ${createResp.status} ${createResp.statusText}`
		);
	  }

	  const data = await createResp.json();
	  const newTask = data.records[0];
	  setTasks((prev) => [...prev, newTask]);
	} catch (err) {
	  console.error("Error creating task =>", err);
	  setError("Failed to create task. Please try again.");
	}
  }

  // -----------------------------------------------------------------
  //  Reorder Ideas => patch .Order in Airtable
  // -----------------------------------------------------------------
  async function handleReorderIdea(targetIdea, newPosition) {
	const sorted = [...ideas].sort(
	  (a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
	);
	const oldIndex = sorted.findIndex((i) => i.id === targetIdea.id);
	if (oldIndex === -1) return;

	const [removed] = sorted.splice(oldIndex, 1);
	sorted.splice(newPosition - 1, 0, removed);

	sorted.forEach((rec, i) => {
	  rec.fields.Order = i + 1;
	});

	setIdeas(sorted);

	// patch in chunks
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
	  // optionally revert
	}
  }

  // -----------------------------------------------------------------
  // 1) "Turn into a Task" => show modal
  // -----------------------------------------------------------------
  function handleRequestTurnIntoTask(idea) {
	setIdeaToConvert(idea);
	setShowTurnModal(true);
  }

  // -----------------------------------------------------------------
  // 2) Cancel => close modal
  // -----------------------------------------------------------------
  function handleCancelTurnIntoTask() {
	setIdeaToConvert(null);
	setShowTurnModal(false);
  }

  // -----------------------------------------------------------------
  // 3) Confirm => create new Task, delete old Idea
  // -----------------------------------------------------------------
  async function handleConfirmTurnIntoTask(destinationIdeaID) {
	if (!ideaToConvert) return;

	try {
	  // 3A) Create the new Task
	  const origTitle = ideaToConvert.fields.IdeaTitle || "(Untitled)";
	  const origSummary = ideaToConvert.fields.IdeaSummary || "";

	  // POST the new task to Airtable
	  const createResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "POST",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  fields: {
				TaskName: origTitle,
				TaskNote: origSummary,
				IdeaID: destinationIdeaID,
				UserID: userId,
				Completed: false,
			  },
			},
		  ],
		}),
	  });
	  if (!createResp.ok) {
		throw new Error(
		  `Airtable createTask error: ${createResp.status} ${createResp.statusText}`
		);
	  }
	  const createData = await createResp.json();
	  const newTask = createData.records[0];
	  setTasks((prev) => [...prev, newTask]);

	  // 3B) Delete the old Idea
	  const deleteUrl = `https://api.airtable.com/v0/${baseId}/Ideas/${ideaToConvert.id}`;
	  const deleteResp = await fetch(deleteUrl, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${apiKey}` },
	  });
	  if (!deleteResp.ok) {
		throw new Error(
		  `Airtable deleteIdea error: ${deleteResp.status} ${deleteResp.statusText}`
		);
	  }

	  // remove from local state
	  setIdeas((prev) => prev.filter((i) => i.id !== ideaToConvert.id));
	} catch (err) {
	  console.error("Error turning Idea into a Task =>", err);
	  setError("Failed to create new Task or delete old Idea. Please try again.");
	} finally {
	  // close modal
	  setIdeaToConvert(null);
	  setShowTurnModal(false);
	}
  }

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  // Sort ideas by .Order
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
		autoComplete="off"
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
			autoComplete="off"
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

	  {/* Idea List => pass the "Turn into Task" callback */}
	  <IdeaList
		ideas={sortedIdeas}
		tasks={tasks}
		onDeleteIdea={handleDeleteIdea}
		onCreateTask={createTask}
		onReorderIdea={handleReorderIdea}
		onRequestTurnIntoTask={handleRequestTurnIntoTask}
	  />

	  {/* Turn Into Task Modal */}
	  {showTurnModal && (
		<TurnIntoTaskModal
		  allIdeas={ideas}         // so user can pick which idea is the destination
		  activeIdea={ideaToConvert}
		  onClose={handleCancelTurnIntoTask}
		  onCancel={handleCancelTurnIntoTask}
		  onConfirm={handleConfirmTurnIntoTask}
		/>
	  )}
	</div>
  );
}

export default MainContent;
