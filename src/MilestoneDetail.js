// File: /src/MilestoneDetail.js

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import * as api from "./api";

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

  const userId = airtableUser?.fields?.UserID || null;

  // Fetch milestone + tasks + ideas
  useEffect(() => {
    async function fetchData() {
      if (!userId) {
        setError("No logged-in user ID found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [milestoneData, tasksData, ideasData] = await Promise.all([
          api.getMilestoneByCustomId(milestoneCustomId),
          api.getTasks(userId),
          api.getIdeas(userId),
        ]);

        if (!milestoneData) {
          setError(`No Milestone found for ID: ${milestoneCustomId}`);
          setLoading(false);
          return;
        }

        setMilestone(milestoneData);
        setTasks(tasksData.records);
        setIdeas(ideasData.records);
      } catch (err) {
        console.error("Error fetching milestone detail:", err);
        setError("Failed to load milestone data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [milestoneCustomId, userId]);

  // Countdown logic
  useEffect(() => {
    if (!milestone?.fields?.MilestoneTime) return;

    function computeCountdown() {
      const target = new Date(milestone.fields.MilestoneTime).getTime();
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        return "Time's up!";
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

  // Inline editing of milestone title
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
      cancelEditingTitle();
      return;
    }

    try {
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

      await api.updateMilestone(milestone.id, { milestoneName: trimmed });
    } catch (err) {
      console.error("Error updating milestone title:", err);
      setError("Failed to update milestone title. Please try again.");
    } finally {
      setIsEditingTitle(false);
    }
  };

  // Date/time editing modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDateValue, setTempDateValue] = useState("");

  function formatForDateTimeLocal(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const handleDueDateClick = () => {
    if (milestone?.fields?.MilestoneTime) {
      setTempDateValue(formatForDateTimeLocal(milestone.fields.MilestoneTime));
    } else {
      setTempDateValue("");
    }
    setShowDateModal(true);
  };

  const handleCancelDateChange = () => {
    setShowDateModal(false);
    setTempDateValue("");
  };

  const handleSaveDateChange = async () => {
    try {
      const newDateISO = tempDateValue ? new Date(tempDateValue).toISOString() : null;

      setMilestone((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          fields: {
            ...prev.fields,
            MilestoneTime: newDateISO || "",
          },
        };
      });

      await api.updateMilestone(milestone.id, { milestoneTime: newDateISO || "" });
    } catch (err) {
      console.error("Error updating milestone due date:", err);
      setError("Failed to update milestone due date. Please try again.");
    } finally {
      setShowDateModal(false);
    }
  };

  // Toggling Focus or Completed for tasks
  const handleToggleFocus = async (task) => {
    const wasFocusToday = task.fields.Focus === "today";
    const newValue = wasFocusToday ? "" : "today";

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, fields: { ...t.fields, Focus: newValue } } : t
      )
    );

    try {
      await api.updateTask(task.id, { focus: newValue });
    } catch (err) {
      console.error("Error toggling Focus:", err);
      setError("Failed to toggle Focus. Please try again.");
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

    try {
      await api.updateTask(task.id, { completed: newValue, completedTime: newTime });
    } catch (err) {
      console.error("Error toggling Completed:", err);
      setError("Failed to toggle Completed. Please try again.");
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

  // Subtasks
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

  // Which tasks belong to this milestone?
  const milestoneTasks = milestone
    ? tasks.filter((t) => t.fields.MilestoneID === milestoneCustomId)
    : [];

  // Overall progress calculation
  const allMilestoneTasks = [];
  milestoneTasks.forEach((pt) => {
    allMilestoneTasks.push(pt);
    const subs = getSubtasksFor(pt);
    allMilestoneTasks.push(...subs);
  });
  const totalTasks = allMilestoneTasks.length;
  const completedTasks = allMilestoneTasks.filter((t) => t.fields.Completed).length;
  const percentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group tasks by Idea
  const tasksByIdea = {};
  milestoneTasks.forEach((t) => {
    const ideaKey = t.fields.IdeaID;
    if (!tasksByIdea[ideaKey]) {
      tasksByIdea[ideaKey] = [];
    }
    tasksByIdea[ideaKey].push(t);
  });

  const groupedData = Object.entries(tasksByIdea).map(([ideaCustomId, tasksForIdea]) => {
    const ideaRecord = ideas.find((i) => i.fields.IdeaID === ideaCustomId);

    const incomplete = tasksForIdea.filter((tt) => !tt.fields.Completed);
    incomplete.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));

    const completed = tasksForIdea.filter((tt) => tt.fields.Completed);
    completed.sort((a, b) => {
      const tA = a.fields.CompletedTime || "";
      const tB = b.fields.CompletedTime || "";
      return tB.localeCompare(tA);
    });

    const sortedTasksForIdea = [...incomplete, ...completed];
    return { ideaRecord, tasks: sortedTasksForIdea };
  });

  // Render
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
  const formattedDue = MilestoneTime ? new Date(MilestoneTime).toLocaleString() : null;

  return (
    <div className="container py-6">
      <Link to="/milestones" className="text-blue-600 underline">
        &larr; Back to Milestones
      </Link>

      {/* DATE MODAL OVERLAY */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-4 rounded shadow-md w-80">
            <h2 className="text-xl font-semibold mb-4">Edit Due Date</h2>
            <input
              type="datetime-local"
              className="border p-2 w-full rounded"
              value={tempDateValue}
              onChange={(e) => setTempDateValue(e.target.value)}
            />
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={handleCancelDateChange}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDateChange}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        {!isEditingTitle ? (
          <h2
            className="text-2xl font-bold cursor-pointer"
            onClick={startEditingTitle}
          >
            {MilestoneName || "(Untitled Milestone)"}
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

      {formattedDue && (
        <p
          className="text-sm text-gray-600 mt-1 underline cursor-pointer inline-block"
          onClick={handleDueDateClick}
        >
          Due: {formattedDue}
        </p>
      )}
      {countdown && <p className="text-lg font-medium text-red-600 mt-2">{countdown}</p>}

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

      <h3 className="text-xl font-semibold mb-2">Tasks linked to this Milestone</h3>

      {milestoneTasks.length === 0 ? (
        <p className="text-sm text-gray-500">No tasks for this milestone yet.</p>
      ) : (
        <div className="space-y-4">
          {groupedData.map(({ ideaRecord, tasks: tasksForIdea }) => {
            const ideaTitle = ideaRecord?.fields?.IdeaTitle || "(Untitled Idea)";
            const ideaCID = ideaRecord?.fields?.IdeaID;

            return (
              <div key={ideaCID} className="p-3 border rounded">
                {ideaRecord ? (
                  <Link
                    to={`/ideas/${ideaCID}`}
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
                        className="p-3 bg-white border rounded hover:bg-gray-50 transition group flex flex-col"
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
                                        {sub.fields.TaskName || "(Untitled Subtask)"}
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
                                      Completed on {new Date(subCT).toLocaleString()}
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
