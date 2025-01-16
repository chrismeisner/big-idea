// File: /src/Login.js

import React, { useState, useEffect } from "react";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { app } from "./firebase";
import airtableBase from "./airtable";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

function Login({ onLogin }) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const auth = getAuth(app);

  useEffect(() => {
	if (!window.recaptchaVerifier) {
	  console.log("Initializing reCAPTCHA...");
	  window.recaptchaVerifier = new RecaptchaVerifier(
		"recaptcha-container",
		{ size: "invisible" },
		auth
	  );
	  console.log("reCAPTCHA initialized");
	}
  }, [auth]);

  const handleSendOtp = async (e) => {
	e.preventDefault();
	setError(null);

	const normalizedNumber = `+${mobileNumber}`;
	console.log("[Login] handleSendOtp => normalizedNumber:", normalizedNumber);

	if (!normalizedNumber.startsWith("+1")) {
	  setError("Please enter a valid phone number (US/CA).");
	  return;
	}

	try {
	  setSendingOtp(true);
	  console.log("[Login] Sending OTP to:", normalizedNumber);

	  const appVerifier = window.recaptchaVerifier;
	  const confirmation = await signInWithPhoneNumber(
		auth,
		normalizedNumber,
		appVerifier
	  );
	  setConfirmationResult(confirmation);

	  console.log("[Login] OTP sent successfully to:", normalizedNumber);
	} catch (err) {
	  console.error("[Login] Error sending OTP:", err);
	  setError(err.message || "Failed to send OTP");
	} finally {
	  setSendingOtp(false);
	}
  };

  const handleVerifyOtp = async (e) => {
	e.preventDefault();
	setError(null);

	if (!otp) {
	  setError("Please enter the OTP sent to your phone.");
	  return;
	}

	try {
	  setVerifying(true);
	  console.log("[Login] Verifying OTP...");

	  const result = await confirmationResult.confirm(otp);
	  console.log("[Login] Phone number verified!");

	  const phoneNumber = result.user.phoneNumber;
	  console.log("[Login] Verified phone number is:", phoneNumber);

	  // Look up or create an Airtable user record
	  const userRecord = await createOrGetAirtableUser(phoneNumber);
	  console.log("[Login] Airtable user record:", userRecord.fields);

	  // Pass the userRecord back up to App.js
	  onLogin(userRecord);
	} catch (err) {
	  console.error("[Login] Error verifying OTP:", err);
	  setError("Invalid OTP. Please try again.");
	} finally {
	  setVerifying(false);
	}
  };

  const createOrGetAirtableUser = async (phoneNumber) => {
	console.log("[Login] createOrGetAirtableUser => phoneNumber:", phoneNumber);

	try {
	  // Check if there's an existing user with that Mobile number
	  const records = await airtableBase("Users")
		.select({
		  filterByFormula: `{Mobile} = "${phoneNumber}"`,
		  maxRecords: 1,
		})
		.all();

	  if (records.length > 0) {
		// Found an existing user
		console.log("[Login] Found existing user with phone:", phoneNumber);
		return records[0];
	  } else {
		// Create a new user record in Airtable
		console.log("[Login] Creating new user for phone:", phoneNumber);
		const created = await airtableBase("Users").create([
		  {
			fields: {
			  Mobile: phoneNumber,
			},
		  },
		]);
		console.log("[Login] New user created =>", created[0].fields);
		return created[0];
	  }
	} catch (error) {
	  console.error("[Login] Error creating/fetching user in Airtable:", error);
	  throw error;
	}
  };

  return (
	<div className="m-8 text-center">
	  <h2 className="text-2xl font-bold">Login with Phone</h2>

	  {error && <p className="text-red-500">{error}</p>}

	  {/* Step 1: Send OTP */}
	  {!confirmationResult && (
		<form onSubmit={handleSendOtp} className="inline-block text-left mt-4">
		  <label htmlFor="mobileNumber" className="block mb-1 font-medium">
			Mobile Number (US/CA):
		  </label>
		  <PhoneInput
			country={"us"}
			onlyCountries={["us", "ca"]}
			placeholder="(555) 000-1234"
			value={mobileNumber}
			onChange={(val) => setMobileNumber(val)}
			inputProps={{
			  name: "mobileNumber",
			  required: true,
			}}
			containerStyle={{ marginBottom: "1rem" }}
		  />
		  <button
			type="submit"
			disabled={sendingOtp}
			className="py-1 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
		  >
			{sendingOtp ? "Sending..." : "Send OTP"}
		  </button>
		</form>
	  )}

	  {/* Step 2: Verify OTP */}
	  {confirmationResult && (
		<form onSubmit={handleVerifyOtp} className="inline-block text-left mt-4">
		  <label htmlFor="otp" className="block mb-1 font-medium">
			Enter OTP:
		  </label>
		  <input
			type="tel"
			id="otp"
			placeholder="123456"
			value={otp}
			onChange={(e) => {
			  const cleaned = e.target.value.replace(/\D/g, "");
			  setOtp(cleaned.slice(0, 6));
			}}
			pattern="[0-9]*"
			inputMode="numeric"
			maxLength={6}
			className="block w-full max-w-xs border border-gray-300 rounded px-2 py-1 mb-3"
		  />
		  <button
			type="submit"
			disabled={verifying}
			className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
		  >
			{verifying ? "Verifying..." : "Verify OTP"}
		  </button>
		</form>
	  )}

	  {/* Invisible reCAPTCHA container */}
	  <div id="recaptcha-container"></div>
	</div>
  );
}

export default Login;
