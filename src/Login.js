// File: /src/Login.js
import React, { useState, useEffect } from "react";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { app } from "./firebase";  // same as before
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

function Login() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const auth = getAuth(app);

  useEffect(() => {
	if (!window.recaptchaVerifier) {
	  window.recaptchaVerifier = new RecaptchaVerifier(
		"recaptcha-container",
		{ size: "invisible" },
		auth
	  );
	}
  }, [auth]);

  const handleSendOtp = async (e) => {
	e.preventDefault();
	setError(null);

	const normalizedNumber = `+${mobileNumber}`;
	if (!normalizedNumber.startsWith("+1")) {
	  setError("Please enter a valid US/CA phone number.");
	  return;
	}

	try {
	  setSendingOtp(true);
	  const appVerifier = window.recaptchaVerifier;
	  const confirmation = await signInWithPhoneNumber(
		auth,
		normalizedNumber,
		appVerifier
	  );
	  setConfirmationResult(confirmation);
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
	  setError("Please enter the OTP.");
	  return;
	}

	try {
	  setVerifying(true);
	  // Once this succeeds, Firebase considers the user "logged in"
	  const result = await confirmationResult.confirm(otp);
	  // --> The "onAuthStateChanged" in App.js will now fire.
	} catch (err) {
	  console.error("[Login] Error verifying OTP:", err);
	  setError("Invalid OTP. Please try again.");
	} finally {
	  setVerifying(false);
	}
  };

  return (
	<div className="m-8 text-center">
	  <h2 className="text-2xl font-bold">Login with Phone</h2>
	  {error && <p className="text-red-500">{error}</p>}

	  {/* Step 1: Send OTP */}
	  {!confirmationResult && (
		<form onSubmit={handleSendOtp} className="inline-block text-left mt-4">
		  <label className="block mb-1 font-medium">
			Mobile Number (US/CA):
		  </label>
		  <PhoneInput
			country={"us"}
			onlyCountries={["us", "ca"]}
			placeholder="(555) 000-1234"
			value={mobileNumber}
			onChange={(val) => setMobileNumber(val)}
			inputProps={{ required: true }}
			containerStyle={{ marginBottom: "1rem" }}
		  />
		  <button
			type="submit"
			disabled={sendingOtp}
			className="py-1 px-3 bg-blue-600 text-white rounded hover:bg-blue-700"
		  >
			{sendingOtp ? "Sending..." : "Send OTP"}
		  </button>
		</form>
	  )}

	  {/* Step 2: Verify OTP */}
	  {confirmationResult && (
		<form onSubmit={handleVerifyOtp} className="inline-block text-left mt-4">
		  <label className="block mb-1 font-medium">Enter OTP:</label>
		  <input
			type="tel"
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
			className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700"
		  >
			{verifying ? "Verifying..." : "Verify OTP"}
		  </button>
		</form>
	  )}

	  {/* The invisible Recaptcha */}
	  <div id="recaptcha-container"></div>
	</div>
  );
}

export default Login;
