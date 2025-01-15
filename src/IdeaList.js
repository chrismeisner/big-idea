// File: /src/IdeaList.js

import React from "react";
import IdeaItem from "./IdeaItem";

/**
 * IdeaList
 * 
 * Props:
 * - ideas: Array of Idea records
 * - tasks: Array of Task records
 * - milestones: Array of Milestone records (allMilestones)
 * - ideasListRef: Ref for the Sortable container (if any)
 * - hoveredIdeaId, setHoveredIdeaId: for hover styling + UI
 * - deleteConfirm: object that tracks which idea is in “delete confirm” state
 * - handleDeleteClick: callback to delete an idea
 * - onCreateTask: callback to create a new Task in a given idea
 * - onPickMilestone: callback if we want to open a modal or otherwise handle milestone assignment
 */
function IdeaList({
  ideas,
  tasks,
  milestones,
  ideasListRef,
  hoveredIdeaId,
  setHoveredIdeaId,
  deleteConfirm,
  handleDeleteClick,
  onCreateTask,
  onPickMilestone, // optional callback for picking a milestone
}) {
  if (ideas.length === 0) {
	return <p>No ideas found for your account.</p>;
  }

  return (
	<ul ref={ideasListRef} className="divide-y divide-gray-200 border rounded">
	  {ideas.map((idea) => {
		// This is our custom ID formula field, e.g. "o0bwzsFdnLfR75"
		const ideaCustomId = idea.fields.IdeaID;

		// Filter tasks for this Idea
		const ideaTasks = tasks.filter(
		  (task) => task.fields.IdeaID === ideaCustomId
		);

		// Check if user is hovering
		const isHovered = hoveredIdeaId === idea.id;
		// Check if user has clicked delete once already
		const isConfirming = deleteConfirm[idea.id];

		return (
		  <IdeaItem
			key={idea.id}
			idea={idea}
			ideaTasks={ideaTasks}
			allMilestones={milestones} // pass down all milestones
			isHovered={isHovered}
			isConfirming={isConfirming}
			onHoverEnter={() => setHoveredIdeaId(idea.id)}
			onHoverLeave={() => setHoveredIdeaId(null)}
			onDeleteClick={() => handleDeleteClick(idea.id)}
			// For creating a new task in this idea
			onTaskCreate={(taskName) => onCreateTask(ideaCustomId, taskName)}
			// For picking a milestone in a modal, etc.
			onPickMilestone={onPickMilestone}
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
