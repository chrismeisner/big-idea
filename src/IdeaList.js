// File: /src/IdeaList.js

import React from "react";
import IdeaItem from "./IdeaItem";

function IdeaList({
  ideas,
  tasks,
  ideasListRef,
  hoveredIdeaId,
  setHoveredIdeaId,
  deleteConfirm,
  handleDeleteClick,
  onCreateTask,
}) {
  if (ideas.length === 0) {
	return <p>No ideas found for your account.</p>;
  }

  // We return a <ul> that SortableJS will latch onto via ideasListRef
  return (
	<ul ref={ideasListRef} className="divide-y divide-gray-200 border rounded">
	  {ideas.map((idea) => {
		const isHovered = hoveredIdeaId === idea.id;
		const isConfirming = deleteConfirm[idea.id];

		// Filter tasks for this idea
		const ideaTasks = tasks.filter(
		  (task) => task.fields.IdeaID === idea.id
		);

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
			onTaskCreate={(taskName) => onCreateTask(idea.id, taskName)}
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
