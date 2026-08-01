import React from 'react';

interface KonjoLogoProps {
  className?: string;
  size?: number;
}

export default function KonjoLogo({ className = '', size = 48 }: KonjoLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Elite gold foil and premium metallic gradient mirroring the luxurious Kaldas brand asset */}
          <linearGradient id="kaldasGold" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A37E3E" />     {/* Deep bronze gold */}
            <stop offset="25%" stopColor="#C9A15E" />    {/* Classic luxury gold */}
            <stop offset="50%" stopColor="#F5E3B8" />    {/* Champagne highlighter glow */}
            <stop offset="75%" stopColor="#D4AF37" />    {/* Pure metallic gold */}
            <stop offset="100%" stopColor="#8A6726" />   {/* Royal burnished gold */}
          </linearGradient>
          
          <linearGradient id="circleBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAF8F5" />
            <stop offset="100%" stopColor="#F4ECE1" />
          </linearGradient>

          <filter id="premiumSoftShadow" x="-15%" y="-15%" width="130%" height="130%">
            <dropShadow dx="0" dy="4" stdDeviation="5" floodColor="#846E54" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Outer Circular opulent lace frame backing */}
        <circle cx="100" cy="100" r="92" fill="url(#circleBg)" stroke="url(#kaldasGold)" strokeWidth="1.5" filter="url(#premiumSoftShadow)" />

        {/* Ornate Luxury Filigree Petals / Royal Scrolls Outer ring */}
        {/* We build the 12 opulent symmetrical outer crown-flourishes to capture the gorgeous brand emblem */}
        <g stroke="url(#kaldasGold)" strokeWidth="2" fill="none">
          {/* Top Petal Crown */}
          <path d="M 100,8 C 96,16 104,16 100,24 C 96,16 104,16 100,8 Z" />
          <path d="M 100,8 C 105,4 110,12 100,24 C 90,12 95,4 100,8 Z" strokeWidth="1" opacity="0.8" />
          
          {/* 30 Deg */}
          <path d="M 146,20 C 140,27 147,31 141,38" />
          {/* 60 Deg */}
          <path d="M 180,54 C 173,59 178,65 171,70" />
          {/* 90 Deg Right Crown */}
          <path d="M 192,100 C 184,96 184,104 176,100 C 184,96 184,104 192,100 Z" />
          <path d="M 192,100 C 196,105 188,110 176,100 C 188,90 196,95 192,100 Z" strokeWidth="1" opacity="0.8" />
          
          {/* 120 Deg */}
          <path d="M 180,146 C 173,141 178,135 171,130" />
          {/* 150 Deg */}
          <path d="M 146,180 C 140,173 147,169 141,162" />
          {/* 180 Deg Bottom Crown */}
          <path d="M 100,192 C 96,184 104,184 100,176 C 96,184 104,184 100,192 Z" />
          <path d="M 100,192 C 105,196 110,188 100,176 C 90,188 95,196 100,192 Z" strokeWidth="1" opacity="0.8" />
          
          {/* 210 Deg */}
          <path d="M 54,180 C 60,173 53,169 59,162" />
          {/* 240 Deg */}
          <path d="M 20,146 C 27,141 22,135 29,130" />
          {/* 270 Deg Left Crown */}
          <path d="M 8,100 C 16,96 16,104 24,100 C 16,96 16,104 8,100 Z" />
          <path d="M 8,100 C 4,105 12,110 24,100 C 12,90 4,95 8,100 Z" strokeWidth="1" opacity="0.8" />
          
          {/* 300 Deg */}
          <path d="M 20,54 C 27,49 22,43 29,38" />
          {/* 330 Deg */}
          <path d="M 54,20 C 60,27 53,31 59,38" />
        </g>

        {/* Triple ornate circle concentric gold bands */}
        <circle cx="100" cy="100" r="82" stroke="url(#kaldasGold)" strokeWidth="1.5" fill="none" />
        <circle cx="100" cy="100" r="76" stroke="url(#kaldasGold)" strokeWidth="0.75" strokeDasharray="3,3" fill="none" />
        <circle cx="100" cy="100" r="70" stroke="url(#kaldasGold)" strokeWidth="1.5" fill="none" />

        {/* Elegant internal circular floral accents framing the central silhouette */}
        <path
          d="M 100,30 A 70,70 0 0,1 170,100"
          stroke="url(#kaldasGold)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          fill="none"
        />
        <path
          d="M 100,170 A 70,70 0 0,1 30,100"
          stroke="url(#kaldasGold)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          fill="none"
        />

        {/* Highly refined female face profile & hair waves in pure Gold Crown essence */}
        {/* Flowing hair wave 1 */}
        <path
          d="M 54,50 C 78,30 118,30 138,54 C 158,78 114,98 102,134 C 94,158 122,170 154,154 C 114,178 86,158 90,126 C 94,94 130,78 114,58 C 102,46 78,46 54,50 Z"
          fill="url(#kaldasGold)"
        />

        {/* Hair wave 2 (outer sweep) */}
        <path
          d="M 40,74 C 54,46 86,38 110,46 C 76,50 60,74 54,102 C 48,130 68,154 84,168 C 62,156 44,126 40,74 Z"
          fill="url(#kaldasGold)"
        />

        {/* Hair wave 3 (inner elegant contour) */}
        <path
          d="M 34,106 C 42,86 62,74 82,78 C 60,86 50,106 48,130 C 46,150 56,166 70,174 C 50,164 32,138 34,106 Z"
          fill="url(#kaldasGold)"
        />

        {/* Beautiful face profile silhouette (looking right in golden glory) */}
        <path
          d="M 122,58 C 124,62 128,66 130,70 C 132,74 136,77 138,80 C 133,82 130,83 125,83 C 129,87 133,91 137,95 C 141,99 143,102 144,106 C 138,107 134,106 130,105 C 134,110 138,114 140,118 C 141,121 140,124 135,125 C 130,126 124,126 118,124 C 113,128 109,132 108,136 C 118,133 128,137 132,142 C 136,147 134,156 128,156 C 120,156 114,145 107,139 C 100,133 94,126 96,117 C 98,108 106,90 110,78 C 114,66 118,62 122,58 Z"
          fill="url(#kaldasGold)"
        />

        {/* Elegant circle ring return curve (right side flourish) */}
        <path
          d="M 154,154 C 170,146 178,126 174,106 C 170,86 154,82 140,84"
          stroke="url(#kaldasGold)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

