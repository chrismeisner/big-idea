// File: /src/MilestoneModal.js

import React from "react";
import { Link } from "react-router-dom";

/**
 * MilestoneModal
 * - Sorts milestones by MilestoneTime ascending.
 * - Displays a line like "Due: 3/2/2024 4:30 PM" plus "(in 2 days)" or "(2 days ago)".
 * - onSelect(m) to pick a milestone, onRemove() to clear it, onClose() to cancel.
 */
function MilestoneModal({ allMilestones, onClose, onSelect, onRemove }) {
  if (!allMilestones) return null;

  // 1) Clicking outside => close
  const handleBackdropClick = () => {
	onClose();
  };
  // Stop propagation if click inside
  const handleModalContentClick = (e) => {
	e.stopPropagation();
  };

  // 2) Sort by MilestoneTime ascending (earliest first)
  const sortedMilestones = [...allMilestones].sort((a, b) => {
	const tA = a.fields.MilestoneTime || "";
	const tB = b.fields.MilestoneTime || "";
	if (!tA && !tB) return 0;
	if (!tA) return 1;
	if (!tB) return -1;
	return new Date(tA) - new Date(tB);
  });

  // 3) A helper to produce "in 2 days" or "2 days ago", "in 30 minutes", etc.
  function timeDistanceString(dateStr) {
	if (!dateStr) return ""; // no date
	const now = new Date();
	const target = new Date(dateStr);
	if (isNaN(target.getTime())) return "";

	const diffMs = target - now;  // can be negative if past
	const absMs = Math.abs(diffMs);

	// Convert to minutes/hours/days
	const diffMinutes = Math.round(absMs / (1000 * 60));
	if (diffMinutes < 60) {
	  // Under an hour => show minutes
	  if (diffMs >= 0) {
		// future
		return `in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
	  } else {
		// past
		return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
	  }
	}

	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) {
	  // Under a day => show hours
	  if (diffMs >= 0) {
		return `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
	  } else {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	  }
	}

	// Over a day => show days
	const diffDays = Math.round(diffHours / 24);
	if (diffMs >= 0) {
	  return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
	} else {
	  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	}
  }

  return (
	<div
	  className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
	  onClick={handleBackdropClick}
	>
	  <div
		className="bg-white w-80 p-4 rounded shadow-lg"
		onClick={handleModalContentClick}
	  >
		<h2 className="text-lg font-bold mb-2">Pick a Milestone</h2>

		<ul className="max-h-64 overflow-y-auto border rounded divide-y">
		  {sortedMilestones.map((m) => {
			const milestoneName = m.fields.MilestoneName || "(Untitled)";
			const milestoneTime = m.fields.MilestoneTime || "";
			let timeLabel = "";
			let relativeLabel = "";

			if (milestoneTime) {
			  try {
				const d = new Date(milestoneTime);
				if (!isNaN(d.getTime())) {
				  timeLabel = d.toLocaleString();
				  // Also compute "in 2 days" or "2 days ago"
				  relativeLabel = timeDistanceString(milestoneTime);
				}
			  } catch (err) {
				console.error("Error parsing MilestoneTime:", err);
			  }
			}

			return (
			  <li key={m.id}>
				<button
				  className="w-full text-left px-2 py-2 hover:bg-gray-100"
				  onClick={() => onSelect(m)}
				>
				  <span className="font-medium">{milestoneName}</span>
				  {timeLabel && (
					<span className="block text-xs text-red-600">
					  Due: {timeLabel}
					  {relativeLabel && (
						<span className="ml-2 text-gray-600">({relativeLabel})</span>
					  )}
					</span>
				  )}
				</button>
			  </li>
			);
		  })}
		</ul>

		<div className="mt-3 flex items-center justify-between">
		  {/* Link to create a new milestone */}
		  <Link to="/milestones" className="text-sm text-blue-600 underline">
			Create a Milestone
		  </Link>

		  <div className="flex items-center space-x-2">
			{/* "Remove Milestone" button if user wants to clear it */}
			{onRemove && (
			  <button
				className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
				onClick={() => {
				  onRemove();
				  onClose();
				}}
			  >
				Remove
			  </button>
			)}

			{/* Cancel */}
			<button
			  className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
			  onClick={onClose}
			>
			  Cancel
			</button>
		  </div>
		</div>
	  </div>
	</div>
  );
}

export default MilestoneModal;
