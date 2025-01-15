// File: /src/MilestoneDetail.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import airtableBase from "./airtable";

/**
 * MilestoneDetail
 * 
 * Fetch a single milestone by its custom MilestoneID (not the raw record ID),
 * plus all tasks referencing that same custom ID. 
 * Then fetch all Ideas, so we can link tasks back to their Idea pages.
 */
function MilestoneDetail() {
  const { milestoneCustomId } = useParams(); // e.g. /milestones/:milestoneCustomId
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]); // We’ll fetch ideas to display the Idea Title + link
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Environment
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  useEffect(() => {
	const fetchData = async () => {
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

		// 1) Fetch milestone via custom ID
		const milestoneUrl = `https://api.airtable.com/v0/${baseId}/Milestones?filterByFormula={MilestoneID}="${milestoneCustomId}"`;
		const milestoneResp = await fetch(milestoneUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!milestoneResp.ok) {
		  throw new Error(
			`Airtable error (Milestone): ${milestoneResp.status} ${milestoneResp.statusText}`
		  );
		}
		const milestoneData = await milestoneResp.json();
		if (milestoneData.records.length === 0) {
		  setError(`No Milestone found for ID: ${milestoneCustomId}`);
		  setLoading(false);
		  return;
		}
		const foundMilestone = milestoneData.records[0];
		setMilestone(foundMilestone);

		// 2) Fetch tasks that have {MilestoneID} = milestoneCustomId
		const tasksUrl = `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={MilestoneID}="${milestoneCustomId}"`;
		const tasksResp = await fetch(tasksUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!tasksResp.ok) {
		  throw new Error(
			`Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// 3) Fetch all Ideas
		//    We’ll display Idea Titles and link to /ideas/:IdeaID
		const ideasUrl = `https://api.airtable.com/v0/${baseId}/Ideas`;
		const ideasResp = await fetch(ideasUrl, {
		  headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!ideasResp.ok) {
		  throw new Error(
			`Airtable error (Ideas): ${ideasResp.status} ${ideasResp.statusText}`
		  );
		}
		const ideasData = await ideasResp.json();
		setIdeas(ideasData.records);

	  } catch (err) {
		console.error("Error fetching milestone detail:", err);
		setError("Failed to load milestone data. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey, milestoneCustomId]);

  if (loading) {
	return <p className="m-4">Loading milestone details...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (!milestone) {
	return <p className="m-4">No milestone found for ID: {milestoneCustomId}</p>;
  }

  const { MilestoneName, MilestoneTime, MilestoneNotes } = milestone.fields;

  // --------------------------------------------------------------------------
  // Group tasks by Idea (since each Task has fields.IdeaID as a custom formula)
  // --------------------------------------------------------------------------
  const tasksByIdea = tasks.reduce((acc, t) => {
	const ideaCustomId = t.fields.IdeaID; // e.g. "idea-xyz"
	if (!acc[ideaCustomId]) acc[ideaCustomId] = [];
	acc[ideaCustomId].push(t);
	return acc;
  }, {});

  // Build an array of { ideaRecord, tasks } for each ideaCustomId that appears
  const groupedData = Object.entries(tasksByIdea).map(([ideaCustomId, tasksForIdea]) => {
	// Attempt to find the matching idea record
	const ideaRecord = ideas.find(
	  (i) => i.fields.IdeaID === ideaCustomId
	);
	return { ideaRecord, tasks: tasksForIdea };
  });

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <Link to="/milestones" className="text-blue-600 underline">
		&larr; Back to Milestones
	  </Link>

	  <h2 className="text-2xl font-bold mt-4">
		{MilestoneName || "(Untitled Milestone)"}
	  </h2>
	  {MilestoneTime && (
		<p className="text-sm text-gray-600 mt-1">
		  Due: {new Date(MilestoneTime).toLocaleString()}
		</p>
	  )}
	  {MilestoneNotes && (
		<p className="mt-2 whitespace-pre-line">
		  {MilestoneNotes}
		</p>
	  )}

	  <hr className="my-4" />

	  <h3 className="text-xl font-semibold mb-2">Tasks linked to this Milestone</h3>

	  {tasks.length === 0 ? (
		<p className="text-sm text-gray-500">No tasks linked to this milestone yet.</p>
	  ) : (
		<div>
		  {groupedData.map(({ ideaRecord, tasks: tasksForIdea }) => {
			// If we found an idea record, we can link to /ideas/:ideaRecord.fields.IdeaID
			const ideaTitle = ideaRecord?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = ideaRecord?.fields?.IdeaID;

			return (
			  <div key={ideaCustomId} className="mb-4 p-3 border rounded">
				{ideaRecord ? (
				  <Link
					to={`/ideas/${ideaCustomId}`}
					className="text-blue-600 underline font-semibold"
				  >
					{ideaTitle}
				  </Link>
				) : (
				  // If there's no matching Idea record in Airtable, fallback
				  <strong>{ideaTitle}</strong>
				)}

				<ul className="mt-2 list-disc list-inside">
				  {tasksForIdea.map((task) => {
					const isCompleted = task.fields.Completed || false;
					return (
					  <li
						key={task.id}
						className={isCompleted ? "line-through text-gray-500" : ""}
					  >
						{task.fields.TaskName || "(Untitled Task)"}
					  </li>
					);
				  })}
				</ul>
			  </div>
			);
		  })}
		</div>
	  )}
	</div>
  );
}

export default MilestoneDetail;
