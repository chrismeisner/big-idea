// File: /src/App.js

import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import airtableBase from "./airtable";  // so we can fetch user from Airtable
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";
import IdeaDetail from "./IdeaDetail";
import TodayView from "./TodayView";
import Milestones from "./Milestones";
import MilestoneDetail from "./MilestoneDetail";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // 1) Re-run whenever Firebase user changes (login, logout, or refresh)
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsLoggedIn(true);

        // Now fetch or create the corresponding Airtable user by phone
        const phoneNumber = firebaseUser.phoneNumber;
        try {
          const userRecord = await createOrGetAirtableUser(phoneNumber);
          setAirtableUser(userRecord);
        } catch (err) {
          console.error("Error fetching/creating Airtable user:", err);
          // Optionally sign them out if we can’t get an Airtable user
          // await auth.signOut();
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

  // The same function you used to have in Login.js:
  async function createOrGetAirtableUser(phoneNumber) {
    // Query your "Users" table for a record where {Mobile} = phoneNumber
    const records = await airtableBase("Users")
      .select({
        filterByFormula: `{Mobile} = "${phoneNumber}"`,
        maxRecords: 1,
      })
      .all();

    if (records.length > 0) {
      return records[0];
    } else {
      const created = await airtableBase("Users").create([
        {
          fields: { Mobile: phoneNumber },
        },
      ]);
      return created[0];
    }
  }

  // 2) If we haven’t determined auth state yet, show a loader
  if (!authLoaded) {
    return <div className="m-8">Checking login status...</div>;
  }

  // 3) The rest is basically your same existing router logic
  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

  // “handleOnboardingComplete” if you want to update the user record
  const handleOnboardingComplete = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAirtableUser(null);
    getAuth().signOut().catch((err) => console.error("Failed to sign out:", err));
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

        {/* Updated route passing `airtableUser` down to IdeaDetail */}
        <Route
          path="/ideas/:customIdeaId"
          element={<IdeaDetail airtableUser={airtableUser} />}
        />

        <Route
          path="/today"
          element={isLoggedIn ? <TodayView airtableUser={airtableUser} /> : <Login />}
        />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/milestones/:milestoneCustomId" element={<MilestoneDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
