import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

// WhatsApp Official Logo
export const WhatsAppLogo: React.FC<LogoProps> = ({ className = '', size = 32 }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-xl overflow-hidden shadow-xs flex items-center justify-center bg-gradient-to-br from-[#25D366] to-[#128C7E] select-none shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[78%] h-[78%]"
      >
        <path
          d="M50 8C26.8 8 8 26.8 8 50C8 57.9 10.2 65.4 14.2 71.9L9 91L28.7 85.9C35 89.5 42.3 91.5 50 91.5C73.2 91.5 92 72.7 92 49.5C92 26.3 73.2 8 50 8Z"
          fill="url(#wa-grad)"
        />
        <path
          d="M75.8 62.4C74.6 61.8 69.1 59.1 68.1 58.7C67.1 58.3 66.3 58.1 65.6 59.2C64.9 60.3 62.7 62.9 62 63.7C61.4 64.5 60.7 64.6 59.5 64C58.3 63.4 54.4 62.1 49.8 58C46.2 54.8 43.8 50.8 43.1 49.6C42.4 48.4 43 47.7 43.6 47.1C44.2 46.5 44.9 45.6 45.5 44.8C46.1 44.1 46.3 43.5 46.7 42.7C47.1 41.9 46.9 41.2 46.6 40.6C46.3 40 44.1 34.6 43.2 32.4C42.3 30.2 41.4 30.5 40.7 30.5C40.1 30.5 39.4 30.5 38.6 30.5C37.8 30.5 36.6 30.8 35.6 31.9C34.6 33 31.7 35.7 31.7 41.2C31.7 46.7 35.7 51.9 36.3 52.7C36.9 53.5 44.2 64.7 55.4 69.5C58 70.7 60.1 71.4 61.7 71.9C64.4 72.8 66.8 72.6 68.7 72.3C70.9 72 75.3 69.6 76.2 67C77.1 64.4 77.1 62.2 76.8 61.8C76.6 61.2 77 62.9 75.8 62.4Z"
          fill="white"
        />
        <defs>
          <linearGradient id="wa-grad" x1="8" y1="8" x2="92" y2="92" gradientUnits="userSpaceOnUse">
            <stop stopColor="#29E072" />
            <stop offset="1" stopColor="#1EBE5D" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
