// File: /src/MilestoneModal.js

import React from "react";

function MilestoneModal({ allMilestones, onClose, onSelect }) {
  if (!allMilestones) return null;

  return (
	<div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
	  <div className="bg-white w-80 p-4 rounded shadow-lg">
		<h2 className="text-lg font-bold mb-2">Pick a Milestone</h2>

		<ul className="max-h-64 overflow-y-auto border rounded divide-y">
		  {allMilestones.map((m) => (
			<li key={m.id}>
			  <button
				className="w-full text-left px-2 py-2 hover:bg-gray-100"
				onClick={() => onSelect(m)}
			  >
				{m.fields.MilestoneName || "(Untitled)"}
			  </button>
			</li>
		  ))}
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
