// File: /src/IdeaList.js

import React from "react";
import IdeaItem from "./IdeaItem";

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
}) {
  if (ideas.length === 0) {
	return <p>No ideas found for your account.</p>;
  }

  return (
	<ul ref={ideasListRef} className="divide-y divide-gray-200 border rounded">
	  {ideas.map((idea) => {
		// This is our custom ID formula field, e.g. "o0bwzsFdnLfR75"
		const ideaCustomId = idea.fields.IdeaID;

		// 1) Filter tasks that belong to this Idea
		const ideaTasks = tasks.filter(
		  (task) => task.fields.IdeaID === ideaCustomId
		);

		// 2) For each of these tasks, find any milestones referencing its TaskID
		//    We'll combine them into one array for the entire Idea, so IdeaItem
		//    can show them all. Or you can pass them individually per task—up to you.
		const collectedMilestones = [];
		ideaTasks.forEach((t) => {
		  const tID = t.fields.TaskID;
		  const milestonesForTask = milestones.filter(
			(m) => m.fields.TaskID === tID
		  );
		  collectedMilestones.push(...milestonesForTask);
		});

		// Or, if you prefer a "map of taskId -> milestones[]," you could build that
		// here and pass it to IdeaItem. But for simplicity, we'll do a single array:
		const ideaMilestones = collectedMilestones;

		// Debug logs
		console.log(
		  `[IdeaList] Found idea with custom ID="${ideaCustomId}"`,
		  idea
		);
		console.log("[IdeaList] Filtered tasks =>", ideaTasks);
		console.log("[IdeaList] Rolled-up milestones =>", ideaMilestones);

		// Check if user is hovering over this idea
		const isHovered = hoveredIdeaId === idea.id;
		// Check if user has clicked delete once already
		const isConfirming = deleteConfirm[idea.id];

		return (
		  <IdeaItem
			key={idea.id} // use record ID as the React key
			idea={idea}
			// The tasks for this idea
			ideaTasks={ideaTasks}
			// The combined milestones from all tasks in this idea
			ideaMilestones={ideaMilestones}
			isHovered={isHovered}
			isConfirming={isConfirming}
			onHoverEnter={() => setHoveredIdeaId(idea.id)}
			onHoverLeave={() => setHoveredIdeaId(null)}
			onDeleteClick={() => handleDeleteClick(idea.id)}
			// For creating a new task in this idea
			onTaskCreate={(taskName) => onCreateTask(ideaCustomId, taskName)}
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
