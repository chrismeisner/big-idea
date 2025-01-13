import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true); // User is logged in
      } else {
        setIsLoggedIn(false); // No user is logged in
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <Header isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />
      {!isLoggedIn ? (
        <Login onLogin={() => setIsLoggedIn(true)} />
      ) : (
        <MainContent />
      )}
    </div>
  );
}

export default App;
