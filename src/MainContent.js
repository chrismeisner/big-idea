// File: /src/MainContent.js

import React, { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import IdeaList from "./IdeaList";
import MilestoneModal from "./MilestoneModal";
import { Bars3Icon } from "@heroicons/react/24/outline";

// Helper to chunk an array into subarrays of size `size`
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
	result.push(arr.slice(i, i + size));
  }
  return result;
}

function MainContent({ airtableUser }) {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating new ideas
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  // Hover & delete confirmations
  const [hoveredIdeaId, setHoveredIdeaId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({});

  // For milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Sortable refs
  const ideasListRef = useRef(null);
  const sortableRef = useRef(null);

  // ----------------------------------------------------------------------------
  // 1) We already have `airtableUser` => get userId from userRecord.fields.UserID
  // ----------------------------------------------------------------------------
  const userId = airtableUser?.fields?.UserID || null;

  useEffect(() => {
	// Quick guard if no userId
	if (!userId) {
	  setError("No user ID found. Please log in again.");
	  setLoading(false);
	  return;
	}

	// Also guard for missing env credentials
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  setLoading(false);
	  return;
	}

	async function fetchData() {
	  console.log("[MainContent] Starting fetchData...");
	  setLoading(true);
	  setError(null);

	  try {
		// A) Fetch Ideas belonging to this user by userId
		console.log(`[MainContent] Searching the Ideas table with UserID => ${userId}`);
		const ideasUrl = `https://api.airtable.com/v0/${baseId}/Ideas?sort[0][field]=Order&sort[0][direction]=asc&filterByFormula={UserID}="${userId}"`;
		console.log("[MainContent] ideasUrl =>", ideasUrl);

		const ideasResp = await fetch(ideasUrl, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		});
		if (!ideasResp.ok) {
		  throw new Error(
			`[MainContent] Airtable error (Ideas): ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		console.log("[MainContent] Fetched ideas =>", ideasData.records);
		setIdeas(ideasData.records);

		// B) Fetch Tasks
		console.log("[MainContent] Fetching tasks (all)...");
		const tasksResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Tasks`,
		  {
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  }
		);
		if (!tasksResp.ok) {
		  throw new Error(
			`[MainContent] Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		console.log("[MainContent] Fetched tasks =>", tasksData.records);
		setTasks(tasksData.records);

		// C) Fetch Milestones
		console.log("[MainContent] Fetching milestones...");
		const milestonesResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones`,
		  {
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  }
		);
		if (!milestonesResp.ok) {
		  throw new Error(
			`[MainContent] Airtable error (Milestones): ${milestonesResp.status} ${milestonesResp.statusText}`
		  );
		}
		const milestonesData = await milestonesResp.json();
		console.log("[MainContent] Fetched milestones =>", milestonesData.records);
		setMilestones(milestonesData.records);

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
  // 2) Initialize Sortable after ideas are loaded
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (!loading && ideas.length > 0 && ideasListRef.current && !sortableRef.current) {
	  console.log("[MainContent] Initializing Sortable.js for Ideas list...");
	  sortableRef.current = new Sortable(ideasListRef.current, {
		animation: 150,
		handle: ".grab-idea-handle",
		onEnd: handleSortEnd,
	  });
	  console.log("[MainContent] Sortable.js initialized");
	}
  }, [loading, ideas]);

  // Cleanup Sortable on unmount
  useEffect(() => {
	return () => {
	  if (sortableRef.current) {
		console.log("[MainContent] Destroying Sortable.js instance on unmount");
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, []);

  // --------------------------------------------------------------------------
  // 3) Reorder local + patch Airtable
  // --------------------------------------------------------------------------
  const handleSortEnd = async (evt) => {
	console.log("[MainContent] handleSortEnd =>", evt);
	const { oldIndex, newIndex } = evt;
	if (oldIndex === newIndex) return;

	const updated = [...ideas];
	const [movedItem] = updated.splice(oldIndex, 1);
	updated.splice(newIndex, 0, movedItem);

	// Reassign "Order"
	const reordered = updated.map((idea, i) => ({
	  ...idea,
	  fields: {
		...idea.fields,
		Order: i + 1,
	  },
	}));

	setIdeas(reordered);

	try {
	  console.log("[MainContent] Patching updated idea order to Airtable...");
	  await updateIdeasOrderInAirtable(reordered);
	  console.log("[MainContent] Successfully updated Airtable with new order");
	} catch (err) {
	  console.error("[MainContent] Error reordering ideas in Airtable:", err);
	  setError("Failed to reorder ideas. Please try again later.");
	}
  };

  const updateIdeasOrderInAirtable = async (list) => {
	if (!baseId || !apiKey) {
	  throw new Error("[MainContent] Missing Airtable credentials for reorder update");
	}

	const toUpdate = list.map((idea) => ({
	  id: idea.id,
	  fields: {
		Order: idea.fields.Order,
	  },
	}));

	const chunks = chunkArray(toUpdate, 10);
	for (const chunk of chunks) {
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: chunk,
		  typecast: true,
		}),
	  });
	  if (!resp.ok) {
		let errorBody;
		try {
		  errorBody = await resp.json();
		} catch {
		  errorBody = {};
		}
		console.error("[MainContent] Airtable error body:", errorBody);
		throw new Error(
		  `[MainContent] Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 4) Create a new Idea at Order=1, shifting all others
  // --------------------------------------------------------------------------
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
	  console.log("[MainContent] Creating new Idea =>", newIdeaTitle, newIdeaSummary);

	  // 1) Shift all existing ideas' Order by +1
	  const shifted = ideas.map((idea) => ({
		...idea,
		fields: {
		  ...idea.fields,
		  Order: idea.fields.Order + 1,
		},
	  }));
	  if (shifted.length > 0) {
		console.log("[MainContent] Patching shifted ideas to Airtable...");
		await updateIdeasOrderInAirtable(shifted);
	  }

	  // 2) Create the new idea with Order=1
	  console.log("[MainContent] Creating new idea record in Airtable with order=1...");
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
		let errorBody;
		try {
		  errorBody = await resp.json();
		} catch {
		  errorBody = {};
		}
		console.error("[MainContent] Airtable returned an error body:", errorBody);
		throw new Error(
		  `[MainContent] Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }

	  const data = await resp.json();
	  const createdRecord = data.records[0];
	  console.log("[MainContent] New idea created in Airtable =>", createdRecord);

	  // 3) Prepend the new idea in local state
	  setIdeas([createdRecord, ...shifted]);

	  // Clear input fields
	  setNewIdeaTitle("");
	  setNewIdeaSummary("");
	} catch (err) {
	  console.error("[MainContent] Error creating idea:", err);
	  setError("Failed to create idea. Please try again later.");
	}
  };

  // --------------------------------------------------------------------------
  // 5) Delete an Idea (and its associated tasks)
  // --------------------------------------------------------------------------
  const handleDeleteClick = (ideaId) => {
	if (!deleteConfirm[ideaId]) {
	  setDeleteConfirm((prev) => ({ ...prev, [ideaId]: true }));
	  return;
	}
	deleteIdea(ideaId);
  };

  async function deleteIdea(ideaId) {
	if (!baseId || !apiKey) {
	  setError("[MainContent] Missing Airtable credentials for deleteIdea.");
	  return;
	}

	try {
	  console.log("[MainContent] Deleting idea =>", ideaId);

	  // 1) Fetch tasks referencing this Idea
	  const tasksResp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={IdeaID}="${ideaId}"`,
		{
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		}
	  );
	  if (!tasksResp.ok) {
		throw new Error(
		  `[MainContent] Airtable error: ${tasksResp.status} ${tasksResp.statusText}`
		);
	  }
	  const tasksData = await tasksResp.json();
	  const taskRecords = tasksData.records;
	  console.log("[MainContent] Found tasks to delete =>", taskRecords);

	  // 2) Batch-delete the tasks
	  if (taskRecords.length > 0) {
		const taskChunks = chunkArray(taskRecords, 10);
		for (const chunk of taskChunks) {
		  const idsToDelete = chunk.map((rec) => rec.id);
		  const deleteUrl = new URL(`https://api.airtable.com/v0/${baseId}/Tasks`);
		  idsToDelete.forEach((id) =>
			deleteUrl.searchParams.append("records[]", id)
		  );

		  const deleteResp = await fetch(deleteUrl.toString(), {
			method: "DELETE",
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  });
		  if (!deleteResp.ok) {
			throw new Error(
			  `[MainContent] Airtable error (delete tasks): ${deleteResp.status} ${deleteResp.statusText}`
			);
		  }
		}
	  }

	  // 3) Delete the Idea
	  const ideaDelUrl = `https://api.airtable.com/v0/${baseId}/Ideas/${ideaId}`;
	  const resp = await fetch(ideaDelUrl, {
		method: "DELETE",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		},
	  });
	  if (!resp.ok) {
		throw new Error(
		  `[MainContent] Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }

	  // 4) Update local state
	  setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId));
	  setDeleteConfirm((prev) => {
		const nextConfirm = { ...prev };
		delete nextConfirm[ideaId];
		return nextConfirm;
	  });
	  console.log("[MainContent] Successfully deleted idea + associated tasks.");
	} catch (err) {
	  console.error("[MainContent] Error deleting idea or tasks:", err);
	  setError("Failed to delete the idea and its tasks. Please try again.");
	}
  }

  // --------------------------------------------------------------------------
  // 6) Create a new Task => store the custom IdeaID as well (PLUS UserID)
  // --------------------------------------------------------------------------
  const createTask = async (ideaCustomId, taskName) => {
	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}
	try {
	  console.log(
		"[MainContent] Creating a new task => ideaCustomId:",
		ideaCustomId,
		"taskName:",
		taskName
	  );
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
				UserID: userId, // <-- The fix: attributing the user ID
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
		let errorBody;
		try {
		  errorBody = await resp.json();
		} catch {
		  errorBody = {};
		}
		console.error("[MainContent] Airtable error body:", errorBody);
		throw new Error(
		  `[MainContent] Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }

	  const data = await resp.json();
	  const newTask = data.records[0];
	  console.log("[MainContent] Created new task record =>", newTask);
	  setTasks((prev) => [...prev, newTask]);
	} catch (err) {
	  console.error("[MainContent] Error creating task:", err);
	  setError("Failed to create task. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  // 7) Handle picking/assigning a Milestone to a Task
  // --------------------------------------------------------------------------
  const handlePickMilestone = (task) => {
	console.log("[MainContent] handlePickMilestone =>", task.id);
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  };

  const assignMilestoneToTask = async (milestone) => {
	if (!activeTaskForMilestone) return;
	console.log("[MainContent] assignMilestoneToTask => milestone:", milestone.id);

	try {
	  // local update
	  const updated = tasks.map((t) =>
		t.id === activeTaskForMilestone.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				MilestoneID: milestone.id,
			  },
			}
		  : t
	  );
	  setTasks(updated);

	  // patch to Airtable
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  console.log(
		"[MainContent] Patching MilestoneID to Airtable => task:",
		activeTaskForMilestone.id
	  );
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: activeTaskForMilestone.id,
			  fields: {
				MilestoneID: milestone.id,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `[MainContent] Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("[MainContent] Error assigning milestone:", err);
	  setError("Failed to assign milestone. Please try again.");
	} finally {
	  setShowMilestoneModal(false);
	  setActiveTaskForMilestone(null);
	}
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  {/* Milestone modal if open */}
	  {showMilestoneModal && (
		<MilestoneModal
		  allMilestones={milestones}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		/>
	  )}

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
			className="border p-2 w-full"
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
			Idea Summary
		  </label>
		  <textarea
			id="newIdeaSummary"
			className="border p-2 w-full"
			value={newIdeaSummary}
			onChange={(e) => setNewIdeaSummary(e.target.value)}
			required
		  />
		</div>
		<button
		  type="submit"
		  className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
		>
		  Create Idea
		</button>
	  </form>

	  {/* Idea List */}
	  <IdeaList
		ideas={ideas}
		tasks={tasks}
		milestones={milestones}
		ideasListRef={ideasListRef}
		hoveredIdeaId={hoveredIdeaId}
		setHoveredIdeaId={setHoveredIdeaId}
		deleteConfirm={deleteConfirm}
		handleDeleteClick={handleDeleteClick}
		onCreateTask={createTask}
		onPickMilestone={handlePickMilestone}
	  />
	</div>
  );
}

export default MainContent;
