import React from "react";
import IdeaItem from "./IdeaItem";

function IdeaList({
  ideas,
  tasks,
  onDeleteIdea,
  onCreateTask,
  onReorderIdea,
  // NEW prop
  onRequestTurnIntoTask
}) {
  if (!ideas || ideas.length === 0) {
	return <p>No ideas found.</p>;
  }

  return (
	<ul className="divide-y divide-gray-200 border rounded">
	  {ideas.map((idea, index) => {
		const ideaCustomId = idea.fields.IdeaID;
		// filter tasks for this idea
		const ideaTasks = tasks.filter((t) => t.fields.IdeaID === ideaCustomId);

		return (
		  <IdeaItem
			key={idea.id}
			idea={idea}
			ideaTasks={ideaTasks}
			onDeleteIdea={onDeleteIdea}
			onTaskCreate={(taskName) => onCreateTask(ideaCustomId, taskName)}
			position={index + 1}
			totalIdeas={ideas.length}
			onReorder={onReorderIdea}
			// pass it down so IdeaItem can show the link
			onRequestTurnIntoTask={onRequestTurnIntoTask}
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
