// File: /src/Profile.js

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { updateUser } from "./api";

function Profile({ airtableUser, onUserUpdate }) {
  const [name, setName] = useState("");
  const [todayTime, setTodayTime] = useState("16:20");
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const goalOptions = [
    { id: "accountability", label: "Daily accountability to realize my big idea" },
    { id: "mentors", label: "Get help from mentors" },
    { id: "community", label: "Connect with other big thinkers" },
    { id: "reference", label: "Just store my idea for reference" },
  ];

  // Load current user data
  useEffect(() => {
    if (airtableUser?.fields) {
      setName(airtableUser.fields.Name || "");
      setTodayTime(airtableUser.fields.TodayTime || "16:20");
      
      // Parse goals JSON
      const goalsStr = airtableUser.fields.Goals;
      if (goalsStr) {
        try {
          setSelectedGoals(JSON.parse(goalsStr));
        } catch {
          setSelectedGoals([]);
        }
      }
    }
  }, [airtableUser]);

  const handleGoalToggle = (goalId) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) {
        return prev.filter((g) => g !== goalId);
      } else {
        return [...prev, goalId];
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updatedUser = await updateUser(airtableUser.id, {
        name: name,
        todayTime: todayTime,
        goals: JSON.stringify(selectedGoals),
      });

      // Update parent state
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }

      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (err) {
      console.error("Error saving profile:", err);
      setMessage({ type: "error", text: "Failed to save settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (!airtableUser) {
    return <p className="m-4">Loading profile...</p>;
  }

  return (
    <div className="container py-6 max-w-xl">
      <Link to="/" className="text-blue-600 underline">
        &larr; Back to Ideas
      </Link>

      <h2 className="text-2xl font-bold mt-4 mb-6">Profile & Settings</h2>

      {message && (
        <div
          className={`p-3 rounded mb-4 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Info (read-only) */}
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold mb-2">Account</h3>
          <p className="text-sm text-gray-600">
            <span className="font-medium">Phone:</span>{" "}
            {airtableUser.fields.Mobile || "Not set"}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium">User ID:</span>{" "}
            {airtableUser.fields.UserID || "Not set"}
          </p>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block font-medium mb-1">
            Display Name
          </label>
          <input
            id="name"
            type="text"
            className="border border-gray-300 rounded px-3 py-2 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        {/* Daily Countdown Time */}
        <div>
          <label htmlFor="todayTime" className="block font-medium mb-1">
            Daily Countdown Time
          </label>
          <p className="text-sm text-gray-500 mb-2">
            The time shown in the "Today" view countdown. Set this to when you want to be done with tasks each day.
          </p>
          <input
            id="todayTime"
            type="time"
            className="border border-gray-300 rounded px-3 py-2"
            value={todayTime}
            onChange={(e) => setTodayTime(e.target.value)}
          />
        </div>

        {/* Goals */}
        <div>
          <label className="block font-medium mb-1">
            What do you want from this app?
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Select all that apply.
          </p>
          <div className="space-y-2">
            {goalOptions.map((option) => (
              <label
                key={option.id}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedGoals.includes(option.id)}
                  onChange={() => handleGoalToggle(option.id)}
                  className="rounded"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      {/* App Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded border">
        <h3 className="font-semibold mb-2">App Info</h3>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Version:</span> 0.1.0
        </p>
      </div>
    </div>
  );
}

export default Profile;
