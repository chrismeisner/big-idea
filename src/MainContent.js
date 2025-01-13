import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

function MainContent() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ----- NEW: Local state for new idea inputs -----
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [newIdeaSummary, setNewIdeaSummary] = useState("");

  useEffect(() => {
	const fetchIdeas = async () => {
	  setLoading(true);
	  setError(null);

	  const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
	  const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

	  if (!baseId || !apiKey) {
		console.error("Airtable Base ID or API Key is missing in environment variables.");
		setError("Missing Airtable credentials.");
		setLoading(false);
		return;
	  }

	  try {
		const auth = getAuth();
		const currentUser = auth.currentUser;

		if (!currentUser) {
		  setError("No logged-in user.");
		  setLoading(false);
		  return;
		}

		const userPhoneNumber = currentUser.phoneNumber;

		// Fetch data from Airtable
		const response = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		  headers: {
			Authorization: `Bearer ${apiKey}`,
		  },
		});

		if (!response.ok) {
		  throw new Error(`Airtable error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Filter rows where UserMobile matches the logged-in user's phone number
		const filteredIdeas = data.records.filter(
		  (record) => record.fields.UserMobile === userPhoneNumber
		);

		setIdeas(filteredIdeas);
	  } catch (err) {
		console.error("Error fetching ideas from Airtable:", err);
		setError("Failed to fetch ideas. Please try again later.");
	  } finally {
		setLoading(false);
	  }
	};

	fetchIdeas();
  }, []);

  // ----- NEW: Handler to create a new Idea -----
  const handleCreateIdea = async (e) => {
	e.preventDefault();
	setError(null);

	const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
	const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;

	if (!baseId || !apiKey) {
	  console.error("Airtable Base ID or API Key is missing in environment variables.");
	  setError("Missing Airtable credentials.");
	  return;
	}

	try {
	  const auth = getAuth();
	  const currentUser = auth.currentUser;

	  if (!currentUser) {
		setError("No logged-in user.");
		return;
	  }

	  const userPhoneNumber = currentUser.phoneNumber;

	  // Create a new Airtable record
	  const response = await fetch(`https://api.airtable.com/v0/${baseId}/Ideas`, {
		method: "POST",
		headers: {
		  Authorization: `Bearer ${apiKey}`,
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({
		  records: [
			{
			  fields: {
				IdeaTitle: newIdeaTitle,
				IdeaSummary: newIdeaSummary,
				UserMobile: userPhoneNumber,
			  },
			},
		  ],
		}),
	  });

	  if (!response.ok) {
		throw new Error(`Airtable error: ${response.status} ${response.statusText}`);
	  }

	  const data = await response.json();
	  const createdRecord = data.records[0];

	  // Add the newly created idea to our list
	  setIdeas((prevIdeas) => [...prevIdeas, createdRecord]);

	  // Clear the form
	  setNewIdeaTitle("");
	  setNewIdeaSummary("");
	} catch (err) {
	  console.error("Error creating idea in Airtable:", err);
	  setError("Failed to create idea. Please try again later.");
	}
  };

  if (loading) {
	return <p>Loading your ideas...</p>;
  }

  if (error) {
	return <p className="text-red-500">{error}</p>;
  }

  return (
	<div className="m-8">
	  <h2 className="text-2xl font-bold mb-4">Your Ideas</h2>

	  {/* ----- NEW: Idea Creation Form ----- */}
	  <form onSubmit={handleCreateIdea} className="mb-6 p-4 border rounded bg-gray-100">
		<div className="mb-4">
		  <label htmlFor="newIdeaTitle" className="block text-sm font-medium mb-1">
			Idea Title
		  </label>
		  <input
			id="newIdeaTitle"
			type="text"
			className="border p-2 w-full"
			value={newIdeaTitle}
			onChange={(e) => setNewIdeaTitle(e.target.value)}
			required
		  />
		</div>
		<div className="mb-4">
		  <label htmlFor="newIdeaSummary" className="block text-sm font-medium mb-1">
			Idea Summary
		  </label>
		  <textarea
			id="newIdeaSummary"
			className="border p-2 w-full"
			value={newIdeaSummary}
			onChange={(e) => setNewIdeaSummary(e.target.value)}
			required
		  />
		</div>
		<button
		  type="submit"
		  className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
		>
		  Create Idea
		</button>
	  </form>
	  {/* ----- END: Idea Creation Form ----- */}

	  {/* Existing list of Ideas */}
	  {ideas.length > 0 ? (
		<ul className="space-y-4">
		  {ideas.map((idea) => (
			<li
			  key={idea.id}
			  className="p-4 border rounded shadow-sm bg-gray-50 hover:shadow-md transition"
			>
			  <h3 className="text-lg font-bold">{idea.fields.IdeaTitle}</h3>
			  <p className="text-gray-600 mt-1">{idea.fields.IdeaSummary}</p>
			</li>
		  ))}
		</ul>
	  ) : (
		<p>No ideas found for your account.</p>
	  )}
	</div>
  );
}

export default MainContent;
