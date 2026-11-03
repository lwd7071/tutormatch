export function Star({ size = 64, mood = "smile", className = "" }: { size?: number; mood?: "smile" | "wink" | "sleep"; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none" role="img" aria-label="Linh vật ngôi sao TutorMatch">
    <path d="M50 5c4 0 8 16 12 23 4 6 21 4 25 10 4 6-11 16-13 23-2 7 7 22 2 27-5 5-19-5-26-5s-21 10-26 5c-5-5 4-20 2-27C24 54 9 44 13 38c4-6 21-4 25-10C42 21 46 5 50 5Z" fill="#FFC857" stroke="#332653" strokeWidth="3" strokeLinejoin="round"/>
    {mood === "wink" ? <path d="M35 47h9" stroke="#332653" strokeWidth="3" strokeLinecap="round"/> : <path d="M36 47c0-2 2-3 3-3s3 1 3 3" stroke="#332653" strokeWidth="3" strokeLinecap="round"/>}
    {mood === "sleep" ? <path d="M57 47h9" stroke="#332653" strokeWidth="3" strokeLinecap="round"/> : <path d="M58 47c0-2 2-3 3-3s3 1 3 3" stroke="#332653" strokeWidth="3" strokeLinecap="round"/>}
    <path d="M43 59c4 6 11 6 15 0" stroke="#332653" strokeWidth="3" strokeLinecap="round"/>
    <ellipse cx="29" cy="55" rx="6" ry="3" fill="#FF8D94" opacity=".8"/><ellipse cx="71" cy="55" rx="6" ry="3" fill="#FF8D94" opacity=".8"/>
  </svg>;
}
