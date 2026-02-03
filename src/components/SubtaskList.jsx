// File: src/components/SubtaskList.jsx

import React, { useEffect, useRef } from "react";
import Sortable from "sortablejs";

export default function SubtaskList({ parentTask, subtasks, onSortEnd, children }) {
  const listRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
	if (listRef.current) {
	  if (sortableRef.current) sortableRef.current.destroy();
	  sortableRef.current = new Sortable(listRef.current, {
		animation: 150,
		handle: ".sub-drag-handle",
		onEnd: (evt) => onSortEnd(evt, parentTask),
	  });
	}
	return () => {
	  if (sortableRef.current) {
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, [subtasks, onSortEnd, parentTask]);

  return (
	<ul className="mt-2 ml-6 border-l border-gray-200 space-y-2" ref={listRef}>
	  {children}
	</ul>
  );
}
