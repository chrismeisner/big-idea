// File: /src/MilestoneDetail.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";

/**
 * MilestoneDetail
 * 
 * Displays the details of a single Milestone (by ID), plus
 * all Tasks referencing this Milestone, grouped by their Idea.
 */
function MilestoneDetail() {
  const { milestoneId } = useParams(); // e.g. "recABC123..."
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
		  setError("No logged-in user.");
		  setLoading(false);
		  return;
		}

		setLoading(true);

		// 1) Fetch the single Milestone record
		//    Here we assume "milestoneId" is the Airtable record's actual ID (e.g. "recXYZ123")
		//    If you store a custom formula ID, adjust your filter accordingly.
		const milestoneResp = await fetch(
		  `https://api.airtable.com/v0/${baseId}/Milestones/${milestoneId}`,
		  {
			headers: {
			  Authorization: `Bearer ${apiKey}`,
			},
		  }
		);
		if (!milestoneResp.ok) {
		  throw new Error(
			`Airtable error (Milestone): ${milestoneResp.status} ${milestoneResp.statusText}`
		  );
		}
		const milestoneData = await milestoneResp.json();
		setMilestone(milestoneData);

		// 2) Fetch all Tasks referencing this Milestone ID
		//    (filterByFormula: WHERE {MilestoneID} = "recXYZ123")
		const tasksUrl = `https://api.airtable.com/v0/${baseId}/Tasks?filterByFormula={MilestoneID}="${milestoneId}"`;
		const tasksResp = await fetch(tasksUrl, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		});
		if (!tasksResp.ok) {
		  throw new Error(
			`Airtable error (Tasks): ${tasksResp.status} ${tasksResp.statusText}`
		  );
		}
		const tasksData = await tasksResp.json();
		setTasks(tasksData.records);

		// 3) (Optional) Fetch all Ideas so we can group tasks by Idea
		const ideasUrl = `https://api.airtable.com/v0/${baseId}/Ideas`;
		const ideasResp = await fetch(ideasUrl, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
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
		setError("Failed to load milestone info. Please try again.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchData();
  }, [baseId, apiKey, milestoneId]);

  // --------------------------------------------------------------------------
  // Group tasks by Idea
  // --------------------------------------------------------------------------
  // Each Task has something like .fields.IdeaID (your custom formula) OR 
  // .fields.Idea (which might be a foreign link). Adjust accordingly.

  // We'll build an object mapping IdeaID -> array of tasks
  const tasksByIdea = {};
  tasks.forEach((t) => {
	const ideaId = t.fields.IdeaID; // or t.fields.Idea[0] if it's a linked record array
	if (!tasksByIdea[ideaId]) {
	  tasksByIdea[ideaId] = [];
	}
	tasksByIdea[ideaId].push(t);
  });

  // Then we can create an array of [ideaRecord, tasksForThatIdea].
  // We'll find the actual Idea record in `ideas` by matching .id or a custom field
  const groupedData = Object.entries(tasksByIdea).map(([ideaId, theseTasks]) => {
	// Attempt to find the Idea record
	// If your tasks store the real Airtable record ID in .fields.Idea,
	// you can compare ideaId to ideaRecord.id
	const ideaRecord = ideas.find((i) => i.id === ideaId);

	return {
	  idea: ideaRecord,
	  tasks: theseTasks,
	};
  });

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading milestone details...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (!milestone) {
	return <p className="m-4">No milestone found for ID: {milestoneId}</p>;
  }

  // Grab fields from the milestone record
  const { MilestoneName, MilestoneTime, MilestoneNotes } = milestone.fields || {};

  return (
	<div className="max-w-md mx-auto px-4 py-6">
	  <Link to="/milestones" className="text-blue-600 underline">
		&larr; Back to Milestones
	  </Link>

	  <h2 className="text-2xl font-bold mt-4">{MilestoneName || "(Untitled)"}</h2>
	  {MilestoneTime && (
		<p className="text-sm text-gray-600 mt-1">
		  Due: {new Date(MilestoneTime).toLocaleString()}
		</p>
	  )}
	  {MilestoneNotes && <p className="mt-2">{MilestoneNotes}</p>}

	  <hr className="my-4" />

	  <h3 className="text-xl font-semibold mb-2">Tasks referencing this Milestone</h3>

	  {tasks.length === 0 ? (
		<p className="text-gray-500">No tasks are linked to this milestone yet.</p>
	  ) : (
		<div>
		  {groupedData.map(({ idea, tasks: tasksForIdea }) => {
			// If we found an idea record
			const ideaTitle = idea?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaId = idea?.fields?.IdeaID; // or idea?.id, whichever you use
			return (
			  <div key={ideaId} className="mb-4 p-3 border rounded">
				{/* Show Idea Title, link to /ideas/:customIdeaId if you want */}
				{idea ? (
				  <Link
					to={`/ideas/${idea.fields.IdeaID}`}
					className="text-blue-600 underline font-semibold"
				  >
					{ideaTitle}
				  </Link>
				) : (
				  <strong>{ideaTitle}</strong>
				)}

				<ul className="mt-2 list-disc list-inside">
				  {tasksForIdea.map((task) => {
					const isCompleted = task.fields.Completed || false;
					const completedTime = task.fields.CompletedTime || null;
					return (
					  <li key={task.id} className={isCompleted ? "line-through" : ""}>
						{task.fields.TaskName}
						{isCompleted && completedTime && (
						  <span className="ml-2 text-sm text-gray-500">
							(Done {new Date(completedTime).toLocaleString()})
						  </span>
						)}
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
