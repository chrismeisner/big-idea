// src/Header.js

import React from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { SunIcon, MoonIcon, UserCircleIcon } from '@heroicons/react/24/outline';

function Header({ isLoggedIn, onLogout, airtableUser }) {
  const handleLogout = async () => {
	const auth = getAuth();
	await signOut(auth);
	onLogout();
  };

  const { theme, toggle } = useTheme();

  let displayName = '';
  if (airtableUser && airtableUser.fields) {
	displayName = airtableUser.fields.Name || '';
  }

  return (
	<header className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-900">
	  {/* Left side: Logo & navigation */}
	  <div className="flex items-center space-x-4">
		<h1 className="text-xl font-bold">
		  <Link to="/" className="text-gray-900 dark:text-gray-100">
			Big Idea
		  </Link>
		</h1>

		{isLoggedIn && (
		  <>
			<Link
			  to="/today"
			  className="py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
			>
			  Today
			</Link>
			<Link
			  to="/milestones"
			  className="py-1 px-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
			>
			  Milestones
			</Link>
		  </>
		)}
	  </div>

	  {/* Right side: Theme toggle & user controls */}
	  <div className="flex items-center space-x-4">
		{/* Dark/light mode toggle */}
		<button
		  onClick={toggle}
		  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
		  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
		>
		  {theme === 'dark' ? (
			<SunIcon className="h-5 w-5 text-yellow-400" />
		  ) : (
			<MoonIcon className="h-5 w-5 text-gray-600" />
		  )}
		</button>

		{isLoggedIn ? (
		  <>
			{displayName ? (
			  <strong className="text-green-600 dark:text-green-400">
				{displayName}
			  </strong>
			) : (
			  <strong className="text-green-600 dark:text-green-400">
				Logged In
			  </strong>
			)}
			<Link
			  to="/profile"
			  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
			  title="Profile & Settings"
			>
			  <UserCircleIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
			</Link>
			<button
			  onClick={handleLogout}
			  className="py-1 px-3 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
			>
			  Log Out
			</button>
		  </>
		) : (
		  <strong className="text-red-500 dark:text-red-400">
			Not Logged In
		  </strong>
		)}
	  </div>
	</header>
  );
}

export default Header;
