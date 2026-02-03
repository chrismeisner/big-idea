// File: /src/MainContent.js
import React, { useEffect, useState } from "react";
import IdeaList from "./IdeaList";
import TurnIntoTaskModal from "./TurnIntoTaskModal";
import * as api from "./api";

function MainContent({ airtableUser }) {
  const [ideas, setIdeas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For creating new ideas
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  // Current user
  const userId = airtableUser?.fields?.UserID || null;

  // States for "Turn into Task" modal
  const [showTurnModal, setShowTurnModal] = useState(false);
  const [ideaToConvert, setIdeaToConvert] = useState(null);

  useEffect(() => {
    if (!userId) {
      setError("No user ID found. Please log in again.");
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch Ideas and Tasks in parallel
        const [ideasResp, tasksResp] = await Promise.all([
          api.getIdeas(userId),
          api.getTasks(userId),
        ]);

        setIdeas(ideasResp.records);
        setTasks(tasksResp.records);
      } catch (err) {
        console.error("[MainContent] Error fetching data:", err);
        setError("Failed to fetch data. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  // Create a new Idea
  async function handleCreateIdea(e) {
    e.preventDefault();
    if (!newIdeaTitle.trim()) return;
    if (!userId) {
      setError("No user ID found. Please log in again.");
      return;
    }

    try {
      const newIdea = await api.createIdea({
        ideaTitle: newIdeaTitle,
        ideaSummary: newIdeaSummary,
        userMobile: airtableUser.fields.Mobile || "",
        userId: userId,
      });

      setIdeas((prev) => [...prev, newIdea]);
      setNewIdeaTitle("");
      setNewIdeaSummary("");
    } catch (err) {
      console.error("Error creating idea =>", err);
      setError("Failed to create idea. Please try again.");
    }
  }

  // Delete an Idea
  async function handleDeleteIdea(idea) {
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    try {
      await api.deleteIdea(idea.id);
    } catch (err) {
      console.error("Failed to delete idea =>", err);
    }
  }

  // Create a new Task for a given Idea
  async function createTask(ideaCustomId, taskName) {
    try {
      const orderValue = tasks.length + 1;
      const newTask = await api.createTask({
        taskName: taskName,
        ideaId: ideaCustomId,
        userId: userId,
        order: orderValue,
        completed: false,
      });

      setTasks((prev) => [...prev, newTask]);
    } catch (err) {
      console.error("Error creating task =>", err);
      setError("Failed to create task. Please try again.");
    }
  }

  // Reorder Ideas => patch .Order
  async function handleReorderIdea(targetIdea, newPosition) {
    const sorted = [...ideas].sort(
      (a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
    );
    const oldIndex = sorted.findIndex((i) => i.id === targetIdea.id);
    if (oldIndex === -1) return;

    const [removed] = sorted.splice(oldIndex, 1);
    sorted.splice(newPosition - 1, 0, removed);

    sorted.forEach((rec, i) => {
      rec.fields.Order = i + 1;
    });

    setIdeas(sorted);

    try {
      const updates = sorted.map((r) => ({
        id: r.id,
        order: r.fields.Order,
      }));
      await api.updateIdeasOrder(updates);
    } catch (err) {
      console.error("Error reordering ideas:", err);
    }
  }

  // "Turn into a Task" => show modal
  function handleRequestTurnIntoTask(idea) {
    setIdeaToConvert(idea);
    setShowTurnModal(true);
  }

  // Cancel => close modal
  function handleCancelTurnIntoTask() {
    setIdeaToConvert(null);
    setShowTurnModal(false);
  }

  // Confirm => create new Task, delete old Idea
  async function handleConfirmTurnIntoTask(destinationIdeaID) {
    if (!ideaToConvert) return;

    try {
      const origTitle = ideaToConvert.fields.IdeaTitle || "(Untitled)";
      const origSummary = ideaToConvert.fields.IdeaSummary || "";

      // Create the new Task
      const newTask = await api.createTask({
        taskName: origTitle,
        taskNote: origSummary,
        ideaId: destinationIdeaID,
        userId: userId,
        completed: false,
      });

      setTasks((prev) => [...prev, newTask]);

      // Delete the old Idea
      await api.deleteIdea(ideaToConvert.id);
      setIdeas((prev) => prev.filter((i) => i.id !== ideaToConvert.id));
    } catch (err) {
      console.error("Error turning Idea into a Task =>", err);
      setError("Failed to create new Task or delete old Idea. Please try again.");
    } finally {
      setIdeaToConvert(null);
      setShowTurnModal(false);
    }
  }

  // Render
  if (loading) {
    return <p className="m-4">Loading your ideas...</p>;
  }
  if (error) {
    return <p className="m-4 text-red-500">{error}</p>;
  }

  // Sort ideas by .Order
  const sortedIdeas = [...ideas].sort(
    (a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
  );

  return (
    <div className="container py-6">
      <h2 className="text-2xl font-bold mb-4">Your Ideas</h2>

      {/* Create Idea form */}
      <form
        onSubmit={handleCreateIdea}
        className="mb-6 p-4 border rounded bg-gray-100"
        autoComplete="off"
      >
        <div className="mb-4">
          <label
            htmlFor="newIdeaTitle"
            className="block text-sm font-medium mb-1"
          >
            Idea Title
          </label>
          <input
            id="newIdeaTitle"
            type="text"
            className="border p-2 w-full text-sm"
            placeholder="e.g. Next big startup..."
            value={newIdeaTitle}
            onChange={(e) => setNewIdeaTitle(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="newIdeaSummary"
            className="block text-sm font-medium mb-1"
          >
            Idea Summary (Optional)
          </label>
          <textarea
            id="newIdeaSummary"
            className="border p-2 w-full text-sm"
            rows={3}
            placeholder="(Brief description)"
            value={newIdeaSummary}
            onChange={(e) => setNewIdeaSummary(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="py-2 px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Create Idea
        </button>
      </form>

      {/* Idea List */}
      <IdeaList
        ideas={sortedIdeas}
        tasks={tasks}
        onDeleteIdea={handleDeleteIdea}
        onCreateTask={createTask}
        onReorderIdea={handleReorderIdea}
        onRequestTurnIntoTask={handleRequestTurnIntoTask}
      />

      {/* Turn Into Task Modal */}
      {showTurnModal && (
        <TurnIntoTaskModal
          allIdeas={ideas}
          activeIdea={ideaToConvert}
          onClose={handleCancelTurnIntoTask}
          onCancel={handleCancelTurnIntoTask}
          onConfirm={handleConfirmTurnIntoTask}
        />
      )}
    </div>
  );
}

export default MainContent;
