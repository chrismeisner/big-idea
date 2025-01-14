// File: /src/App.js

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);

  // NEW: Track if we've finished checking Firebase auth
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Firebase user detected, setting isLoggedIn = true");
        setIsLoggedIn(true);
      } else {
        console.log("No Firebase user, setting isLoggedIn = false");
        setIsLoggedIn(false);
        setAirtableUser(null);
      }
      // Mark that we have finished checking user auth state
      setAuthLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // We'll use a helper check to see if Name is present
  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

  const handleLogin = (userRecord) => {
    console.log("handleLogin in App.js called with Airtable user:", userRecord);
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

  // 1) If we're still loading auth, show a fallback (spinner, text, etc.)
  if (!authLoaded) {
    return <div className="m-8">Checking login status...</div>;
  }

  // 2) Once authLoaded is true, render normally:
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
              // If not logged in => show phone login
              <Login onLogin={handleLogin} />
            ) : userNeedsOnboarding ? (
              // If logged in but missing user Name => show onboarding
              <Onboarding
                userRecord={airtableUser}
                onComplete={handleOnboardingComplete}
              />
            ) : (
              // Otherwise => show main content
              <MainContent />
            )
          }
        />

        {/* Detail view for a single idea (only valid once authLoaded) */}
        <Route path="/ideas/:ideaId" element={<IdeaDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
