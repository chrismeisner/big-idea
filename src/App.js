// File: /src/App.js

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";

// <-- Import your new minimal TodayView
import TodayView from "./TodayView";

import Milestones from "./Milestones";
import MilestoneDetail from "./MilestoneDetail"; // uses custom ID approach

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

  // We only know if user needs Onboarding if we have an Airtable user
  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

  // Called from <Login /> after phone number is verified + user created in Airtable
  const handleLogin = (userRecord) => {
    setIsLoggedIn(true);
    setAirtableUser(userRecord);
  };

  // Called when onboarding is finished
  const handleOnboardingComplete = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  // Log out
  const handleLogout = () => {
    setIsLoggedIn(false);
    setAirtableUser(null);
    const auth = getAuth();
    auth.signOut().catch((err) => console.error("Failed to sign out:", err));
  };

  // Wait until we know if user is logged in or not
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
              // Pass the current Airtable user to MainContent
              <MainContent airtableUser={airtableUser} />
            )
          }
        />

        {/* If a user visits /ideas/:customIdeaId => IdeaDetail */}
        <Route path="/ideas/:customIdeaId" element={<IdeaDetail />} />

        {/* If user visits /today => show new minimal TodayView, passing airtableUser */}
        <Route
          path="/today"
          element={
            isLoggedIn ? (
              <TodayView airtableUser={airtableUser} />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />

        {/* /milestones => Milestones overview page */}
        <Route path="/milestones" element={<Milestones />} />

        {/* /milestones/:milestoneCustomId => MilestoneDetail by custom ID */}
        <Route
          path="/milestones/:milestoneCustomId"
          element={<MilestoneDetail />}
        />
      </Routes>
    </Router>
  );
}

export default App;
