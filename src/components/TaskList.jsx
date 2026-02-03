// File: src/components/TaskList.jsx

import React, { useEffect, useRef } from "react";
import Sortable from "sortablejs";

export default function TaskList({ tasks, onSortEnd, children }) {
  const listRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
	if (listRef.current && !sortableRef.current) {
	  sortableRef.current = new Sortable(listRef.current, {
		animation: 150,
		handle: ".drag-handle",
		onEnd: onSortEnd,
	  });
	}
	return () => {
	  if (sortableRef.current) {
		sortableRef.current.destroy();
		sortableRef.current = null;
	  }
	};
  }, [tasks, onSortEnd]);

  return (
	<ul ref={listRef} className="space-y-3 mt-2">
	  {children}
	</ul>
  );
}
