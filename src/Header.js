// File: /src/Header.js

import React from "react";
import { getAuth, signOut } from "firebase/auth";
import { Link } from "react-router-dom";

function Header({ isLoggedIn, onLogout, airtableUser }) {
  const handleLogout = async () => {
	const auth = getAuth();
	await signOut(auth);
	onLogout();
  };

  let username = "";
  if (airtableUser && airtableUser.fields) {
	username = airtableUser.fields.Username || "";
  }

  return (
	<header className="flex justify-between items-center p-4 bg-gray-100">
	  <div className="flex items-center space-x-4">
		<h1 className="text-xl font-bold">
		  <Link to="/">Big Idea</Link>
		</h1>

		{/* (Optional) Link to Today */}
		{isLoggedIn && (
		  <Link
			to="/today"
			className="py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
		  >
			Today
		  </Link>
		)}
	  </div>

	  <div>
		{isLoggedIn ? (
		  <>
			{username ? (
			  <strong className="text-green-600 mr-4">
				Logged In as {username}
			  </strong>
			) : (
			  <strong className="text-green-600 mr-4">Logged In</strong>
			)}
			<button
			  onClick={handleLogout}
			  className="py-1 px-3 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
			>
			  Log Out
			</button>
		  </>
		) : (
		  <strong className="text-red-500">Not Logged In</strong>
		)}
	  </div>
	</header>
  );
}

export default Header;
