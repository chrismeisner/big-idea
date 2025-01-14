// File: /src/MainContent.js

import React, { useEffect, useState, useRef } from "react";
import { getAuth } from "firebase/auth";
import Sortable from "sortablejs";
import IdeaList from "./IdeaList";
import { Bars3Icon } from "@heroicons/react/24/outline";

// Helper to chunk an array into subarrays of size `size`
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
	result.push(arr.slice(i, i + size));
  }
  return result;
}

function MainContent() {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating new ideas
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  // Hover & delete confirmations
  const [hoveredIdeaId, setHoveredIdeaId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({});

  // Airtable
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // Sortable refs
  const ideasListRef = useRef(null);
  const sortableRef = useRef(null);

  // --------------------------------------------------------------------------
  // 1) Fetch Ideas and Tasks (once on mount)
  // --------------------------------------------------------------------------
  useEffect(() => {
	const fetchIdeasAndTasks = async () => {
	  console.log("Fetching ideas and tasks...");
	  setLoading(true);
	  setError(null);

	  if (!baseId || !apiKey) {
		setError("Missing Airtable credentials.");
		setLoading(false);
		return;
	  }

	  try {
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  setError("No logged-in user.");
		  setLoading(false);
		  return;
		}

		// Fetch Ideas sorted by "Order"
		console.log("Fetching ideas from Airtable...");
		const ideasResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Ideas?sort[0][field]=Order&sort[0][direction]=asc`,
		  {
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  }
		);
		if (!ideasResp.ok) {
		  throw new Error(
			`Airtable error: ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		console.log("Fetched ideas: ", ideasData.records);

		const userPhoneNumber = currentUser.phoneNumber;
		const userIdeas = ideasData.records.filter(
		  (rec) => rec.fields.UserMobile === userPhoneNumber
		);
		console.log("Filtered ideas for user:", userPhoneNumber, userIdeas);
		setIdeas(userIdeas);

		// Fetch tasks
		console.log("Fetching tasks from Airtable...");
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
			`Airtable error: ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		console.log("Fetched tasks: ", tasksData.records);
		setTasks(tasksData.records);
	  } catch (err) {
		console.error("Error fetching data from Airtable:", err);
		setError("Failed to fetch data. Please try again later.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchIdeasAndTasks();
	// If your baseId/apiKey can change, add them as dependencies
	// }, [baseId, apiKey]);
  }, []);

  // --------------------------------------------------------------------------
  // 2) Initialize Sortable after ideas are loaded
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (
	  !loading &&
	  ideas.length > 0 &&
	  ideasListRef.current &&
	  !sortableRef.current
	) {
	  console.log("Initializing Sortable.js");
	  sortableRef.current = new Sortable(ideasListRef.current, {
		animation: 150,
		handle: ".grab-idea-handle",
		onEnd: handleSortEnd,
	  });
	  console.log("Sortable.js initialized");
	}
  }, [loading, ideas]);

  // --------------------------------------------------------------------------
  // 3) Cleanup Sortable on unmount
  // --------------------------------------------------------------------------
  useEffect(() => {
	return () => {
	  if (sortableRef.current) {
		console.log("Destroying Sortable.js instance on unmount");
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, []);

  // --------------------------------------------------------------------------
  // 4) Reorder: local + patch Airtable
  // --------------------------------------------------------------------------
  const handleSortEnd = async (evt) => {
	console.log("Drag ended:", evt);
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

	console.log("New ideas order after drag:", reordered);
	setIdeas(reordered);

	try {
	  await updateIdeasOrderInAirtable(reordered);
	  console.log("Successfully updated Airtable with new order");
	} catch (err) {
	  console.error("Error reordering ideas in Airtable:", err);
	  setError("Failed to reorder ideas. Please try again later.");
	}
  };

  // --------------------------------------------------------------------------
  // Update multiple ideas' Order in Airtable (with chunking)
  // --------------------------------------------------------------------------
  const updateIdeasOrderInAirtable = async (list) => {
	if (!baseId || !apiKey) {
	  throw new Error("Missing Airtable credentials for reorder update");
	}

	// Prepare an array of record objects
	const toUpdate = list.map((idea) => ({
	  id: idea.id,
	  fields: {
		Order: idea.fields.Order,
	  },
	}));

	// Airtable only allows up to 10 records per request,
	// so we'll chunk the `toUpdate` array in groups of 10
	const chunks = chunkArray(toUpdate, 10);

	for (const chunk of chunks) {
	  // Send each chunk in a separate PATCH request
	  console.log("Patching chunk to Airtable:", chunk);

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
		console.error("Airtable returned an error body:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }
	}
  };

  // --------------------------------------------------------------------------
  // 5) Create a new Idea at Order=1, shifting all others
  // --------------------------------------------------------------------------
  const handleCreateIdea = async (e) => {
	e.preventDefault();
	setError(null);

	console.log("Creating new idea at Order=1:", newIdeaTitle, newIdeaSummary);

	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  const auth = getAuth();
	  const currentUser = auth.currentUser;
	  if (!currentUser) {
		setError("No logged-in user.");
		return;
	  }

	  // 1) Shift all existing ideas' Order by +1 locally
	  const shifted = ideas.map((idea) => ({
		...idea,
		fields: {
		  ...idea.fields,
		  Order: idea.fields.Order + 1,
		},
	  }));

	  // 2) Update them in Airtable (in case there are more than 10, chunking happens inside updateIdeasOrderInAirtable)
	  if (shifted.length > 0) {
		await updateIdeasOrderInAirtable(shifted);
	  }

	  // 3) Create the new idea with Order = 1
	  const userPhoneNumber = currentUser.phoneNumber;
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
				UserMobile: userPhoneNumber,
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
		console.error("Airtable returned an error body:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }

	  const data = await resp.json();
	  const createdRecord = data.records[0];
	  console.log("New idea created in Airtable:", createdRecord);

	  // 4) Prepend the new idea to local state, and include the shifted ideas
	  setIdeas([createdRecord, ...shifted]);

	  // Clear input fields
	  setNewIdeaTitle("");
	  setNewIdeaSummary("");
	} catch (err) {
	  console.error("Error creating idea:", err);
	  setError("Failed to create idea. Please try again later.");
	}
  };

  // --------------------------------------------------------------------------
  // 6) Delete an Idea
  // --------------------------------------------------------------------------
  const handleDeleteClick = (ideaId) => {
	console.log("Delete clicked for ideaId:", ideaId);
	if (!deleteConfirm[ideaId]) {
	  setDeleteConfirm((prev) => ({ ...prev, [ideaId]: true }));
	  return;
	}
	console.log("Delete confirmed for ideaId:", ideaId);
	deleteIdea(ideaId);
  };

  const deleteIdea = async (ideaId) => {
	console.log("Deleting idea with ID:", ideaId);

	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  const resp = await fetch(
		`https://api.airtable.com/v0/${baseId}/Ideas/${ideaId}`,
		{
		  method: "DELETE",
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		}
	  );
	  if (!resp.ok) {
		let errorBody;
		try {
		  errorBody = await resp.json();
		} catch {
		  errorBody = {};
		}
		console.error("Airtable returned an error body:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }

	  // Remove idea from local state
	  setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId));
	  setDeleteConfirm((prev) => {
		const nextConfirm = { ...prev };
		delete nextConfirm[ideaId];
		return nextConfirm;
	  });
	  console.log("Idea deleted from Airtable:", ideaId);
	} catch (err) {
	  console.error("Error deleting idea:", err);
	  setError("Failed to delete idea. Please try again later.");
	}
  };

  // --------------------------------------------------------------------------
  // 7) Create a new Task (unchanged logic, still includes Completed=false, etc.)
  // --------------------------------------------------------------------------
  const createTask = async (ideaId, taskName) => {
	console.log("Creating task for idea:", ideaId, "Task name:", taskName);

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
				IdeaID: ideaId,
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
		console.error("Airtable returned an error body:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }

	  const data = await resp.json();
	  const newTask = data.records[0];
	  console.log("New task created in Airtable:", newTask);

	  // Update local tasks state
	  setTasks((prev) => [...prev, newTask]);
	} catch (err) {
	  console.error("Error creating task:", err);
	  setError("Failed to create task. Please try again later.");
	}
  };

  // --------------------------------------------------------------------------
  // Render UI
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <h2 className="text-2xl font-bold mb-4">Your Ideas</h2>

	  {/* Create Idea */}
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

	  {/* Idea List (child component) */}
	  <IdeaList
		ideas={ideas}
		tasks={tasks}
		ideasListRef={ideasListRef}
		hoveredIdeaId={hoveredIdeaId}
		setHoveredIdeaId={setHoveredIdeaId}
		deleteConfirm={deleteConfirm}
		handleDeleteClick={handleDeleteClick}
		onCreateTask={createTask}
	  />
	</div>
  );
}

export default MainContent;
