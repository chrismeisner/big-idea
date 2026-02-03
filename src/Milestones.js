// File: /src/Milestones.js

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "./api";

function Milestones({ airtableUser }) {
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);

  // For creating a new milestone
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneTime, setNewMilestoneTime] = useState("");
  const [newMilestoneNotes, setNewMilestoneNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = airtableUser?.fields?.UserID || null;

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError("No logged-in user ID found. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [msData, tasksData] = await Promise.all([
          api.getMilestones(userId),
          api.getTasks(userId),
        ]);

        setMilestones(msData.records);
        setTasks(tasksData.records);
      } catch (err) {
        console.error("Error fetching milestones/tasks:", err);
        setError("Failed to fetch milestones. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Create a new Milestone
  const handleCreateMilestone = async (e) => {
    e.preventDefault();
    if (!newMilestoneName.trim()) return;

    if (!userId) {
      setError("No user ID. Please log in.");
      return;
    }

    try {
      const data = {
        milestoneName: newMilestoneName,
        userId: userId,
      };
      if (newMilestoneTime) {
        data.milestoneTime = newMilestoneTime;
      }
      if (newMilestoneNotes.trim()) {
        data.milestoneNotes = newMilestoneNotes;
      }

      const createdRecord = await api.createMilestone(data);
      setMilestones((prev) => [createdRecord, ...prev]);

      setNewMilestoneName("");
      setNewMilestoneTime("");
      setNewMilestoneNotes("");
    } catch (err) {
      console.error("Error creating milestone:", err);
      setError("Failed to create milestone. Please try again.");
    }
  };

  // Render
  if (loading) {
    return <p className="m-4">Loading milestones...</p>;
  }
  if (error) {
    return <p className="m-4 text-red-500">{error}</p>;
  }

  return (
    <div className="container py-6">
      <Link to="/" className="text-blue-500 underline">
        &larr; Back to your ideas
      </Link>

      <h2 className="text-2xl font-bold mt-4">All Milestones</h2>

      {/* Create Milestone form */}
      <form
        onSubmit={handleCreateMilestone}
        className="my-4 p-4 border rounded bg-gray-50"
      >
        <label
          htmlFor="newMilestoneName"
          className="block text-sm font-medium mb-1"
        >
          Milestone Name
        </label>
        <input
          id="newMilestoneName"
          type="text"
          className="border p-2 w-full mb-3"
          placeholder="e.g. Launch Beta..."
          value={newMilestoneName}
          onChange={(e) => setNewMilestoneName(e.target.value)}
          required
        />

        <label
          htmlFor="newMilestoneTime"
          className="block text-sm font-medium mb-1"
        >
          Target Date/Time
        </label>
        <input
          id="newMilestoneTime"
          type="datetime-local"
          className="border p-2 w-full mb-3"
          value={newMilestoneTime}
          onChange={(e) => setNewMilestoneTime(e.target.value)}
        />

        <label
          htmlFor="newMilestoneNotes"
          className="block text-sm font-medium mb-1"
        >
          Notes
        </label>
        <textarea
          id="newMilestoneNotes"
          className="border p-2 w-full mb-3"
          placeholder="Any notes or details..."
          value={newMilestoneNotes}
          onChange={(e) => setNewMilestoneNotes(e.target.value)}
        />

        <button
          type="submit"
          className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Create Milestone
        </button>
      </form>

      {/* Existing milestones */}
      {milestones.length > 0 ? (
        <ul className="divide-y divide-gray-200 border rounded">
          {milestones.map((m) => {
            const { MilestoneName, MilestoneTime, MilestoneID } = m.fields;

            const tasksForThisMilestone = tasks.filter(
              (t) => t.fields.MilestoneID === MilestoneID
            );

            return (
              <li key={m.id} className="p-3 hover:bg-gray-50">
                <Link
                  to={`/milestones/${MilestoneID}`}
                  className="text-blue-600 underline font-semibold"
                >
                  {MilestoneName || "(Untitled)"}
                </Link>

                {MilestoneTime && (
                  <span className="ml-2 text-xs text-gray-500">
                    (Due: {new Date(MilestoneTime).toLocaleString()})
                  </span>
                )}

                {tasksForThisMilestone.length > 0 ? (
                  <ul className="mt-2 pl-4 list-disc text-sm">
                    {(() => {
                      const incomplete = tasksForThisMilestone.filter(
                        (t) => !t.fields.Completed
                      );
                      const completed = tasksForThisMilestone.filter(
                        (t) => t.fields.Completed
                      );

                      incomplete.sort(
                        (a, b) => (a.fields.Order || 0) - (b.fields.Order || 0)
                      );

                      completed.sort((a, b) => {
                        const aTime = a.fields.CompletedTime || "";
                        const bTime = b.fields.CompletedTime || "";
                        return bTime.localeCompare(aTime);
                      });

                      const sortedTasks = [...incomplete, ...completed];

                      return sortedTasks.map((task) => {
                        const taskName = task.fields.TaskName || "(Untitled Task)";
                        const isCompleted = task.fields.Completed;
                        const completedTime = task.fields.CompletedTime;

                        return (
                          <li key={task.id}>
                            {isCompleted ? (
                              <span className="line-through text-gray-500">
                                {taskName}
                              </span>
                            ) : (
                              taskName
                            )}
                            {isCompleted && completedTime && (
                              <span className="ml-2 text-xs text-gray-400">
                                (Done {new Date(completedTime).toLocaleString()})
                              </span>
                            )}
                          </li>
                        );
                      });
                    })()}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 mt-2">
                    No tasks linked to this milestone yet.
                  </p>
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
