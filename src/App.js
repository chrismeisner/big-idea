// File: /src/App.js

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";
import TodayView from "./TodayView";
import Milestones from "./Milestones";

// NEW IMPORT: the new MilestoneDetail component
import MilestoneDetail from "./MilestoneDetail";

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

        {/* /ideas/:customIdeaId (show IdeaDetail) */}
        <Route path="/ideas/:customIdeaId" element={<IdeaDetail />} />

        {/* /today => TodayView */}
        <Route path="/today" element={<TodayView />} />

        {/* /milestones => Milestones page */}
        <Route path="/milestones" element={<Milestones />} />

        {/* NEW ROUTE: /milestones/:milestoneId => MilestoneDetail */}
        <Route path="/milestones/:milestoneId" element={<MilestoneDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
