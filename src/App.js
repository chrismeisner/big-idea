// File: /Users/chrismeisner/Projects/big-idea/src/App.js

import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [airtableUser, setAirtableUser] = useState(null);

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

  return (
    <div>
      <Header
        isLoggedIn={isLoggedIn}
        onLogout={() => setIsLoggedIn(false)}
        airtableUser={airtableUser}
      />
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <MainContent />
      )}
    </div>
  );
}

export default App;
