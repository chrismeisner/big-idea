// File: /src/Milestones.js

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { Link } from "react-router-dom";
import airtableBase from "./airtable"; // your configured Airtable instance

function Milestones() {
  const [milestones, setMilestones] = useState([]);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // If you rely on environment variables:
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // --------------------------------------------------------------------------
  // 1) Fetch all Milestones on mount
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

		// Fetch Milestones sorted by Name
		const resp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones?sort[0][field]=MilestoneName&sort[0][direction]=asc`,
		  {
			headers: { Authorization: `Bearer ${apiKey}` },
		  }
		);
		if (!resp.ok) {
		  throw new Error(
			`Airtable error: ${resp.status} ${resp.statusText}`
		  );
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
  // 2) Create a new Milestone
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
			  fields: {
				MilestoneName: newMilestoneName,
				// If you have other fields like "MilestoneTime", you can add them here
			  },
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

	  // Update local state
	  setMilestones((prev) => [...prev, createdRecord]);
	  setNewMilestoneName(""); // clear input
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
		  New Milestone Name
		</label>
		<input
		  id="newMilestoneName"
		  type="text"
		  className="border p-2 w-full"
		  placeholder="e.g. Launch Beta..."
		  value={newMilestoneName}
		  onChange={(e) => setNewMilestoneName(e.target.value)}
		  required
		/>
		<button
		  type="submit"
		  className="mt-2 py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
		>
		  Create Milestone
		</button>
	  </form>

	  {/* Show existing milestones */}
	  {milestones.length > 0 ? (
		<ul className="divide-y divide-gray-200 border rounded">
		  {milestones.map((m) => {
			const { MilestoneName, MilestoneTime } = m.fields;
			return (
			  <li key={m.id} className="p-3 hover:bg-gray-50">
				<strong>{MilestoneName || "(Untitled)"}</strong>
				{MilestoneTime && (
				  <span className="ml-2 text-xs text-gray-500">
					(Due: {new Date(MilestoneTime).toLocaleString()})
				  </span>
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
