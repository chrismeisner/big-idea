// File: /src/TurnIntoTaskModal.js
import React, { useState } from "react";

/**
 * TurnIntoTaskModal
 * - Shows a list of all Ideas in a <select>.
 * - When user picks one and clicks "Make a Task", calls onConfirm(destinationIdeaID).
 * - If user clicks the backdrop or the "Cancel" button, we call onCancel/onClose.
 */
function TurnIntoTaskModal({
  allIdeas,
  activeIdea,
  onClose,
  onCancel,
  onConfirm
}) {
  // Which Idea did the user select as the destination?
  const [selectedIdeaID, setSelectedIdeaID] = useState("");

  // If no active idea, don't render anything
  if (!activeIdea) return null;

  const originalTitle = activeIdea.fields.IdeaTitle || "(Untitled)";

  const handleMakeTask = () => {
	if (!selectedIdeaID) return; // must pick an Idea
	onConfirm(selectedIdeaID);
  };

  const handleBackdropClick = () => {
	onCancel();
  };

  const handleDialogClick = (e) => {
	e.stopPropagation(); // prevents closing modal if clicking inside
  };

  return (
	<div
	  className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
	  onClick={handleBackdropClick}
	>
	  <div
		className="bg-white p-4 rounded shadow-lg w-80"
		onClick={handleDialogClick}
	  >
		<h2 className="text-lg font-bold mb-3">
		  Turn "{originalTitle}" into a Task
		</h2>
		<p className="text-sm text-gray-600 mb-3">
		  Select which Idea will contain this new task:
		</p>

		{/* Destination Idea list */}
		<select
		  className="border border-gray-300 w-full p-1 rounded mb-4"
		  value={selectedIdeaID}
		  onChange={(e) => setSelectedIdeaID(e.target.value)}
		>
		  <option value="">-- Select an Idea --</option>
		  {allIdeas.map((idea) => (
			<option key={idea.id} value={idea.fields.IdeaID}>
			  {idea.fields.IdeaTitle}
			</option>
		  ))}
		</select>

		<div className="flex justify-end space-x-2">
		  <button
			onClick={onCancel}
			className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
		  >
			Cancel
		  </button>
		  <button
			onClick={handleMakeTask}
			className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
		  >
			Make a Task
		  </button>
		</div>
	  </div>
	</div>
  );
}

export default TurnIntoTaskModal;
