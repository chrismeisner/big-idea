// File: /Users/chrismeisner/Projects/big-idea/src/App.js

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { authenticateUser } from "./api";
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";
import TodayView from "./TodayView";
import Milestones from "./Milestones";
import MilestoneDetail from "./MilestoneDetail";
import Profile from "./Profile";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Re-run whenever Firebase user changes (login, logout, or refresh)
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoggedIn(true);

        // Fetch or create the corresponding user by phone via API
        const phoneNumber = firebaseUser.phoneNumber;
        try {
          const userRecord = await authenticateUser(phoneNumber);
          setAirtableUser(userRecord);
        } catch (err) {
          console.error("Error fetching/creating user:", err);
        }
      } else {
        // No user => clear state
        setIsLoggedIn(false);
        setAirtableUser(null);
      }
      setAuthLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // If we haven't determined auth state yet, show a loader
  if (!authLoaded) {
    return <div className="m-8">Checking login status...</div>;
  }

  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

  const handleOnboardingComplete = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  const handleUserUpdate = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAirtableUser(null);
    getAuth()
      .signOut()
      .catch((err) => console.error("Failed to sign out:", err));
  };

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
              <Login />
            ) : userNeedsOnboarding ? (
              <Onboarding
                userRecord={airtableUser}
                onComplete={handleOnboardingComplete}
              />
            ) : (
              <MainContent airtableUser={airtableUser} />
            )
          }
        />

        <Route
          path="/ideas/:customIdeaId"
          element={<IdeaDetail airtableUser={airtableUser} />}
        />

        <Route
          path="/today"
          element={isLoggedIn ? <TodayView airtableUser={airtableUser} /> : <Login />}
        />

        <Route
          path="/milestones"
          element={<Milestones airtableUser={airtableUser} />}
        />

        <Route
          path="/milestones/:milestoneCustomId"
          element={<MilestoneDetail airtableUser={airtableUser} />}
        />

        <Route
          path="/profile"
          element={
            isLoggedIn ? (
              <Profile airtableUser={airtableUser} onUserUpdate={handleUserUpdate} />
            ) : (
              <Login />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
