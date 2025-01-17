// File: /src/MilestoneDetail.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import airtableBase from "./airtable";

// Optional progress bar
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

function MilestoneDetail() {
  const { milestoneCustomId } = useParams(); // e.g. /milestones/:id
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]); // *all* tasks so we can find subtasks
  const [ideas, setIdeas] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline editing states for milestone title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingName, setEditingName] = useState("");

  // Countdown
  const [countdown, setCountdown] = useState("");

  // Airtable env
  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

  // ------------------------------------------------------------
  // 1) Fetch milestone + all tasks + ideas on mount
  // ------------------------------------------------------------
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

		// A) Milestone
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
		setMilestone(milestoneData.records[0]);

		// B) All tasks
		const tasksUrl = `https://api.airtable.com/v0/${baseId}/Tasks`;
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

		// C) Ideas
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

  // ------------------------------------------------------------
  // 2) Countdown logic
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
  // 3) Inline milestone title editing
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
	try {
	  // local update
	  setMilestone((prev) => {
		if (!prev) return null;
		return {
		  ...prev,
		  fields: {
			...prev.fields,
			MilestoneName: editingName,
		  },
		};
	  });

	  // patch
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
				MilestoneName: editingName,
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
	} finally {
	  setIsEditingTitle(false);
	}
  };

  // ------------------------------------------------------------
  // 4) Toggling "Focus" (was "Today")
  // ------------------------------------------------------------
  const handleToggleFocus = async (task) => {
	const wasFocus = (task.fields.Focus === "true");
	const newValue = !wasFocus;

	// optimistic
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, Focus: newValue ? "true" : "" } }
		  : t
	  )
	);

	// patch
	try {
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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
				Focus: newValue ? "true" : "",
			  },
			},
		  ],
		}),
	  });
	  if (!resp.ok) {
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error toggling Focus:", err);
	  setError("Failed to toggle Focus. Please try again.");

	  // revert
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? {
				...t,
				fields: { ...t.fields, Focus: wasFocus ? "true" : "" },
			  }
			: t
		)
	  );
	}
  };

  // ------------------------------------------------------------
  // 5) Toggling "Completed"
  // ------------------------------------------------------------
  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// optimistic
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
	  if (!baseId || !apiKey) {
		throw new Error("Missing Airtable credentials.");
	  }
	  const resp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
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
	  if (!resp.ok) {
		throw new Error(
		  `Airtable error: ${resp.status} ${resp.statusText}`
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
  // 6) Single-level subtask lookup
  // ------------------------------------------------------------
  function getSubtasksFor(parentTask) {
	const parentID = parentTask.fields.TaskID || null;
	if (!parentID) return [];
	return tasks.filter((x) => x.fields.ParentTask === parentID);
  }

  // ------------------------------------------------------------
  // 7) Which tasks belong to this milestone + their subtasks?
  // ------------------------------------------------------------
  // First, find tasks that directly reference this milestone
  const primaryTasks = tasks.filter(
	(t) => t.fields.MilestoneID === milestoneCustomId
  );

  // Then gather them + their subtasks into a single array for counting progress
  const allMilestoneTasks = [];
  for (const pt of primaryTasks) {
	allMilestoneTasks.push(pt);
	const subs = getSubtasksFor(pt);
	allMilestoneTasks.push(...subs);
  }

  // From that combined array, compute how many are completed
  const totalTasks = allMilestoneTasks.length;
  const completedTasks = allMilestoneTasks.filter((t) => t.fields.Completed)
	.length;
  const percentage =
	totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // For display grouping, let's group only the **primary** tasks by Idea
  // Then, under each primary task, we'll render its subtasks
  const tasksByIdea = primaryTasks.reduce((acc, t) => {
	const ideaKey = t.fields.IdeaID;
	if (!acc[ideaKey]) acc[ideaKey] = [];
	acc[ideaKey].push(t);
	return acc;
  }, {});
  const groupedData = Object.entries(tasksByIdea).map(([ideaCustomId, tasksForIdea]) => {
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

  const { MilestoneTime, MilestoneNotes } = milestone.fields;

  return (
	<div className="container py-6">
	  {/* Link back */}
	  <Link to="/milestones" className="text-blue-600 underline">
		&larr; Back to Milestones
	  </Link>

	  {/* Title row */}
	  <div className="mt-4">
		{!isEditingTitle ? (
		  <h2 className="text-2xl font-bold inline-flex items-center">
			{milestone.fields.MilestoneName || "(Untitled Milestone)"}
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

	  {/* MilestoneTime + countdown */}
	  {MilestoneTime && (
		<>
		  <p className="text-sm text-gray-600 mt-1">
			Due: {new Date(MilestoneTime).toLocaleString()}
		  </p>
		  <p className="text-lg font-medium text-red-600 mt-2">{countdown}</p>
		</>
	  )}

	  {/* Notes */}
	  {MilestoneNotes && (
		<p className="mt-2 whitespace-pre-line">{MilestoneNotes}</p>
	  )}

	  {/* Progress bar */}
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

	  {primaryTasks.length === 0 ? (
		<p className="text-sm text-gray-500">No tasks for this milestone yet.</p>
	  ) : (
		<div className="space-y-4">
		  {groupedData.map(({ ideaRecord, tasks: tasksForIdea }) => {
			const ideaTitle = ideaRecord?.fields?.IdeaTitle || "(Untitled Idea)";
			const ideaCustomId = ideaRecord?.fields?.IdeaID;

			return (
			  <div key={ideaCustomId} className="p-3 border rounded">
				{/* Idea name/link */}
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
					const focusOn = (task.fields.Focus === "true");

					// Subtasks
					const childTasks = getSubtasksFor(task);

					return (
					  <li
						key={task.id}
						className="p-3 bg-white border rounded hover:bg-gray-50 transition"
					  >
						{/* Top row: completed checkbox + name + Focus toggle */}
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

						{/* Subtasks (indented) */}
						{childTasks.length > 0 && (
						  <ul className="mt-2 ml-6 border-l pl-3 border-gray-200 space-y-2">
							{childTasks.map((sub) => {
							  const subCompleted = sub.fields.Completed || false;
							  const subCompletedTime = sub.fields.CompletedTime || null;
							  const subFocusOn = (sub.fields.Focus === "true");

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
								  {subCompleted && subCompletedTime && (
									<p className="text-xs text-gray-500 ml-6 mt-1">
									  Completed on{" "}
									  {new Date(subCompletedTime).toLocaleString()}
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
