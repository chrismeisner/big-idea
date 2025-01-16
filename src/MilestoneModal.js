// File: /src/MilestoneModal.js

import React from "react";
import { Link } from "react-router-dom"; // Import Link from react-router

function MilestoneModal({ allMilestones, onClose, onSelect }) {
  if (!allMilestones) return null;

  // When user clicks the backdrop (the dark overlay), we want to close the modal.
  // But we stopPropagation if they click inside the white box.
  const handleBackdropClick = () => {
	onClose();
  };

  const handleModalContentClick = (e) => {
	e.stopPropagation(); // Prevent the onClose from firing
  };

  return (
	<div
	  className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
	  onClick={handleBackdropClick} // Clicking outside => close
	>
	  <div
		className="bg-white w-80 p-4 rounded shadow-lg"
		onClick={handleModalContentClick}
	  >
		<h2 className="text-lg font-bold mb-2">Pick a Milestone</h2>

		<ul className="max-h-64 overflow-y-auto border rounded divide-y">
		  {allMilestones.map((m) => {
			const milestoneName = m.fields.MilestoneName || "(Untitled)";
			const milestoneTime = m.fields.MilestoneTime || null;

			// Attempt to parse the date/time if present
			let timeLabel = "";
			if (milestoneTime) {
			  try {
				const d = new Date(milestoneTime);
				if (!isNaN(d.getTime())) {
				  timeLabel = d.toLocaleString();
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
					</span>
				  )}
				</button>
			  </li>
			);
		  })}
		</ul>

		<div className="mt-3 flex items-center justify-between">
		  {/* Link to the /milestones page to create a new milestone */}
		  <Link to="/milestones" className="text-sm text-blue-600 underline">
			Create a Milestone
		  </Link>

		  {/* Cancel / Close button */}
		  <button
			className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
			onClick={onClose}
		  >
			Cancel
		  </button>
		</div>
	  </div>
	</div>
  );
}

export default MilestoneModal;
