// File: src/components/InlineEdit.jsx

import React, { useState, useRef, useEffect } from "react";

export default function InlineEdit({
  value: initialValue,
  onSave,
  type = "text",
  className = "",
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue || "");
  const ref = useRef(null);

  useEffect(() => {
	if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const finish = () => {
	setEditing(false);
	if (value.trim() !== (initialValue || "").trim()) {
	  onSave(value.trim());
	}
  };

  if (editing) {
	if (type === "textarea") {
	  return (
		<textarea
		  ref={ref}
		  rows={3}
		  className={className}
		  value={value}
		  onChange={(e) => setValue(e.target.value)}
		  onBlur={finish}
		  onKeyDown={(e) => {
			if (e.key === "Escape") {
			  setEditing(false);
			  setValue(initialValue || "");
			}
			if (e.key === "Enter") finish();
		  }}
		/>
	  );
	}
	return (
	  <input
		ref={ref}
		type="text"
		className={className}
		value={value}
		onChange={(e) => setValue(e.target.value)}
		onBlur={finish}
		onKeyDown={(e) => {
		  if (e.key === "Escape") {
			setEditing(false);
			setValue(initialValue || "");
		  }
		  if (e.key === "Enter") finish();
		}}
	  />
	);
  }

  return (
	<span className={className} onClick={() => setEditing(true)}>
	  {initialValue}
	</span>
  );
}
