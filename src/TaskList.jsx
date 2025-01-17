// File: /src/TaskList.jsx

import React from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";

/**
 * TaskList
 *
 * - Renders top-level tasks (parents), each with a subtask list.
 * - Displays milestone ONLY for top-level tasks (no milestone block for subtasks).
 * - Milestone block is above the task title, labeled “🏔️ Milestone” if none is set,
 *   or “🏔️ <MilestoneName>” if one is set.
 * - "+ Subtask" is a text link in the same style (blue + underline).
 *
 * Props:
 *  - topLevelTasks: array of parent tasks (no ParentTask).
 *  - subtasksByParent: object keyed by parentTaskID => array of subtasks.
 *  - editingTaskId, editingTaskName
 *  - onEditNameChange, onCommitEdit, onCancelEditing, onStartEditing
 *  - onToggleCompleted, onToggleToday
 *  - onPickMilestone, getMilestoneForTask
 *  - createSubtask
 *  - topLevelRef, subtaskRefs => Refs for Sortable
 */
function TaskList({
  topLevelTasks,
  subtasksByParent,
  editingTaskId,
  editingTaskName,
  onEditNameChange,
  onCommitEdit,
  onCancelEditing,
  onStartEditing,
  onToggleCompleted,
  onToggleToday,
  onPickMilestone,
  getMilestoneForTask,
  createSubtask,
  topLevelRef,
  subtaskRefs,
}) {
  return (
	<ul className="divide-y divide-gray-200 border rounded" ref={topLevelRef}>
	  {topLevelTasks.map((parent) => {
		// Parent fields
		const parentCompleted = parent.fields.Completed || false;
		const parentCompletedTime = parent.fields.CompletedTime || null;
		const isTodayParent = parent.fields.Today || false;
		const parentMilestone = getMilestoneForTask(parent);

		// Check if editing this parent
		const isEditingThisParent = editingTaskId === parent.id;

		// Gather subtasks
		const childTasks = subtasksByParent[parent.fields.TaskID] || [];

		return (
		  <li key={parent.id} className="p-4 hover:bg-gray-50">
			{/* ============= MILESTONE (TOP-LEVEL ONLY), ABOVE TITLE ============= */}
			<div className="ml-6 mb-2 pl-3 border-l border-gray-200">
			  {parentMilestone ? (
				<p className="text-sm">
				  🏔️ <strong>{parentMilestone.fields.MilestoneName}</strong>
				</p>
			  ) : (
				<p
				  className="text-sm text-blue-600 underline cursor-pointer"
				  onClick={() => onPickMilestone(parent)}
				>
				  🏔️ Milestone
				</p>
			  )}
			</div>

			{/* ============= PARENT TASK ROW ============= */}
			<div className="flex items-center">
			  {/* Draggable handle (for Sortable) */}
			  <div
				className="grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
				title="Drag to reorder parent tasks"
			  >
				<Bars3Icon className="h-5 w-5" />
			  </div>

			  {/* Completed checkbox */}
			  <input
				type="checkbox"
				className="mr-2"
				checked={parentCompleted}
				onChange={() => onToggleCompleted(parent)}
			  />

			  {/* Inline editing: Parent name */}
			  <div className="flex-1">
				{isEditingThisParent ? (
				  <input
					autoFocus
					className="border-b border-gray-300 focus:outline-none"
					value={editingTaskName}
					onChange={(e) => onEditNameChange(e.target.value)}
					onBlur={() => onCommitEdit(parent.id)}
					onKeyDown={(e) => {
					  if (e.key === "Enter") onCommitEdit(parent.id);
					  else if (e.key === "Escape") onCancelEditing();
					}}
				  />
				) : (
				  <span
					className={`cursor-pointer ${
					  parentCompleted ? "line-through text-gray-500" : ""
					}`}
					onClick={() =>
					  onStartEditing(parent.id, parent.fields.TaskName)
					}
				  >
					{parent.fields.TaskName}
				  </span>
				)}

				{/* Completed timestamp, if any */}
				{parentCompleted && parentCompletedTime && (
				  <span className="ml-2 text-sm text-gray-400">
					(Done on {new Date(parentCompletedTime).toLocaleString()})
				  </span>
				)}
			  </div>

			  {/* Today checkbox (only if not completed) */}
			  {!parentCompleted && (
				<div className="ml-2 flex items-center space-x-1">
				  <input
					type="checkbox"
					checked={isTodayParent}
					onChange={() => onToggleToday(parent)}
				  />
				  <label className="text-sm">Today</label>
				</div>
			  )}
			</div>

			{/* ============= SUBTASK LIST (NO MILESTONE UI HERE) ============= */}
			{childTasks.length > 0 && (
			  <ul
				ref={(el) => (subtaskRefs.current[parent.id] = el)}
				className="ml-6 mt-2 border-l border-gray-200"
			  >
				{childTasks.map((sub) => {
				  const subCompleted = sub.fields.Completed || false;
				  const subCompletedTime = sub.fields.CompletedTime || null;
				  const isEditingThisSub = editingTaskId === sub.id;

				  return (
					<li
					  key={sub.id}
					  className="py-2 pl-3 hover:bg-gray-50 flex flex-col"
					>
					  <div className="flex items-center">
						{/* Draggable handle (for Sortable subtask) */}
						<div
						  className="sub-grab-handle mr-2 cursor-grab active:cursor-grabbing text-gray-400"
						  title="Drag to reorder subtasks"
						>
						  <Bars3Icon className="h-4 w-4" />
						</div>

						{/* Completed checkbox */}
						<input
						  type="checkbox"
						  className="mr-2"
						  checked={subCompleted}
						  onChange={() => onToggleCompleted(sub)}
						/>

						{/* Inline editing: Subtask name */}
						<div className="flex-1">
						  {isEditingThisSub ? (
							<input
							  autoFocus
							  className="border-b border-gray-300 focus:outline-none"
							  value={editingTaskName}
							  onChange={(e) => onEditNameChange(e.target.value)}
							  onBlur={() => onCommitEdit(sub.id)}
							  onKeyDown={(e) => {
								if (e.key === "Enter") onCommitEdit(sub.id);
								else if (e.key === "Escape") onCancelEditing();
							  }}
							/>
						  ) : (
							<span
							  className={`cursor-pointer ${
								subCompleted
								  ? "line-through text-gray-500"
								  : ""
							  }`}
							  onClick={() =>
								onStartEditing(sub.id, sub.fields.TaskName)
							  }
							>
							  {sub.fields.TaskName}
							</span>
						  )}
						  {/* Completed timestamp, if any */}
						  {subCompleted && subCompletedTime && (
							<span className="ml-2 text-sm text-gray-400">
							  (Done on{" "}
							  {new Date(subCompletedTime).toLocaleString()})
							</span>
						  )}
						</div>

						{/* Subtask "Today" toggle (only if not completed) */}
						{!subCompleted && (
						  <div className="ml-2 flex items-center space-x-1">
							<input
							  type="checkbox"
							  checked={sub.fields.Today || false}
							  onChange={() => onToggleToday(sub)}
							/>
							<label className="text-sm">Today</label>
						  </div>
						)}
					  </div>
					</li>
				  );
				})}
			  </ul>
			)}

			{/* ============= "+ Subtask" as TEXT LINK ============= */}
			<div className="ml-6 mt-2 pl-3 border-l border-gray-200">
			  <p
				className="text-sm text-blue-600 underline cursor-pointer"
				onClick={() => createSubtask(parent)}
			  >
				+ Subtask
			  </p>
			</div>
		  </li>
		);
	  })}
	</ul>
  );
}

export default TaskList;
