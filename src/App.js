// File: /Users/chrismeisner/Projects/big-idea/src/App.js

import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Header from "./Header";
import Login from "./Login";
import MainContent from "./MainContent";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User just signed in (or is still signed in).
        await handleUserRecord(user); // Check or create user record in Airtable.
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // -------------------------------------
  //   CREATE or FIND USER IN AIRTABLE
  // -------------------------------------
  const handleUserRecord = async (user) => {
    try {
      const baseId = process.env.REACT_APP_AIRTABLE_BASE_ID;
      const apiKey = process.env.REACT_APP_AIRTABLE_API_KEY;
      if (!baseId || !apiKey) {
        console.error("Missing Airtable credentials.");
        return;
      }

      // Figure out how they signed in: phoneNumber, or email for Google/Apple.
      const phoneNumber = user.phoneNumber; // null if not phone
      const email = user.email; // null if phone-only sign-in, otherwise might be google or apple
      const providerIds = user.providerData.map((p) => p.providerId); 
      // e.g. ['google.com'], ['apple.com'], ['phone'], etc.

      // Build a filterByFormula for Airtable. 
      // We'll check the relevant field based on the sign-in method.
      let filterFormula = "";
      if (phoneNumber) {
        // Phone sign-in
        filterFormula = `({Mobile} = '${phoneNumber}')`;
      } else if (providerIds.includes("google.com") && email) {
        // Google sign-in
        filterFormula = `({Google} = '${email}')`;
      } else if (providerIds.includes("apple.com") && email) {
        // Apple sign-in
        filterFormula = `({Apple} = '${email}')`;
      } else {
        // If for some reason we don't have phone or email, just return or handle differently
        return;
      }

      // 1) Check if there's already a record
      const checkUrl = `https://api.airtable.com/v0/${baseId}/Users?filterByFormula=${encodeURIComponent(
        filterFormula
      )}`;
      const checkResponse = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const checkData = await checkResponse.json();
      if (!checkResponse.ok) {
        throw new Error(`Airtable error: ${checkResponse.status} ${checkResponse.statusText}`);
      }

      // If no record found, create a new one
      if (checkData.records.length === 0) {
        // Prepare the fields object for a new user
        const fields = {};
        if (phoneNumber) fields.Mobile = phoneNumber;
        if (providerIds.includes("google.com") && email) {
          fields.Google = email;
        }
        if (providerIds.includes("apple.com") && email) {
          fields.Apple = email;
        }
        // Optionally store displayName, creation time, etc.
        fields.CreatedAt = new Date().toISOString();
        if (user.displayName) {
          fields.Name = user.displayName;
        }

        // 2) Create the new user record in Airtable
        const createResponse = await fetch(
          `https://api.airtable.com/v0/${baseId}/Users`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              records: [{ fields }],
            }),
          }
        );

        if (!createResponse.ok) {
          throw new Error(
            `Error creating user: ${createResponse.status} ${createResponse.statusText}`
          );
        }

        const createData = await createResponse.json();
        console.log("New user created in Airtable:", createData.records[0]);
      } else {
        console.log("Existing user found in Airtable:", checkData.records[0]);
      }
    } catch (error) {
      console.error("Error checking/creating user in Airtable:", error);
    }
  };

  return (
    <div>
      <Header isLoggedIn={isLoggedIn} onLogout={() => setIsLoggedIn(false)} />
      {!isLoggedIn ? <Login onLogin={() => setIsLoggedIn(true)} /> : <MainContent />}
    </div>
  );
}

export default App;
