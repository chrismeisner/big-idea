// File: /src/IdeaList.js

import React from "react";
import IdeaItem from "./IdeaItem";

function IdeaList({
  ideas,
  tasks,
  onDeleteIdea,
  onCreateTask,
  onReorderIdea, // <- new prop to handle reorder
}) {
  if (!ideas || ideas.length === 0) {
	return <p>No ideas found.</p>;
  }

  // We'll pass the relevant tasks for each idea, plus its “position” (index+1).
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
			position={index + 1}       // 1-based position
			totalIdeas={ideas.length}  // total count
			onReorder={onReorderIdea}  // pass reorder handler
		  />
		);
	  })}
	</ul>
  );
}

export default IdeaList;
