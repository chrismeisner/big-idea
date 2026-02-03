// File: src/IdeaDetail.jsx

import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import { useParams, Link } from "react-router-dom";
import Sortable from "sortablejs";

import TaskProgressBar from "./TaskProgressBar";
import MilestoneModal from "./MilestoneModal";
import TaskItem from "./TaskItem";
import * as api from "./api";

function IdeaDetail({ airtableUser }) {
  const [idea, setIdea] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inline editing for TaskName
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState("");

  // Inline editing for TaskNote
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [editingNotesText, setEditingNotesText] = useState("");

  // Milestone modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [activeTaskForMilestone, setActiveTaskForMilestone] = useState(null);

  // New top-level task form
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPosition, setNewTaskPosition] = useState("top");

  const userId = airtableUser?.fields?.UserID || null;
  const { customIdeaId } = useParams();

  // Refs for Sortable.js
  const topLevelListRef = useRef(null);
  const topLevelSortableRef = useRef(null);
  const subtaskRefs = useRef({});

  // ────────────────────────────────────────────────────────────────────────────
  // 1) FETCH DATA (Idea + Tasks + Milestones)
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setError("No user ID found. Please log in again.");
      setLoading(false);
      return;
    }
    fetchData();
  }, [customIdeaId, userId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch idea, tasks, and milestones in parallel
      const [ideaData, tasksData, msData] = await Promise.all([
        api.getIdeaByCustomId(customIdeaId),
        api.getTasks(userId, { ideaId: customIdeaId }),
        api.getMilestones(userId),
      ]);

      if (!ideaData) {
        throw new Error(`No Idea found for custom ID: ${customIdeaId}`);
      }

      setIdea(ideaData);
      setTasks(tasksData.records.map((r) => ({ id: r.id, fields: r.fields })));
      setAllMilestones(msData.records);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // UTILS: sort, create, delete, reorder
  // ────────────────────────────────────────────────────────────────────────────
  function getSortedTopLevel() {
    const top = tasks.filter((t) => !t.fields.ParentTask);
    const inc = top.filter((t) => !t.fields.Completed);
    const comp = top.filter((t) => t.fields.Completed);
    inc.sort((a, b) => (a.fields.Order || 0) - (b.fields.Order || 0));
    comp.sort(
      (a, b) =>
        (b.fields.CompletedTime || "").localeCompare(a.fields.CompletedTime || "")
    );
    return [...inc, ...comp];
  }

  function getSortedSubtasks(parentID) {
    const subs = tasks.filter((t) => t.fields.ParentTask === parentID);
    const inc = subs.filter((s) => !s.fields.Completed);
    const comp = subs.filter((s) => s.fields.Completed);
    inc.sort((a, b) => (a.fields.SubOrder || 0) - (b.fields.SubOrder || 0));
    comp.sort(
      (a, b) =>
        (b.fields.CompletedTime || "").localeCompare(a.fields.CompletedTime || "")
    );
    return [...inc, ...comp];
  }

  async function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await api.deleteTask(task.id);
    } catch (err) {
      console.error("Error deleting task:", err);
      setError("Failed to delete task. Please refresh.");
    }
  }

  async function handleCreateTopLevelTask(e) {
    e.preventDefault();
    const name = newTaskName.trim();
    if (!name) return;
    try {
      const top = tasks.filter((t) => !t.fields.ParentTask);
      const incomplete = top.filter((t) => !t.fields.Completed);
      let newOrder;
      if (newTaskPosition === "top") {
        if (incomplete.length) {
          const shifted = incomplete.map((t) => ({
            ...t,
            fields: { ...t.fields, Order: (t.fields.Order || 0) + 1 },
          }));
          const updates = shifted.map((t) => ({ id: t.id, order: t.fields.Order }));
          await api.updateTasksOrder(updates, "Order");
          setTasks((prev) => [
            ...shifted,
            ...top.filter((t) => t.fields.Completed),
            ...prev.filter((t) => t.fields.ParentTask),
          ]);
        }
        newOrder = 1;
      } else {
        newOrder = incomplete.length + 1;
      }

      const newTask = await api.createTask({
        taskName: name,
        ideaId: idea.fields.IdeaID,
        parentTask: "",
        order: newOrder,
        userId: userId,
      });

      setTasks((prev) => [...prev, { id: newTask.id, fields: newTask.fields }]);
      setNewTaskName("");
    } catch (err) {
      console.error("Error creating task:", err);
      setError("Failed to create task. Please refresh.");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3) DRAG & DROP
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && tasks.length && topLevelListRef.current) {
      if (!topLevelSortableRef.current) {
        topLevelSortableRef.current = new Sortable(
          topLevelListRef.current,
          {
            animation: 150,
            handle: ".drag-handle",
            onEnd: handleTopLevelSortEnd,
          }
        );
      }
    }
    return () => {
      topLevelSortableRef.current?.destroy();
      topLevelSortableRef.current = null;
    };
  }, [loading, tasks]);

  async function handleTopLevelSortEnd(evt) {
    const { oldIndex, newIndex } = evt;
    if (oldIndex === newIndex) return;
    const top = tasks.filter((t) => !t.fields.ParentTask);
    const inc = top.filter((t) => !t.fields.Completed);
    const comp = top.filter((t) => t.fields.Completed);
    const updated = [...inc];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((t, i) => (t.fields.Order = i + 1));
    setTasks([...updated, ...comp, ...tasks.filter((t) => t.fields.ParentTask)]);
    try {
      const updates = updated.map((t) => ({ id: t.id, order: t.fields.Order }));
      await api.updateTasksOrder(updates, "Order");
    } catch (err) {
      console.error("Reorder failed:", err);
      setError("Failed to reorder. Please refresh.");
    }
  }

  useLayoutEffect(() => {
    if (!loading && tasks.length) {
      tasks
        .filter((t) => !t.fields.ParentTask)
        .forEach((parent) => {
          const el = subtaskRefs.current[parent.id];
          if (!el) return;
          const incSubs = tasks.filter(
            (s) =>
              s.fields.ParentTask === parent.fields.TaskID &&
              !s.fields.Completed
          );
          if (!incSubs.length) return;
          el._sortable?.destroy();
          el._sortable = new Sortable(el, {
            animation: 150,
            handle: ".sub-drag-handle",
            onEnd: (e) => handleSubtaskSortEnd(e, parent),
          });
        });
    }
    return () => {
      Object.values(subtaskRefs.current).forEach((el) =>
        el?._sortable?.destroy()
      );
    };
  }, [loading, tasks]);

  async function handleSubtaskSortEnd(evt, parentTask) {
    const { oldIndex, newIndex } = evt;
    if (oldIndex === newIndex) return;
    const incSubs = tasks.filter(
      (s) =>
        s.fields.ParentTask === parentTask.fields.TaskID &&
        !s.fields.Completed
    );
    const updated = [...incSubs];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((s, i) => (s.fields.SubOrder = i + 1));
    setTasks([
      ...tasks.filter(
        (t) => t.fields.ParentTask !== parentTask.fields.TaskID
      ),
      ...updated,
    ]);
    try {
      const updates = updated.map((s) => ({ id: s.id, order: s.fields.SubOrder }));
      await api.updateTasksOrder(updates, "SubOrder");
    } catch (err) {
      console.error("Subtask reorder failed:", err);
      setError("Failed to reorder subtasks. Please refresh.");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4) COMPLETION, FOCUS, MILESTONE, NOTES
  // ────────────────────────────────────────────────────────────────────────────
  async function handleToggleCompleted(task) {
    const was = task.fields.Completed || false;
    const now = !was;
    const time = now ? new Date().toISOString() : null;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              fields: { ...t.fields, Completed: now, CompletedTime: time },
            }
          : t
      )
    );
    try {
      await api.updateTask(task.id, { completed: now, completedTime: time });
    } catch (err) {
      console.error("Toggle Completed failed:", err);
      setError("Failed to toggle completed. Please refresh.");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                fields: {
                  ...t.fields,
                  Completed: was,
                  CompletedTime: was ? t.fields.CompletedTime : null,
                },
              }
            : t
        )
      );
    }
  }

  async function handleToggleFocus(task) {
    const was = task.fields.Focus === "today";
    const now = was ? "" : "today";
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              fields: { ...t.fields, Focus: now },
            }
          : t
      )
    );
    try {
      await api.updateTask(task.id, { focus: now });
    } catch (err) {
      console.error("Toggle Focus failed:", err);
      setError("Failed to toggle focus. Please refresh.");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, fields: { ...t.fields, Focus: was ? "today" : "" } }
            : t
        )
      );
    }
  }

  function startEditingTask(task) {
    setEditingTaskId(task.id);
    let name = task.fields.TaskName || "";
    if (name.trim().toLowerCase() === "new subtask...") name = "";
    setEditingTaskName(name);
  }
  function cancelEditingTask() {
    setEditingTaskId(null);
    setEditingTaskName("");
  }
  async function commitTaskNameEdit(task) {
    const name = editingTaskName.trim();
    if (name.toLowerCase() === "xxx") {
      await deleteTask(task);
      cancelEditingTask();
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              fields: { ...t.fields, TaskName: name || "(No Name)" },
            }
          : t
      )
    );
    try {
      await api.updateTask(task.id, { taskName: name || "(No Name)" });
    } catch (err) {
      console.error("Rename failed:", err);
      setError("Failed to rename. Please refresh.");
    } finally {
      cancelEditingTask();
    }
  }

  // NOTES editing handlers
  function startEditingNotes(task) {
    setEditingNotesTaskId(task.id);
    setEditingNotesText(task.fields.TaskNote || "");
  }
  function cancelEditingNotes() {
    setEditingNotesTaskId(null);
    setEditingNotesText("");
  }
  async function commitTaskNoteEdit(task) {
    const note = editingNotesText.trim();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, fields: { ...t.fields, TaskNote: note } }
          : t
      )
    );
    try {
      await api.updateTask(task.id, { taskNote: note });
    } catch (err) {
      console.error("Save notes failed:", err);
      setError("Failed to save notes. Please refresh.");
    } finally {
      cancelEditingNotes();
    }
  }

  // Milestone linking
  function handlePickMilestone(task) {
    setActiveTaskForMilestone(task);
    setShowMilestoneModal(true);
  }
  async function assignMilestoneToTask(milestone) {
    if (!activeTaskForMilestone) return;
    const t = activeTaskForMilestone;
    setShowMilestoneModal(false);
    setActiveTaskForMilestone(null);
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, fields: { ...x.fields, MilestoneID: milestone.fields.MilestoneID } }
          : x
      )
    );
    try {
      await api.updateTask(t.id, { milestoneId: milestone.fields.MilestoneID });
    } catch (err) {
      console.error("Assign milestone failed:", err);
      setError("Failed to assign milestone. Please refresh.");
    }
  }
  async function removeMilestoneFromTask(task) {
    setTasks((prev) =>
      prev.map((x) =>
        x.id === task.id
          ? { ...x, fields: { ...x.fields, MilestoneID: "" } }
          : x
      )
    );
    try {
      await api.updateTask(task.id, { milestoneId: "" });
    } catch (err) {
      console.error("Remove milestone failed:", err);
      setError("Failed to remove milestone. Please refresh.");
    }
  }

  // Create a subtask
  async function createSubtask(parentTask) {
    const pid = parentTask.fields.TaskID;
    const children = tasks.filter((t) => t.fields.ParentTask === pid);
    const order = children.length + 1;
    try {
      const newTask = await api.createTask({
        taskName: "New subtask...",
        parentTask: pid,
        ideaId: parentTask.fields.IdeaID,
        userId: userId,
        subOrder: order,
      });
      setTasks((prev) => [
        ...prev,
        { id: newTask.id, fields: newTask.fields },
      ]);
    } catch (err) {
      console.error("Create subtask failed:", err);
      setError("Failed to create subtask. Please refresh.");
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PROGRESS BAR CALC
  // ────────────────────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.fields.Completed).length;
  const percentage = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  const finalTopTasks = getSortedTopLevel();

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  if (loading) return <p className="m-4">Loading data…</p>;
  if (error) return <p className="m-4 text-red-500">{error}</p>;
  if (!idea)
    return (
      <p className="m-4">
        No idea found for custom ID: <strong>{customIdeaId}</strong>
      </p>
    );

  return (
    <div className="container p-4">
      {showMilestoneModal && (
        <MilestoneModal
          allMilestones={allMilestones}
          onClose={() => {
            setShowMilestoneModal(false);
            setActiveTaskForMilestone(null);
          }}
          onSelect={assignMilestoneToTask}
          onRemove={() => removeMilestoneFromTask(activeTaskForMilestone)}
        />
      )}

      <Link to="/" className="text-blue-600 underline">
        ← Back
      </Link>

      <h2 className="text-2xl font-bold mt-2">
        {idea.fields.IdeaTitle || "(Untitled Idea)"}
      </h2>

      <TaskProgressBar
        completedTasks={completedTasks}
        totalTasks={totalTasks}
        percentage={percentage}
      />

      <form
        onSubmit={handleCreateTopLevelTask}
        className="mt-4 flex flex-col gap-2 max-w-md"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New top-level task…"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 flex-1"
          />
          <button
            type="submit"
            className="bg-green-600 text-white px-3 rounded hover:bg-green-700"
          >
            Add
          </button>
        </div>
        <div className="flex items-center space-x-6">
          <label className="inline-flex items-center space-x-2">
            <input
              type="radio"
              name="taskPosition"
              checked={newTaskPosition === "top"}
              onChange={() => setNewTaskPosition("top")}
            />
            <span className="text-sm">Top of list</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="radio"
              name="taskPosition"
              checked={newTaskPosition === "bottom"}
              onChange={() => setNewTaskPosition("bottom")}
            />
            <span className="text-sm">Bottom of list</span>
          </label>
        </div>
      </form>

      <h3 className="mt-4 text-lg font-semibold">Tasks:</h3>
      {finalTopTasks.length === 0 ? (
        <p className="text-gray-600">No tasks yet.</p>
      ) : (
        <ul
          ref={topLevelListRef}
          className="space-y-3 mt-2"
        >
          {finalTopTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              childTasks={getSortedSubtasks(task.fields.TaskID)}
              subtaskRefs={subtaskRefs}
              editingTaskId={editingTaskId}
              editingTaskName={editingTaskName}
              setEditingTaskName={setEditingTaskName}
              editingNotesTaskId={editingNotesTaskId}
              editingNotesText={editingNotesText}
              setEditingNotesText={setEditingNotesText}
              startEditingTask={startEditingTask}
              cancelEditingTask={cancelEditingTask}
              commitTaskNameEdit={commitTaskNameEdit}
              startEditingNotes={startEditingNotes}
              cancelEditingNotes={cancelEditingNotes}
              commitTaskNoteEdit={commitTaskNoteEdit}
              handleToggleFocus={handleToggleFocus}
              handleToggleCompleted={handleToggleCompleted}
              createSubtask={createSubtask}
              handlePickMilestone={handlePickMilestone}
              allMilestones={allMilestones}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default IdeaDetail;
