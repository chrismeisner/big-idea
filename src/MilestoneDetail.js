// File: /src/MilestoneDetail.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
// import airtableBase from "./airtable"; // not strictly necessary if we do fetch calls
// import { ... } from "firebase/..."; // if you need more from Firebase

function MilestoneProgressBar({ completedTasks, totalTasks, percentage }) {
  if (totalTasks === 0) {
	return <p className="text-sm text-gray-500">No tasks yet.</p>;
  }

  return (
	<div className="mt-2">
	  <p className="text-sm text-gray-600">
		{completedTasks} of {totalTasks} tasks completed
		<span className="ml-2">({percentage}%)</span>
	  </p>
	  <div className="bg-gray-200 h-3 rounded mt-1 w-full">
		<div
		  className="bg-green-500 h-3 rounded"
		  style={{ width: `${percentage}%` }}
		/>
	  </div>
	</div>
  );
}

function MilestoneDetail({ airtableUser }) {
  const { milestoneCustomId } = useParams();
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingName, setEditingName] = useState("");

  // Countdown
  const [countdown, setCountdown] = useState("");

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
  const userId = airtableUser?.fields?.UserID || null;

  // ------------------------------------------------------------
  // 1) Fetch milestone + tasks + ideas for current user
  // ------------------------------------------------------------
  useEffect(() => {
	async function fetchData() {
	  if (!baseId || !apiKey) {
		setError("Missing Airtable credentials.");
		setLoading(false);
		return;
	  }
	  if (!userId) {
		setError("No logged-in user ID found. Please log in again.");
		setLoading(false);
		return;
	  }

	  try {
		setLoading(true);
		setError(null);

		// A) Milestone => AND(MilestoneID=..., UserID=...)
		const milestoneUrl = new URL(`https://api.airtable.com/v0/${baseId}/Milestones`);
		milestoneUrl.searchParams.set(
		  "filterByFormula",
		  `AND({MilestoneID}="${milestoneCustomId}", {UserID}="${userId}")`
		);

		const milestoneResp = await fetch(milestoneUrl.toString(), {
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
		setMilestone(milestoneData.records[0]);

		// B) Tasks => all tasks for this user
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

		// C) Ideas => also for this user
		const ideasUrl = new URL(`https://api.airtable.com/v0/${baseId}/Ideas`);
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

	  } catch (err) {
		console.error("Error fetching milestone detail:", err);
		setError("Failed to load milestone data. Please try again.");
	  } finally {
		setLoading(false);
	  }
	}

	fetchData();
  }, [baseId, apiKey, milestoneCustomId, userId]);

  // ------------------------------------------------------------
  // 2) Countdown logic (if there's a MilestoneTime)
  // ------------------------------------------------------------
  useEffect(() => {
	if (!milestone?.fields?.MilestoneTime) return;

	function computeCountdown() {
	  const target = new Date(milestone.fields.MilestoneTime).getTime();
	  const now = Date.now();
	  const diff = target - now;
	  if (diff <= 0) return "Time’s up!";

	  const totalSec = Math.floor(diff / 1000);
	  const days = Math.floor(totalSec / 86400);
	  const hours = Math.floor((totalSec % 86400) / 3600);
	  const minutes = Math.floor((totalSec % 3600) / 60);
	  const seconds = totalSec % 60;
	  return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
	}

	setCountdown(computeCountdown());
	const intervalId = setInterval(() => {
	  setCountdown(computeCountdown());
	}, 1000);

	return () => clearInterval(intervalId);
  }, [milestone?.fields?.MilestoneTime]);

  // ------------------------------------------------------------
  // 3) Inline editing the milestone title
  // ------------------------------------------------------------
  const startEditingTitle = () => {
	setIsEditingTitle(true);
	setEditingName(milestone?.fields?.MilestoneName || "");
  };

  const cancelEditingTitle = () => {
	setIsEditingTitle(false);
	setEditingName(milestone?.fields?.MilestoneName || "");
  };

  const handleTitleSave = async () => {
	const trimmed = editingName.trim();
	if (!trimmed) {
	  // revert if empty
	  cancelEditingTitle();
	  return;
	}

	try {
	  // local update
	  setMilestone((prev) => {
		if (!prev) return null;
		return {
		  ...prev,
		  fields: {
			...prev.fields,
			MilestoneName: trimmed,
		  },
		};
	  });

	  // patch to Airtable
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Milestones`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: milestone.id,
			  fields: {
				MilestoneName: trimmed,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error updating milestone title:", err);
	  setError("Failed to update milestone title. Please try again.");
	} finally {
	  setIsEditingTitle(false);
	}
  };

  // ------------------------------------------------------------
  // 4) Toggling "Focus" or "Completed" for tasks
  //    (If you want to do that from here.)
  // ------------------------------------------------------------
  const handleToggleFocus = async (task) => {
	const wasFocus = task.fields.Focus === "true";
	const newValue = wasFocus ? "" : "true";

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Focus: newValue } }
		  : t
	  )
	);

	// patch
	try {
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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
				Focus: newValue,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error toggling Focus:", err);
	  setError("Failed to toggle Focus. Please try again.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Focus: wasFocus ? "true" : "" } }
			: t
		)
	  );
	}
  };

  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				Completed: newValue,
				CompletedTime: newTime,
			  },
			}
		  : t
	  )
	);

	// patch
	try {
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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
				Completed: newValue,
				CompletedTime: newTime,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error: ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error toggling Completed:", err);
	  setError("Failed to toggle Completed. Please try again.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: {
				  ...t.fields,
				  Completed: wasCompleted,
				  CompletedTime: wasCompleted ? t.fields.CompletedTime : null,
				},
			  }
			: t
		)
	  );
	}
  };

  // ------------------------------------------------------------
  // 5) Subtasks
  //    If you want to see subtasks that do NOT have MilestoneID,
  //    that's why we fetched all tasks for this user. 
  // ------------------------------------------------------------
  function getSubtasksFor(parentTask) {
	const parentID = parentTask.fields.TaskID || null;
	if (!parentID) return [];
	return tasks.filter((x) => x.fields.ParentTask === parentID);
  }

  // ------------------------------------------------------------
  // 6) Which tasks belong to this milestone?
  // ------------------------------------------------------------
  // We'll filter tasks where `fields.MilestoneID === milestoneCustomId`
  // Then gather those "primary" tasks + any subtasks for them.
  if (milestone) {
	// we do have the milestone record
  }

  // We'll do this after we confirm milestone is loaded
  const milestoneTasks = milestone
	? tasks.filter((t) => t.fields.MilestoneID === milestoneCustomId)
	: [];

  // Combine them + their subtasks into a single array for progress
  const allMilestoneTasks = [];
  milestoneTasks.forEach((pt) => {
	allMilestoneTasks.push(pt);
	const subs = getSubtasksFor(pt);
	allMilestoneTasks.push(...subs);
  });

  const totalTasks = allMilestoneTasks.length;
  const completedTasks = allMilestoneTasks.filter((t) => t.fields.Completed)
	.length;
  const percentage =
	totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // We'll group tasks by Idea. So:
  // { ideaId -> [ tasksForThatIdea ] }
  const tasksByIdea = {};
  milestoneTasks.forEach((t) => {
	const ideaKey = t.fields.IdeaID;
	if (!tasksByIdea[ideaKey]) {
	  tasksByIdea[ideaKey] = [];
	}
	tasksByIdea[ideaKey].push(t);
  });

  // Turn that into an array
  const groupedData = Object.entries(tasksByIdea).map(([ideaCustomId, tasksForIdea]) => {
	// find the Idea record
	const ideaRecord = ideas.find((i) => i.fields.IdeaID === ideaCustomId);
	return { ideaRecord, tasks: tasksForIdea };
  });

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  if (loading) {
	return <p className="m-4">Loading milestone details...</p>;
  }
  if (error) {
	return <p className="m-4 text-red-500">{error}</p>;
  }
  if (!milestone) {
	return (
	  <p className="m-4">
		No milestone found for ID: <strong>{milestoneCustomId}</strong>
	  </p>
	);
  }

  const { MilestoneTime, MilestoneNotes, MilestoneName } = milestone.fields;

  return (
	<div className="container py-6">
	  <Link to="/milestones" className="text-blue-600 underline">
		&larr; Back to Milestones
	  </Link>

	  <div className="mt-4">
		{!isEditingTitle ? (
		  <h2 className="text-2xl font-bold inline-flex items-center">
			{MilestoneName || "(Untitled Milestone)"}
			<span
			  className="ml-2 text-blue-600 cursor-pointer"
			  onClick={startEditingTitle}
			  title="Edit Milestone Title"
			>
			  ✏️
			</span>
		  </h2>
		) : (
		  <input
			type="text"
			className="text-2xl font-bold border-b border-gray-300 focus:outline-none"
			value={editingName}
			onChange={(e) => setEditingName(e.target.value)}
			onBlur={handleTitleSave}
			onKeyDown={(e) => {
			  if (e.key === "Enter") {
				handleTitleSave();
			  } else if (e.key === "Escape") {
				cancelEditingTitle();
			  }
			}}
			autoFocus
		  />
		)}
	  </div>

	  {MilestoneTime && (
		<>
		  <p className="text-sm text-gray-600 mt-1">
			Due: {new Date(MilestoneTime).toLocaleString()}
		  </p>
		  <p className="text-lg font-medium text-red-600 mt-2">{countdown}</p>
		</>
	  )}

	  {MilestoneNotes && (
		<p className="mt-2 whitespace-pre-line">{MilestoneNotes}</p>
	  )}

	  <hr className="my-4" />
	  <MilestoneProgressBar
		completedTasks={completedTasks}
		totalTasks={totalTasks}
		percentage={percentage}
	  />
	  <hr className="my-4" />

	  <h3 className="text-xl font-semibold mb-2">
		Tasks linked to this Milestone
	  </h3>

	  {milestoneTasks.length === 0 ? (
		<p className="text-sm text-gray-500">No tasks for this milestone yet.</p>
	  ) : (
		<div className="space-y-4">
		  {groupedData.map(({ ideaRecord, tasks: tasksForIdea }) => {
			const ideaTitle = ideaRecord?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = ideaRecord?.fields?.IdeaID;

			return (
			  <div key={ideaCustomId} className="p-3 border rounded">
				{/* Idea name */}
				{ideaRecord ? (
				  <Link
					to={`/ideas/${ideaCustomId}`}
					className="text-blue-600 underline font-semibold"
				  >
					{ideaTitle}
				  </Link>
				) : (
				  <strong>{ideaTitle}</strong>
				)}

				<ul className="mt-2 space-y-3">
				  {tasksForIdea.map((task) => {
					const isCompleted = task.fields.Completed || false;
					const completedTime = task.fields.CompletedTime || null;
					const focusOn = task.fields.Focus === "true";

					// gather subtasks
					const childTasks = getSubtasksFor(task);

					return (
					  <li
						key={task.id}
						className="p-3 bg-white border rounded hover:bg-gray-50 transition"
					  >
						<div className="flex items-center">
						  <input
							type="checkbox"
							className="mr-2"
							checked={isCompleted}
							onChange={() => handleToggleCompleted(task)}
						  />
						  <div className="flex-1">
							<span
							  className={
								isCompleted ? "line-through text-gray-500" : ""
							  }
							>
							  {task.fields.TaskName || "(Untitled Task)"}
							</span>
						  </div>
						  <div className="ml-4 flex items-center space-x-1">
							<label className="text-sm">Focus</label>
							<input
							  type="checkbox"
							  checked={focusOn}
							  onChange={() => handleToggleFocus(task)}
							/>
						  </div>
						</div>
						{isCompleted && completedTime && (
						  <p className="text-xs text-gray-500 ml-6 mt-1">
							Completed on {new Date(completedTime).toLocaleString()}
						  </p>
						)}

						{/* Subtasks */}
						{childTasks.length > 0 && (
						  <ul className="mt-2 ml-6 border-l pl-3 border-gray-200 space-y-2">
							{childTasks.map((sub) => {
							  const subCompleted = sub.fields.Completed || false;
							  const subCT = sub.fields.CompletedTime || null;
							  const subFocusOn = sub.fields.Focus === "true";

							  return (
								<li key={sub.id}>
								  <div className="flex items-center">
									<input
									  type="checkbox"
									  className="mr-2"
									  checked={subCompleted}
									  onChange={() => handleToggleCompleted(sub)}
									/>
									<div className="flex-1">
									  <span
										className={
										  subCompleted
											? "line-through text-gray-500"
											: ""
										}
									  >
										{sub.fields.TaskName ||
										  "(Untitled Subtask)"}
									  </span>
									</div>
									<div className="ml-4 flex items-center space-x-1">
									  <label className="text-sm">Focus</label>
									  <input
										type="checkbox"
										checked={subFocusOn}
										onChange={() => handleToggleFocus(sub)}
									  />
									</div>
								  </div>
								  {subCompleted && subCT && (
									<p className="text-xs text-gray-500 ml-6 mt-1">
									  Completed on{" "}
									  {new Date(subCT).toLocaleString()}
									</p>
								  )}
								</li>
							  );
							})}
						  </ul>
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
