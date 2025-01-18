// File: /src/IdeaList.js
import React from "react";
import IdeaItem from "./IdeaItem";

/**
 * IdeaList
 * 
 * Removed all milestone references.
 */
function IdeaList({
  ideas,
  tasks,
  ideasListRef,
  hoveredIdeaId,
  setHoveredIdeaId,
  deleteConfirm,
  handleDeleteClick,
  onCreateTask,
  onDeleteIdea,
}) {
  if (ideas.length === 0) {
	return <p>No ideas found for your account.</p>;
  }

  return (
	<ul ref={ideasListRef} className="divide-y divide-gray-200 border rounded">
	  {ideas.map((idea) => {
		const ideaCustomId = idea.fields.IdeaID;
		// Filter tasks for this Idea
		const ideaTasks = tasks.filter(
		  (task) => task.fields.IdeaID === ideaCustomId
		);

		const isHovered = hoveredIdeaId === idea.id;
		const isConfirming = deleteConfirm[idea.id];

		return (
		  <IdeaItem
			key={idea.id}
			idea={idea}
			ideaTasks={ideaTasks}
			isHovered={isHovered}
			isConfirming={isConfirming}
			onHoverEnter={() => setHoveredIdeaId(idea.id)}
			onHoverLeave={() => setHoveredIdeaId(null)}
			onDeleteClick={() => handleDeleteClick(idea.id)}
			onTaskCreate={(taskName) => onCreateTask(ideaCustomId, taskName)}
			// Removed onPickMilestone & allMilestones
			onDeleteIdea={onDeleteIdea}
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
