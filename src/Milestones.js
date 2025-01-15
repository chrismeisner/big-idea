// File: /src/Milestones.js

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";
import airtableBase from "./airtable"; // your configured Airtable instance

function Milestones() {
  const [milestones, setMilestones] = useState([]);

  // Form fields
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneTime, setNewMilestoneTime] = useState("");
  const [newMilestoneNotes, setNewMilestoneNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Environment variables
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch all Milestones on mount, sorted by "Created" descending
  // --------------------------------------------------------------------------
  useEffect(() => {
	const fetchMilestones = async () => {
	  if (!baseId || !apiKey) {
		setError("Missing Airtable credentials.");
		setLoading(false);
		return;
	  }

	  try {
		const auth = getAuth();
		const currentUser = auth.currentUser;
		if (!currentUser) {
		  setError("No logged-in user. Please log in first.");
		  setLoading(false);
		  return;
		}

		setLoading(true);

		// Sort by Created (descending)
		const resp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones?sort[0][field]=Created&sort[0][direction]=desc`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!resp.ok) {
		  throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
		}

		const data = await resp.json();
		setMilestones(data.records);
	  } catch (err) {
		console.error("Error fetching milestones:", err);
		setError("Failed to fetch milestones. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchMilestones();
  }, [baseId, apiKey]);

  // --------------------------------------------------------------------------
  // 2) Create a new Milestone => prepend it to the list
  // --------------------------------------------------------------------------
  const handleCreateMilestone = async (e) => {
	e.preventDefault();
	if (!newMilestoneName.trim()) return;

	if (!baseId || !apiKey) {
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  const auth = getAuth();
	  const currentUser = auth.currentUser;
	  if (!currentUser) {
		setError("No logged-in user. Please log in.");
		return;
	  }

	  const fieldsToWrite = {
		MilestoneName: newMilestoneName,
	  };

	  // If user provided a date/time, store it
	  if (newMilestoneTime) {
		fieldsToWrite.MilestoneTime = newMilestoneTime;
	  }

	  // If user provided notes
	  if (newMilestoneNotes.trim()) {
		fieldsToWrite.MilestoneNotes = newMilestoneNotes;
	  }

	  // Make the POST request to Airtable
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Milestones`, {
		method: "POST",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  fields: fieldsToWrite,
			},
		  ],
		  typecast: true,
		}),
	  });

	  if (!resp.ok) {
		const errorBody = await resp.json();
		console.error("Airtable error body:", errorBody);
		throw new Error(`Airtable error: ${resp.status} ${resp.statusText}`);
	  }

	  const data = await resp.json();
	  const createdRecord = data.records[0];
	  console.log("Milestone created:", createdRecord);

	  // Prepend the newly created milestone
	  setMilestones((prev) => [createdRecord, ...prev]);

	  // Clear the inputs
	  setNewMilestoneName("");
	  setNewMilestoneTime("");
	  setNewMilestoneNotes("");
	} catch (err) {
	  console.error("Error creating milestone:", err);
	  setError("Failed to create milestone. Please try again.");
	}
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading milestones...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <Link to="/" className="text-blue-500 underline">
		&larr; Back to your ideas
	  </Link>

	  <h2 className="text-2xl font-bold mt-4">All Milestones</h2>

	  {/* Create Milestone form */}
	  <form onSubmit={handleCreateMilestone} className="my-4 p-4 border rounded bg-gray-50">
		<label
		  htmlFor="newMilestoneName"
		  className="block text-sm font-medium mb-1"
		>
		  Milestone Name
		</label>
		<input
		  id="newMilestoneName"
		  type="text"
		  className="border p-2 w-full mb-3"
		  placeholder="e.g. Launch Beta..."
		  value={newMilestoneName}
		  onChange={(e) => setNewMilestoneName(e.target.value)}
		  required
		/>

		<label
		  htmlFor="newMilestoneTime"
		  className="block text-sm font-medium mb-1"
		>
		  Target Date/Time
		</label>
		<input
		  id="newMilestoneTime"
		  type="datetime-local"
		  className="border p-2 w-full mb-3"
		  value={newMilestoneTime}
		  onChange={(e) => setNewMilestoneTime(e.target.value)}
		/>

		<label
		  htmlFor="newMilestoneNotes"
		  className="block text-sm font-medium mb-1"
		>
		  Notes
		</label>
		<textarea
		  id="newMilestoneNotes"
		  className="border p-2 w-full mb-3"
		  placeholder="Any notes or details..."
		  value={newMilestoneNotes}
		  onChange={(e) => setNewMilestoneNotes(e.target.value)}
		/>

		<button
		  type="submit"
		  className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
		>
		  Create Milestone
		</button>
	  </form>

	  {/* Show existing milestones */}
	  {milestones.length > 0 ? (
		<ul className="divide-y divide-gray-200 border rounded">
		  {milestones.map((m) => {
			const { MilestoneName, MilestoneTime, MilestoneNotes } = m.fields;
			return (
			  <li key={m.id} className="p-3 hover:bg-gray-50">
				<strong>{MilestoneName || "(Untitled)"}</strong>

				{MilestoneTime && (
				  <span className="ml-2 text-xs text-gray-500">
					(Due: {new Date(MilestoneTime).toLocaleString()})
				  </span>
				)}

				{MilestoneNotes && (
				  <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">
					{MilestoneNotes}
				  </p>
				)}
			  </li>
			);
		  })}
		</ul>
	  ) : (
		<p className="text-sm text-gray-500">No milestones yet.</p>
	  )}
	</div>
  );
}

export default Milestones;
