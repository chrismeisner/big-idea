import React, { useState, useEffect } from "react";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import { app } from "./firebase";

function Login({ onLogin }) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const auth = getAuth(app);

  useEffect(() => {
	// Set up invisible reCAPTCHA if not already
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

	if (!mobileNumber) {
	  setError("Please enter a valid phone number including country code.");
	  return;
	}

	try {
	  setSendingOtp(true);
	  const appVerifier = window.recaptchaVerifier;
	  const confirmation = await signInWithPhoneNumber(
		auth,
		mobileNumber,
		appVerifier
	  );
	  setConfirmationResult(confirmation);
	  console.log("OTP sent to", mobileNumber);
	} catch (err) {
	  console.error("Error sending OTP:", err);
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
	  await confirmationResult.confirm(otp);

	  console.log("Phone number verified!");
	  onLogin();
	} catch (err) {
	  console.error("Error verifying OTP:", err);
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
		  <label htmlFor="mobileNumber" className="block mb-1 font-medium">
			Mobile Number (with country code):
		  </label>
		  <input
			type="tel"
			id="mobileNumber"
			placeholder="+1 555 000 1234"
			value={mobileNumber}
			onChange={(e) => setMobileNumber(e.target.value)}
			className="block w-full max-w-xs border border-gray-300 rounded px-2 py-1 mb-3"
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
			type="text"
			id="otp"
			placeholder="123456"
			value={otp}
			onChange={(e) => setOtp(e.target.value)}
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
