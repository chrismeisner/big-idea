// File: /Users/chrismeisner/Projects/big-idea/src/TodayView.js

import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect
} from "react";
import Sortable from "sortablejs";
import { Link } from "react-router-dom";

import MilestoneModal from "./MilestoneModal";
import * as api from "./api";

function TodayView({ airtableUser }) {
  // Daily countdown to user's chosen time
  const [dailyCountdown, setDailyCountdown] = useState("");
  const [showEditTime, setShowEditTime] = useState(false);
  const [tempTime, setTempTime] = useState("");
  const [todayTime, setTodayTime] = useState("16:20");

  // Load user's TodayTime
  useEffect(() => {
    if (airtableUser && airtableUser.fields.TodayTime) {
      setTodayTime(airtableUser.fields.TodayTime);
    } else {
      setTodayTime("16:20");
    }
  }, [airtableUser]);

  // Countdown logic
  useEffect(() => {
    function getTargetTime() {
      const now = new Date();
      const [hours, minutes] = todayTime.split(":").map(Number);
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
        0,
        0
      );
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      return target;
    }

    function updateCountdown() {
      const diff = getTargetTime().getTime() - Date.now();
      if (diff <= 0) {
        setDailyCountdown("Time's up!");
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      let result = "";
      if (days > 0) result += `${days}d `;
      if (days > 0 || hours > 0) result += `${hours}h `;
      result += `${mins}m ${secs}s`;

      setDailyCountdown(result + ` until ${todayTime}`);
    }

    updateCountdown();
    const timerId = setInterval(updateCountdown, 1000);
    return () => clearInterval(timerId);
  }, [todayTime]);

  // Update user's chosen time
  const [error, setError] = useState(null);

  const handleSaveTimeChange = async () => {
    setTodayTime(tempTime);
    setShowEditTime(false);

    try {
      if (!airtableUser) throw new Error("No user record to patch.");
      await api.updateUser(airtableUser.id, { todayTime: tempTime });
    } catch (err) {
      console.error("[TodayView] Error updating TodayTime:", err);
      setError("Failed to update daily time. Please refresh.");
    }
  };

  // State for tasks, ideas, milestones
  const [tasks, setTasks] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inline editing
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  const userId = airtableUser?.fields?.UserID || null;

  // Refs for Sortable
  const incompleteListRef = useRef(null);
  const sortableRef = useRef(null);

  // Fetch tasks (Focus="today"), ideas, milestones
  useEffect(() => {
    if (!userId) {
      setError("No user ID found. Please log in again.");
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);

        const [tasksData, ideasData, msData] = await Promise.all([
          api.getTasks(userId, { focus: "today", sortField: "OrderToday" }),
          api.getIdeas(userId),
          api.getMilestones(userId),
        ]);

        setTasks(tasksData.records);
        setIdeas(ideasData.records);
        setMilestones(msData.records);
      } catch (err) {
        console.error("[TodayView] Error fetching data:", err);
        setError(err.message || "Failed to load tasks for Today.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  // Sortable for incomplete tasks
  useLayoutEffect(() => {
    if (!loading && tasks.length > 0 && incompleteListRef.current && !sortableRef.current) {
      const incomplete = tasks.filter((t) => !t.fields.Completed);
      if (incomplete.length > 0) {
        sortableRef.current = new Sortable(incompleteListRef.current, {
          animation: 150,
          handle: ".drag-handle",
          onEnd: handleSortEnd,
        });
      }
    }
    return () => {
      if (sortableRef.current) {
        sortableRef.current.destroy();
        sortableRef.current = null;
      }
    };
  }, [loading, tasks]);

  async function handleSortEnd(evt) {
    const { oldIndex, newIndex } = evt;
    if (oldIndex === newIndex) return;

    const incomplete = tasks.filter((t) => !t.fields.Completed);
    const updated = [...incomplete];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);

    updated.forEach((item, idx) => {
      item.fields.OrderToday = idx + 1;
    });

    const completed = tasks.filter((t) => t.fields.Completed);
    setTasks([...updated, ...completed]);

    try {
      const updates = updated.map((t) => ({ id: t.id, order: t.fields.OrderToday }));
      await api.updateTasksOrder(updates, "OrderToday");
    } catch (err) {
      console.error("[TodayView] handleSortEnd =>", err);
      setError("Failed to reorder tasks. Please try again.");
    }
  }

  // Toggle Completed / Focus
  const handleToggleCompleted = async (task) => {
    const wasCompleted = !!task.fields.Completed;
    const newVal = !wasCompleted;
    const newTime = newVal ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              fields: { ...t.fields, Completed: newVal, CompletedTime: newTime },
            }
          : t
      )
    );

    try {
      await api.updateTask(task.id, { completed: newVal, completedTime: newTime });
    } catch (err) {
      console.error("[TodayView] handleToggleCompleted =>", err);
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

  const handleToggleFocus = async (task) => {
    const wasFocus = (task.fields.Focus === "today");
    const newVal = wasFocus ? "" : "today";

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, fields: { ...t.fields, Focus: newVal } }
          : t
      )
    );

    try {
      await api.updateTask(task.id, { focus: newVal });
    } catch (err) {
      console.error("[TodayView] handleToggleFocus =>", err);
      setError("Failed to toggle Focus. Please try again.");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                fields: { ...t.fields, Focus: wasFocus ? "today" : "" },
              }
            : t
        )
      );
    }
  };

  // Inline editing
  function startEditingTask(task) {
    setEditingTaskId(task.id);
    setEditingTaskName(task.fields.TaskName || "");
  }
  function cancelEditingTask() {
    setEditingTaskId(null);
    setEditingTaskName("");
  }

  async function commitTaskEdit(task) {
    const trimmed = editingTaskName.trim();
    if (!trimmed) {
      cancelEditingTask();
      return;
    }

    if (trimmed.toLowerCase() === "xxx") {
      await deleteTask(task);
      cancelEditingTask();
      return;
    }

    try {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, fields: { ...t.fields, TaskName: trimmed } }
            : t
        )
      );
      await api.updateTask(task.id, { taskName: trimmed });
    } catch (err) {
      console.error("[TodayView] commitTaskEdit =>", err);
      setError("Failed to update task name. Please try again.");
    } finally {
      cancelEditingTask();
    }
  }

  // Notes editing
  function startEditingNotes(task) {
    setEditingNotesTaskId(task.id);
    setEditingNotesText(task.fields.TaskNote || "");
  }
  function cancelEditingNotes() {
    setEditingNotesTaskId(null);
    setEditingNotesText("");
  }

  async function commitNotesEdit(task) {
    const trimmed = editingNotesText.trim();

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, fields: { ...t.fields, TaskNote: trimmed } }
          : t
      )
    );

    try {
      await api.updateTask(task.id, { taskNote: trimmed });
    } catch (err) {
      console.error("[TodayView] commitNotesEdit =>", err);
      setError("Failed to update notes. Please try again.");
    } finally {
      cancelEditingNotes();
    }
  }

  // Deleting a task
  async function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.deleteTask(task.id);
    } catch (err) {
      console.error("Failed to delete task =>", err);
    }
  }

  // Milestone assignment
  function handlePickMilestone(task) {
    setActiveTaskForMilestone(task);
    setShowMilestoneModal(true);
  }

  async function assignMilestoneToTask(milestone) {
    if (!activeTaskForMilestone) return;
    const target = activeTaskForMilestone;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? {
              ...t,
              fields: {
                ...t.fields,
                MilestoneID: milestone.fields.MilestoneID,
              },
            }
          : t
      )
    );

    try {
      await api.updateTask(target.id, { milestoneId: milestone.fields.MilestoneID });
    } catch (err) {
      console.error("[TodayView] assignMilestoneToTask =>", err);
      setError("Failed to assign milestone. Please refresh.");
    } finally {
      setShowMilestoneModal(false);
      setActiveTaskForMilestone(null);
    }
  }

  async function removeMilestoneFromTask(task) {
    if (!task) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, fields: { ...t.fields, MilestoneID: "" } }
          : t
      )
    );

    try {
      await api.updateTask(task.id, { milestoneId: "" });
    } catch (err) {
      console.error("[TodayView] removeMilestoneFromTask =>", err);
      setError("Failed to remove milestone. Please refresh.");
    }
  }

  // Partition tasks
  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.fields.Completed).length;
  const percentage = totalTasks
    ? Math.round((completedCount / totalTasks) * 100)
    : 0;

  const incompleteTasks = tasks.filter((t) => !t.fields.Completed);
  const completedTasks = tasks.filter((t) => t.fields.Completed);

  incompleteTasks.sort(
    (a, b) => (a.fields.OrderToday || 0) - (b.fields.OrderToday || 0)
  );
  completedTasks.sort((a, b) => {
    const aTime = a.fields.CompletedTime || "";
    const bTime = b.fields.CompletedTime || "";
    return bTime.localeCompare(aTime);
  });

  // Render
  if (loading) {
    return <p className="m-4">Loading your tasks for Today...</p>;
  }
  if (error) {
    return <p className="m-4 text-red-500">{error}</p>;
  }

  // Countdown edit UI
  const CountdownUI = () => (
    <div className="mb-2 text-sm text-red-600 font-semibold relative group inline-block">
      {dailyCountdown}
      <span
        className="opacity-0 group-hover:opacity-100 ml-2 text-blue-600 underline cursor-pointer"
        onClick={() => {
          setTempTime(todayTime);
          setShowEditTime(true);
        }}
      >
        edit
      </span>

      {showEditTime && (
        <div className="mt-2 bg-white p-2 border rounded shadow inline-block">
          <input
            type="time"
            value={tempTime}
            onChange={(e) => setTempTime(e.target.value)}
            className="border p-1 rounded"
          />
          <button
            onClick={handleSaveTimeChange}
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
          >
            Save
          </button>
          <button
            onClick={() => setShowEditTime(false)}
            className="ml-1 text-sm text-gray-600 underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div className="m-4">
        <CountdownUI />
        <p>No tasks with Focus="today".</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {showMilestoneModal && (
        <MilestoneModal
          allMilestones={milestones}
          onClose={() => {
            setShowMilestoneModal(false);
            setActiveTaskForMilestone(null);
          }}
          onSelect={assignMilestoneToTask}
          onRemove={() => removeMilestoneFromTask(activeTaskForMilestone)}
        />
      )}

      <CountdownUI />

      <h2 className="text-2xl font-bold mb-2">Today's Tasks</h2>

      <p className="text-sm text-gray-600">
        {completedCount} of {totalTasks} tasks completed ({percentage}%)
      </p>
      <div className="bg-gray-200 h-3 rounded mt-1 w-full max-w-md mb-4">
        <div
          className="bg-green-500 h-3 rounded"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* INCOMPLETE TASKS (sortable) */}
      <ul className="mb-6 border rounded divide-y" ref={incompleteListRef}>
        {incompleteTasks.map((task, index) => {
          const isFirstIncomplete = index === 0;
          const isEditingName = editingTaskId === task.id;
          const isEditingNotes = editingNotesTaskId === task.id;
          const isCompleted = !!task.fields.Completed;
          const completedTime = task.fields.CompletedTime || null;

          const ideaRecord = ideas.find(
            (i) => i.fields.IdeaID === task.fields.IdeaID
          );
          const ideaTitle = ideaRecord?.fields.IdeaTitle || "";
          const ideaCID = ideaRecord?.fields.IdeaID;

          const milestoneRecord = milestones.find(
            (m) => m.fields.MilestoneID === task.fields.MilestoneID
          );
          const milestoneName = milestoneRecord?.fields.MilestoneName || "";

          const isFocus = (task.fields.Focus === "today");
          const focusEmoji = isFocus ? "☀️" : "💤";

          return (
            <li
              key={task.id}
              className={`p-3 flex flex-col group ${
                isFirstIncomplete ? "bg-yellow-100" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center">
                <div
                  className="drag-handle mr-2 text-gray-400 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  ⇅
                </div>

                <input
                  type="checkbox"
                  className="mr-2"
                  checked={isCompleted}
                  onChange={() => handleToggleCompleted(task)}
                />

                {isEditingName ? (
                  <input
                    autoFocus
                    type="text"
                    className="border-b border-gray-300 focus:outline-none flex-1"
                    value={editingTaskName}
                    onChange={(e) => setEditingTaskName(e.target.value)}
                    onBlur={() => commitTaskEdit(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTaskEdit(task);
                      else if (e.key === "Escape") cancelEditingTask();
                    }}
                  />
                ) : (
                  <>
                    <span
                      className={`flex-1 cursor-pointer ${
                        isCompleted ? "line-through text-gray-500" : ""
                      }`}
                      onClick={() => startEditingTask(task)}
                    >
                      {task.fields.TaskName || "(Untitled Task)"}
                    </span>

                    {ideaTitle && (
                      <Link
                        to={`/ideas/${ideaCID}`}
                        className={
                          isCompleted
                            ? "ml-1 text-sm line-through text-gray-500"
                            : "ml-1 text-sm text-blue-600 underline"
                        }
                      >
                        ({ideaTitle})
                      </Link>
                    )}
                  </>
                )}

                <span
                  className="ml-3 cursor-pointer text-xl"
                  title="Toggle Focus"
                  onClick={() => handleToggleFocus(task)}
                >
                  {focusEmoji}
                </span>
              </div>

              {completedTime && (
                <p className="ml-6 mt-1 text-xs text-gray-500">
                  Completed on {new Date(completedTime).toLocaleString()}
                </p>
              )}

              <div className="ml-6 mt-2">
                {isEditingNotes ? (
                  <div>
                    <textarea
                      className="w-full border p-1 rounded"
                      rows={3}
                      value={editingNotesText}
                      onChange={(e) => setEditingNotesText(e.target.value)}
                    />
                    <div className="mt-1 space-x-2">
                      <button
                        onClick={() => commitNotesEdit(task)}
                        className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                      >
                        Submit
                      </button>
                      <button
                        onClick={cancelEditingNotes}
                        className="px-2 py-1 text-sm bg-gray-300 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {task.fields.TaskNote && task.fields.TaskNote.trim().length > 0 ? (
                      <p
                        className="text-sm text-gray-700 cursor-pointer whitespace-pre-line"
                        onClick={() => startEditingNotes(task)}
                      >
                        {task.fields.TaskNote}
                      </p>
                    ) : (
                      <p
                        className="text-xs text-blue-600 underline cursor-pointer"
                        onClick={() => startEditingNotes(task)}
                      >
                        + Add Notes
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="ml-6 mt-1">
                <span
                  className="text-xs text-blue-600 underline cursor-pointer"
                  onClick={() => handlePickMilestone(task)}
                >
                  {milestoneName ? milestoneName : "+ Add Milestone"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* COMPLETED TASKS */}
      {completedTasks.length > 0 && (
        <>
          <h3 className="text-md font-semibold mb-2">Completed</h3>
          <ul className="border rounded divide-y">
            {completedTasks.map((task) => {
              const isEditingName = editingTaskId === task.id;
              const isEditingNotes = editingNotesTaskId === task.id;
              const completedTime = task.fields.CompletedTime || null;

              const ideaRecord = ideas.find(
                (i) => i.fields.IdeaID === task.fields.IdeaID
              );
              const ideaTitle = ideaRecord?.fields.IdeaTitle || "";
              const ideaCID = ideaRecord?.fields.IdeaID;

              const milestoneRecord = milestones.find(
                (m) => m.fields.MilestoneID === task.fields.MilestoneID
              );
              const milestoneName = milestoneRecord?.fields.MilestoneName || "";

              const isFocus = (task.fields.Focus === "today");
              const focusEmoji = isFocus ? "☀️" : "💤";

              return (
                <li key={task.id} className="p-3 hover:bg-gray-50 flex flex-col group">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={true}
                      onChange={() => handleToggleCompleted(task)}
                    />

                    {isEditingName ? (
                      <input
                        autoFocus
                        type="text"
                        className="border-b border-gray-300 focus:outline-none flex-1"
                        value={editingTaskName}
                        onChange={(e) => setEditingTaskName(e.target.value)}
                        onBlur={() => commitTaskEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitTaskEdit(task);
                          else if (e.key === "Escape") cancelEditingTask();
                        }}
                      />
                    ) : (
                      <>
                        <span
                          className="flex-1 line-through text-gray-500 cursor-pointer"
                          onClick={() => startEditingTask(task)}
                        >
                          {task.fields.TaskName || "(Untitled Task)"}
                        </span>

                        {ideaTitle && (
                          <Link
                            to={`/ideas/${ideaCID}`}
                            className="ml-1 text-sm line-through text-gray-500"
                          >
                            ({ideaTitle})
                          </Link>
                        )}
                      </>
                    )}

                    <span
                      className="ml-3 cursor-pointer text-xl"
                      title="Toggle Focus"
                      onClick={() => handleToggleFocus(task)}
                    >
                      {focusEmoji}
                    </span>
                  </div>

                  {completedTime && (
                    <p className="ml-6 mt-1 text-xs text-gray-500">
                      Completed on {new Date(completedTime).toLocaleString()}
                    </p>
                  )}

                  <div className="ml-6 mt-2">
                    {isEditingNotes ? (
                      <div>
                        <textarea
                          className="w-full border p-1 rounded"
                          rows={3}
                          value={editingNotesText}
                          onChange={(e) => setEditingNotesText(e.target.value)}
                        />
                        <div className="mt-1 space-x-2">
                          <button
                            onClick={() => commitNotesEdit(task)}
                            className="px-2 py-1 text-sm bg-blue-600 text-white rounded"
                          >
                            Submit
                          </button>
                          <button
                            onClick={cancelEditingNotes}
                            className="px-2 py-1 text-sm bg-gray-300 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {task.fields.TaskNote && task.fields.TaskNote.trim().length > 0 ? (
                          <p
                            className="text-sm text-gray-700 cursor-pointer whitespace-pre-line"
                            onClick={() => startEditingNotes(task)}
                          >
                            {task.fields.TaskNote}
                          </p>
                        ) : (
                          <p
                            className="text-xs text-blue-600 underline cursor-pointer"
                            onClick={() => startEditingNotes(task)}
                          >
                            + Add Notes
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="ml-6 mt-1">
                    <span
                      className="text-xs text-blue-600 underline cursor-pointer"
                      onClick={() => handlePickMilestone(task)}
                    >
                      {milestoneName ? milestoneName : "+ Add Milestone"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default TodayView;
