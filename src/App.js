// File: big-idea/src/App.js

import React, { useState } from 'react';
import Header from './Header';
import Login from './Login';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <div>
      <Header isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      
      {/* Show "Login" if not logged in */}
      {!isLoggedIn && <Login onLogin={handleLogin} />}
      
      {/* Show main content if logged in */}
      {isLoggedIn && (
        <div className="m-8 text-center">
          <h2 className="text-2xl font-bold">Welcome to Big Idea!</h2>
          <p className="mt-2">You’ve successfully logged in with your phone number!</p>
        </div>
      )}
    </div>
  );
}

export default App;
