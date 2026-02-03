// File: src/components/MilestoneRow.jsx

import React from "react";
import { Link } from "react-router-dom";

export default function MilestoneRow({
  MilestoneID,
  MilestoneName,
  allMilestones,
  onPick,
  onRemove,
}) {
  if (MilestoneID) {
	let name = MilestoneName;
	if (!name) {
	  const found = allMilestones.find(
		(m) => m.fields.MilestoneID === MilestoneID
	  );
	  name = found?.fields.MilestoneName || "(Unknown Milestone)";
	}
	return (
	  <div className="group mb-1 inline-flex items-center">
		<p className="text-sm text-blue-700 font-semibold">
		  🏔{" "}
		  <Link to={`/milestones/${MilestoneID}`} className="underline">
			{name}
		  </Link>
		</p>
		<span
		  className="ml-2 text-xs text-blue-600 underline cursor-pointer hidden group-hover:inline-block"
		  onClick={onPick}
		>
		  Edit
		</span>
	  </div>
	);
  }

  return (
	<p className="text-sm text-blue-600 underline mb-1 cursor-pointer" onClick={onPick}>
	  Add Milestone
	</p>
  );
}
