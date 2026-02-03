// File: /src/Profile.js

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { updateUser, getAdminStatus, switchDataSource } from "./api";

function Profile({ airtableUser, onUserUpdate }) {
  const [name, setName] = useState("");
  const [todayTime, setTodayTime] = useState("16:20");
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Admin state
  const [adminStatus, setAdminStatus] = useState(null);
  const [switchingSource, setSwitchingSource] = useState(false);

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
      
      const goalsStr = airtableUser.fields.Goals;
      if (goalsStr) {
        try {
          setSelectedGoals(JSON.parse(goalsStr));
        } catch {
          setSelectedGoals([]);
        }
      }

      // Check admin status
      loadAdminStatus();
    }
  }, [airtableUser]);

  const loadAdminStatus = async () => {
    if (!airtableUser?.fields?.UserID) return;
    try {
      const status = await getAdminStatus(airtableUser.fields.UserID);
      setAdminStatus(status);
    } catch (err) {
      console.error("Failed to load admin status:", err);
    }
  };

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

  const handleSwitchDataSource = async (newSource) => {
    if (!adminStatus?.isAdmin) return;
    
    setSwitchingSource(true);
    setMessage(null);

    try {
      const result = await switchDataSource(airtableUser.fields.UserID, newSource);
      setMessage({ 
        type: "success", 
        text: `Switched to ${result.currentDataSource}. Reloading...` 
      });
      // Reload the page after a short delay to re-authenticate with the new data source
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error("Error switching data source:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to switch data source." 
      });
      setSwitchingSource(false);
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
          {adminStatus?.isAdmin && (
            <p className="text-sm text-green-600 font-medium mt-1">
              ✓ Admin User
            </p>
          )}
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
            The time shown in the "Today" view countdown.
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

      {/* Admin Panel */}
      {adminStatus?.isAdmin && (
        <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200">
          <h3 className="font-semibold mb-3 text-yellow-800">Admin Panel</h3>
          
          <div className="space-y-4">
            {/* Current Data Source */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Data Source</p>
              <p className="text-sm text-gray-600 mb-3">
                Current: <span className="font-semibold">{adminStatus.currentDataSource}</span>
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleSwitchDataSource('airtable')}
                  disabled={switchingSource || adminStatus.currentDataSource === 'airtable' || !adminStatus.availableSources?.airtable}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    adminStatus.currentDataSource === 'airtable'
                      ? 'bg-green-600 text-white'
                      : adminStatus.availableSources?.airtable
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {adminStatus.currentDataSource === 'airtable' ? '✓ ' : ''}Airtable
                  {!adminStatus.availableSources?.airtable && ' (not configured)'}
                </button>
                
                <button
                  onClick={() => handleSwitchDataSource('postgres')}
                  disabled={switchingSource || adminStatus.currentDataSource === 'postgres' || !adminStatus.availableSources?.postgres}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    adminStatus.currentDataSource === 'postgres'
                      ? 'bg-green-600 text-white'
                      : adminStatus.availableSources?.postgres
                        ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {adminStatus.currentDataSource === 'postgres' ? '✓ ' : ''}PostgreSQL
                  {!adminStatus.availableSources?.postgres && ' (not configured)'}
                </button>
              </div>
              
              {switchingSource && (
                <p className="text-sm text-yellow-700 mt-2">Switching...</p>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Note: Switching data sources changes where data is stored. Data is not migrated between sources.
            </p>
          </div>
        </div>
      )}

      {/* App Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded border">
        <h3 className="font-semibold mb-2">App Info</h3>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Version:</span> 0.1.0
        </p>
        {adminStatus && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Data Source:</span> {adminStatus.currentDataSource}
          </p>
        )}
      </div>
    </div>
  );
}

export default Profile;
