import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import MilestoneModal from "./MilestoneModal";

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

  // --------------------------------------------------------------------------
  // 1) Fetch milestone + tasks + ideas
  // --------------------------------------------------------------------------
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

		// A) Milestone => AND(MilestoneID=..., {UserID}=...)
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

		// C) Ideas => for this user
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

  // --------------------------------------------------------------------------
  // 2) Countdown logic
  // --------------------------------------------------------------------------
  useEffect(() => {
	if (!milestone?.fields?.MilestoneTime) return;

	function computeCountdown() {
	  const target = new Date(milestone.fields.MilestoneTime).getTime();
	  const now = Date.now();
	  const diff = target - now;
	  if (diff <= 0) {
		return "Time’s up!";
	  }

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

  // --------------------------------------------------------------------------
  // 3) Inline editing of milestone title => click the title itself
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // 4) Toggling "Focus" or "Completed" for tasks
  // --------------------------------------------------------------------------
  const handleToggleFocus = async (task) => {
	const wasFocusToday = task.fields.Focus === "today";
	const newValue = wasFocusToday ? "" : "today";

	// local update
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id ? { ...t, fields: { ...t.fields, Focus: newValue } } : t
	  )
	);

	// patch
	try {
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

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

	  // revert local
	  setTasks((prev) =>
		prev.map((t) =>
		  t.id === task.id
			? { ...t, fields: { ...t.fields, Focus: task.fields.Focus } }
			: t
		)
	  );
	}
  };

  const handleToggleCompleted = async (task) => {
	const wasCompleted = task.fields.Completed || false;
	const newValue = !wasCompleted;
	const newTime = newValue ? new Date().toISOString() : null;

	// local update
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
	  if (!baseId || !apiKey) throw new Error("Missing Airtable credentials.");

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

	  // revert local
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

  // --------------------------------------------------------------------------
  // 5) Subtasks => incomplete first by SubOrder, completed last by CompletedTime desc
  // --------------------------------------------------------------------------
  function getSubtasksFor(parentTask) {
	const parentID = parentTask.fields.TaskID || null;
	if (!parentID) return [];
	const allSubs = tasks.filter((x) => x.fields.ParentTask === parentID);

	const incSubs = allSubs.filter((s) => !s.fields.Completed);
	incSubs.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));

	const compSubs = allSubs.filter((s) => s.fields.Completed);
	compSubs.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});

	return [...incSubs, ...compSubs];
  }

  // --------------------------------------------------------------------------
  // 6) Which tasks belong to this milestone?
  // --------------------------------------------------------------------------
  const milestoneTasks = milestone
	? tasks.filter((t) => t.fields.MilestoneID === milestoneCustomId)
	: [];

  // Overall progress calculation => tasks + subtasks
  const allMilestoneTasks = [];
  milestoneTasks.forEach((pt) => {
	allMilestoneTasks.push(pt);
	const subs = getSubtasksFor(pt);
	allMilestoneTasks.push(...subs);
  });
  const totalTasks = allMilestoneTasks.length;
  const completedTasks = allMilestoneTasks.filter((t) => t.fields.Completed).length;
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group tasks by Idea => used in the UI
  const tasksByIdea = {};
  milestoneTasks.forEach((t) => {
	const ideaKey = t.fields.IdeaID;
	if (!tasksByIdea[ideaKey]) {
	  tasksByIdea[ideaKey] = [];
	}
	tasksByIdea[ideaKey].push(t);
  });

  // For each idea => separate incomplete vs completed, sort them
  const groupedData = Object.entries(tasksByIdea).map(([ideaCustomId, tasksForIdea]) => {
	const ideaRecord = ideas.find((i) => i.fields.IdeaID === ideaCustomId);

	// incomplete => sort by .Order
	const incomplete = tasksForIdea.filter((tt) => !tt.fields.Completed);
	incomplete.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));

	// completed => sort by CompletedTime desc
	const completed = tasksForIdea.filter((tt) => tt.fields.Completed);
	completed.sort((a, b) => {
	  const tA = a.fields.CompletedTime || "";
	  const tB = b.fields.CompletedTime || "";
	  return tB.localeCompare(tA);
	});

	const sortedTasksForIdea = [...incomplete, ...completed];
	return { ideaRecord, tasks: sortedTasksForIdea };
  });

  // --------------------------------------------------------------------------
  // 7) Milestone picking
  // --------------------------------------------------------------------------
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  function handlePickMilestone(task) {
	setActiveTaskForMilestone(task);
	setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestoneRec) {
	if (!activeTaskForMilestone) return;
	const target = activeTaskForMilestone;
	setShowMilestoneModal(false);
	setActiveTaskForMilestone(null);

	// local
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === target.id
		  ? {
			  ...t,
			  fields: {
				...t.fields,
				MilestoneID: milestoneRec.fields.MilestoneID,
			  },
			}
		  : t
	  )
	);

	// patch
	try {
	  if (!baseId || !apiKey) return;
	  const patchResp = await fetch(`https://api.airtable.com/v0/${baseId}/Tasks`, {
		method: "PATCH",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  id: target.id,
			  fields: {
				MilestoneID: milestoneRec.fields.MilestoneID,
			  },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error (assignMilestoneToTask): ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error assigning milestone =>", err);
	  setError("Failed to assign milestone. Please refresh.");
	}
  }

  async function removeMilestoneFromTask(task) {
	if (!task) return;
	// local => clear
	setTasks((prev) =>
	  prev.map((t) =>
		t.id === task.id
		  ? { ...t, fields: { ...t.fields, MilestoneID: "" } }
		  : t
	  )
	);

	// patch
	try {
	  if (!baseId || !apiKey) return;
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
			  fields: { MilestoneID: "" },
			},
		  ],
		}),
	  });
	  if (!patchResp.ok) {
		throw new Error(
		  `Airtable error (removeMilestoneFromTask): ${patchResp.status} ${patchResp.statusText}`
		);
	  }
	} catch (err) {
	  console.error("Error removing milestone =>", err);
	  setError("Failed to remove milestone. Please refresh.");
	}
  }

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
	return (
	  <p className="m-4">
		No milestone found for ID: <strong>{milestoneCustomId}</strong>
	  </p>
	);
  }

  const { MilestoneTime, MilestoneNotes, MilestoneName } = milestone.fields;

  return (
	<div className="container py-6">
	  {showMilestoneModal && (
		<MilestoneModal
		  allMilestones={ideas /* or your real milestone array */}
		  onClose={() => {
			setShowMilestoneModal(false);
			setActiveTaskForMilestone(null);
		  }}
		  onSelect={assignMilestoneToTask}
		  onRemove={() => removeMilestoneFromTask(activeTaskForMilestone)}
		/>
	  )}

	  <Link to="/milestones" className="text-blue-600 underline">
		&larr; Back to Milestones
	  </Link>

	  <div className="mt-4">
		{/* If not editing => show H2 that is clickable */}
		{!isEditingTitle ? (
		  <h2
			className="text-2xl font-bold cursor-pointer"
			onClick={startEditingTitle}
		  >
			{MilestoneName || "(Untitled Milestone)"}
		  </h2>
		) : (
		  // If editing => show input
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
					const isFocusToday = task.fields.Focus === "today";

					const sortedSubs = getSubtasksFor(task);

					return (
					  <li
						key={task.id}
						className="
						  p-3 bg-white border rounded hover:bg-gray-50 transition
						  group flex flex-col
						"
					  >
						<div className="flex items-center">
						  {/* Completed? */}
						  <input
							type="checkbox"
							className="mr-2"
							checked={isCompleted}
							onChange={() => handleToggleCompleted(task)}
						  />

						  {/* Task name */}
						  <div className="flex-1">
							<span
							  className={
								isCompleted ? "line-through text-gray-500" : ""
							  }
							>
							  {task.fields.TaskName || "(Untitled Task)"}
							</span>
						  </div>

						  {/* Edit link => milestone modal */}
						  <span
							className="
							  ml-4 text-xs text-blue-600 underline cursor-pointer
							  hidden group-hover:inline-block
							"
							onClick={() => handlePickMilestone(task)}
						  >
							Edit
						  </span>

						  {/* Focus emoji => toggle */}
						  <span
							className="ml-3 cursor-pointer text-xl"
							title="Toggle Focus"
							onClick={() => handleToggleFocus(task)}
						  >
							{isFocusToday ? "☀️" : "💤"}
						  </span>
						</div>

						{isCompleted && completedTime && (
						  <p className="text-xs text-gray-500 ml-6 mt-1">
							Completed on {new Date(completedTime).toLocaleString()}
						  </p>
						)}

						{/* Subtasks */}
						{sortedSubs.length > 0 && (
						  <ul className="mt-2 ml-6 border-l pl-3 border-gray-200 space-y-2">
							{sortedSubs.map((sub) => {
							  const subCompleted = sub.fields.Completed || false;
							  const subCT = sub.fields.CompletedTime || null;
							  const subFocusToday = sub.fields.Focus === "today";

							  return (
								<li key={sub.id} className="py-2 pr-2 flex flex-col">
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

									<span
									  className="ml-3 cursor-pointer text-xl"
									  title="Toggle Focus"
									  onClick={() => handleToggleFocus(sub)}
									>
									  {subFocusToday ? "☀️" : "💤"}
									</span>
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
