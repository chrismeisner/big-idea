// File: big-idea/src/Header.js

import React from 'react';

function Header({ isLoggedIn, onLogout }) {
  return (
	<header className="flex justify-between items-center p-4 bg-gray-100">
	  <h1 className="text-xl font-bold">Big Idea</h1>
	  <div>
		{isLoggedIn ? (
		  <>
			<strong className="text-green-600 mr-4">Logged In</strong>
			<button
			  onClick={onLogout}
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
