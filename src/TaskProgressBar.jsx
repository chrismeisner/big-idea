// File: /src/TaskProgressBar.jsx

import React from "react";

function TaskProgressBar({ completedTasks, totalTasks, percentage }) {
  // Optional: If you want to hide the bar if totalTasks === 0, check that condition
  if (totalTasks === 0) {
	return null; // or a small placeholder
  }

  return (
	<div className="mt-4">
	  {/* e.g. "4/10 tasks complete (40%)" */}
	  <p className="text-sm text-gray-600">
		{completedTasks}/{totalTasks} tasks complete
		<span className="ml-2">({percentage}%)</span>
	  </p>
	  {/* The bar */}
	  <div className="bg-gray-200 h-3 rounded mt-1 w-full">
		<div
		  className="bg-green-500 h-3 rounded"
		  style={{ width: `${percentage}%` }}
		/>
	  </div>
	</div>
  );
}

export default TaskProgressBar;
