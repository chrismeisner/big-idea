// File: /src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";

// ADD THIS import for your new Today screen
import TodayView from "./TodayView";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setAirtableUser(null);
      }
      setAuthLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

  const handleLogin = (userRecord) => {
    setIsLoggedIn(true);
    setAirtableUser(userRecord);
  };

  const handleOnboardingComplete = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAirtableUser(null);
  };

  if (!authLoaded) {
    return <div className="m-8">Checking login status...</div>;
  }

  return (
    <Router>
      <Header
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        airtableUser={airtableUser}
      />

      <Routes>
        <Route
          path="/"
          element={
            !isLoggedIn ? (
              <Login onLogin={handleLogin} />
            ) : userNeedsOnboarding ? (
              <Onboarding
                userRecord={airtableUser}
                onComplete={handleOnboardingComplete}
              />
            ) : (
              <MainContent />
            )
          }
        />

        {/* Detail view for a single idea */}
        <Route path="/ideas/:ideaId" element={<IdeaDetail />} />

        {/* NEW ROUTE for TodayView */}
        <Route path="/today" element={<TodayView />} />
      </Routes>
    </Router>
  );
}

export default App;
