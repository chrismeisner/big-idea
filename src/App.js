// File: /Users/chrismeisner/Projects/big-idea/src/App.js

import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";
import Onboarding from "./Onboarding";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);

  // We'll use a helper check to see if Name is present
  const userNeedsOnboarding = airtableUser && !airtableUser.fields?.Name;

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
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (userRecord) => {
    console.log("handleLogin in App.js called with Airtable user:", userRecord);
    setIsLoggedIn(true);
    setAirtableUser(userRecord);
  };

  // Once Onboarding is done, we save the updated record and continue.
  const handleOnboardingComplete = (updatedRecord) => {
    setAirtableUser(updatedRecord);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAirtableUser(null);
  };

  return (
    <div>
      <Header
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        airtableUser={airtableUser}
      />

      {!isLoggedIn ? (
        // Step 1: Not logged in => show phone login
        <Login onLogin={handleLogin} />
      ) : userNeedsOnboarding ? (
        // Step 2: If logged in but no Name => show onboarding
        <Onboarding userRecord={airtableUser} onComplete={handleOnboardingComplete} />
      ) : (
        // Step 3: If logged in and Name is present => Main content
        <MainContent />
      )}
    </div>
  );
}

export default App;
