import React, { useState, useEffect } from "react";

export default function CountdownTimer({ targetDate }) {
  const calculate = () => {
	const diff = new Date(targetDate) - new Date();
	if (diff <= 0) return null;
	return {
	  days: Math.floor(diff / (1000 * 60 * 60 * 24)),
	  hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
	  minutes: Math.floor((diff / (1000 * 60)) % 60),
	  seconds: Math.floor((diff / 1000) % 60),
	};
  };

  const [timeLeft, setTimeLeft] = useState(calculate());

  useEffect(() => {
	const timer = setInterval(() => {
	  setTimeLeft(calculate());
	}, 1000);
	return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) {
	return <p className="text-sm text-gray-500">Milestone passed</p>;
  }

  const { days, hours, minutes, seconds } = timeLeft;
  return (
	<p className="text-sm text-gray-600">
	  Due in {days}d {hours}h {minutes}m {seconds}s
	</p>
  );
}
