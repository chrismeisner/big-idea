// File: /Users/chrismeisner/Projects/big-idea/src/Onboarding.js 

import React, { useState } from "react";
import { updateUser } from "./api";

function Onboarding({ userRecord, onComplete }) {
  const [name, setName] = useState(userRecord?.fields?.Name || "");

  const goalOptions = [
    { id: "accountability", label: "Daily accountability to realize my big idea" },
    { id: "mentors", label: "Get help from mentors" },
    { id: "community", label: "Connect with other big thinkers" },
    { id: "reference", label: "Just store my idea for reference" },
  ];

  const [selectedGoals, setSelectedGoals] = useState(() => {
    const existingGoals = userRecord?.fields?.Goals;
    if (existingGoals) {
      try {
        return JSON.parse(existingGoals);
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleGoalToggle = (goalId) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) {
        return prev.filter((g) => g !== goalId);
      } else {
        return [...prev, goalId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const updatedRecord = await updateUser(userRecord.id, {
        name: name,
        goals: JSON.stringify(selectedGoals),
      });

      onComplete(updatedRecord);
    } catch (err) {
      console.error("Error updating user:", err);
      alert("Failed to save your info. Please try again.");
    }
  };

  return (
    <div className="m-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Welcome!</h2>
      <p className="mb-4">We'd love to know a bit about you and what you want from this app.</p>

      <form onSubmit={handleSubmit} className="inline-block text-left">
        {/* Name Field */}
        <div className="mb-4">
          <label htmlFor="name" className="block font-medium mb-2">
            First Name
          </label>
          <input
            id="name"
            type="text"
            className="border border-gray-300 px-2 py-1 rounded w-full max-w-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Goals: Four Checkboxes */}
        <div className="mb-4">
          <label className="block font-medium mb-2">
            What do you want to get out of this app?
          </label>

          {goalOptions.map((option) => (
            <div key={option.id} className="mb-2 flex items-center">
              <input
                type="checkbox"
                id={option.id}
                checked={selectedGoals.includes(option.id)}
                onChange={() => handleGoalToggle(option.id)}
                className="mr-2"
              />
              <label htmlFor={option.id}>{option.label}</label>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="py-1 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Save
        </button>
      </form>
    </div>
  );
}

export default Onboarding;
