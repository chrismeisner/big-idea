// File: /src/MilestoneModal.js

import React from "react";

function MilestoneModal({ allMilestones, onClose, onSelect }) {
  if (!allMilestones) return null;

  console.log("Rendering MilestoneModal...");
  console.log("All milestones array:", allMilestones);

  return (
	<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
	  <div className="bg-white w-80 p-4 rounded shadow-lg">
		<h2 className="text-lg font-bold mb-2">Pick a Milestone</h2>

		<ul className="max-h-64 overflow-y-auto border rounded divide-y">
		  {allMilestones.map((m) => {
			console.log("Milestone record:", m);
			const milestoneName = m.fields.MilestoneName || "(Untitled)";
			const milestoneTime = m.fields.MilestoneTime || null;

			// Attempt to parse the date/time if present
			let timeLabel = "";
			if (milestoneTime) {
			  console.log("MilestoneTime field:", milestoneTime);
			  try {
				const d = new Date(milestoneTime);
				if (!isNaN(d.getTime())) {
				  // We'll show this time in red text
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

		<button
		  className="mt-3 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
		  onClick={onClose}
		>
		  Cancel
		</button>
	  </div>
	</div>
  );
}

export default MilestoneModal;
