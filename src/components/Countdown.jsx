// File: src/components/Countdown.jsx

import React, { useState, useEffect } from "react";

export default function Countdown({ targetDate }) {
  const calc = () => {
	const diff = +new Date(targetDate) - +new Date();
	if (diff <= 0) return null;
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((diff / (1000 * 60)) % 60);
	const seconds = Math.floor((diff / 1000) % 60);
	return { days, hours, minutes, seconds };
  };

  const [timeLeft, setTimeLeft] = useState(calc());

  useEffect(() => {
	const iv = setInterval(() => {
	  setTimeLeft(calc());
	}, 1000);
	return () => clearInterval(iv);
  }, [targetDate]);

  if (!timeLeft) return <span>🎉</span>;

  return (
	<span className="text-sm font-mono">
	  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
	</span>
  );
}
