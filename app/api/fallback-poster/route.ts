import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Anime";

  const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  const index = Math.abs(hash) % 4;
  const letter = title.slice(0, 1).toUpperCase();
  
  const styles = [
    { bg: '#1a0505', textColor: '#fed7aa', accentColor: '#ea580c' },
    { bg: '#020617', textColor: '#bfdbfe', accentColor: '#3b82f6' },
    { bg: '#1e1b4b', textColor: '#e9d5ff', accentColor: '#8b5cf6' },
    { bg: '#18181b', textColor: '#e4e4e7', accentColor: '#22c55e' }
  ];
  
  const style = styles[index];
  const svg = `
    <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${style.bg}"/>
      <text x="50%" y="40%" font-family="sans-serif" font-weight="900" font-size="300" fill="${style.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="24" fill="${style.textColor}" text-anchor="middle" font-weight="bold">${title}</text>
      <text x="50%" y="580" font-family="sans-serif" font-size="12" fill="${style.textColor}" opacity="0.6" text-anchor="middle">ANIME COLLECTION</text>
    </svg>
  `;
  
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
