// File: src/components/NewTaskForm.jsx

import React from "react";

export default function NewTaskForm({
  newTaskName,
  setNewTaskName,
  newTaskPosition,
  setNewTaskPosition,
  onSubmit,
}) {
  return (
	<form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 max-w-md">
	  <div className="flex gap-2">
		<input
		  type="text"
		  placeholder="New top-level task..."
		  value={newTaskName}
		  onChange={(e) => setNewTaskName(e.target.value)}
		  className="border border-gray-300 rounded px-2 py-1 flex-1"
		/>
		<button
		  type="submit"
		  className="bg-green-600 text-white px-3 rounded hover:bg-green-700"
		>
		  Add
		</button>
	  </div>

	  <div className="flex items-center space-x-6">
		<label className="inline-flex items-center space-x-2">
		  <input
			type="radio"
			name="taskPosition"
			checked={newTaskPosition === "top"}
			onChange={() => setNewTaskPosition("top")}
		  />
		  <span className="text-sm">Top of list</span>
		</label>

		<label className="inline-flex items-center space-x-2">
		  <input
			type="radio"
			name="taskPosition"
			checked={newTaskPosition === "bottom"}
			onChange={() => setNewTaskPosition("bottom")}
		  />
		  <span className="text-sm">Bottom of list</span>
		</label>
	  </div>
	</form>
  );
}
