const presentations = {
  "1st-semester-feee": { key: "electrical", label: "ELECTRICAL ENGINEERING", description: "Circuits, electronics, and the fundamentals of electrical systems." },
  "applied-physics-b": { key: "physics", label: "APPLIED PHYSICS", description: "Explore motion, energy, waves, and physical principles." },
  "basic-engineering-mathematics": { key: "mathematics", label: "MATHEMATICS", description: "Build confidence with vectors, functions, limits, and more." },
  "1st-semester-icttool": { key: "ict", label: "DIGITAL SKILLS", description: "Get comfortable with computers, software, and ICT tools." },
  "1st-semester-ic": { key: "constitution", label: "CIVICS", description: "Understand the Constitution, rights, and public institutions." },
  "1st-semester-itai": { key: "ai", label: "ARTIFICIAL INTELLIGENCE", description: "Learn the ideas and systems behind intelligent technology." },
  "book": { key: "books", label: "REFERENCE LIBRARY", description: "Find textbooks and references for your subjects." },
  "all-unit-combo-notes": { key: "notes", label: "STUDY NOTES", description: "Revise key concepts with notes collected across units." },
};

export function getCoursePresentation(course) {
  const slug = String(course.slug || "").trim().toLowerCase();
  if (presentations[slug]) return presentations[slug];
  const title = String(course.title || "").toLowerCase();
  if (/feee|electric|electronic/.test(title)) return presentations["1st-semester-feee"];
  if (/physics/.test(title)) return presentations["applied-physics-b"];
  if (/math/.test(title)) return presentations["basic-engineering-mathematics"];
  if (/ict|computer|digital/.test(title)) return presentations["1st-semester-icttool"];
  if (/constitution|civics/.test(title)) return presentations["1st-semester-ic"];
  if (/artificial intelligence|\bai\b/.test(title)) return presentations["1st-semester-itai"];
  if (/books?|textbooks?/.test(title)) return presentations.book;
  if (/notes?|study material/.test(title)) return presentations["all-unit-combo-notes"];
  return { key: "general", label: "STUDY MATERIAL", description: "Lectures, notes, and practice resources for this course." };
}

const common = { fill: "none", stroke: "currentColor", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" };

export default function CourseArtwork({ type }) {
  return <svg className="course-artwork" viewBox="0 0 200 150" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    {type === "electrical" && <g {...common}>
      <path d="M18 85h23m0 0V49h51v36h21m49 0h20M113 85V49h49v36" />
      <path d="M47 64v42m10-34v27m24-35v21m-8-13h16" strokeWidth="3" />
      <circle cx="137" cy="85" r="24" fill="currentColor" fillOpacity=".13" />
      <path d="m142 64-13 24h11l-7 19 18-28h-12z" fill="currentColor" stroke="none" />
      <circle cx="41" cy="85" r="5" fill="currentColor" stroke="none" /><circle cx="162" cy="85" r="5" fill="currentColor" stroke="none" />
    </g>}
    {type === "physics" && <g {...common}>
      <ellipse cx="102" cy="76" rx="69" ry="27" transform="rotate(-28 102 76)" strokeWidth="3" />
      <ellipse cx="102" cy="76" rx="69" ry="27" transform="rotate(31 102 76)" strokeWidth="3" />
      <ellipse cx="102" cy="76" rx="69" ry="27" transform="rotate(90 102 76)" strokeWidth="3" />
      <circle cx="102" cy="76" r="15" fill="currentColor" fillOpacity=".8" stroke="none" />
      <circle cx="163" cy="62" r="6" fill="currentColor" stroke="none" /><circle cx="68" cy="26" r="5" fill="currentColor" stroke="none" /><circle cx="115" cy="137" r="5" fill="currentColor" stroke="none" />
    </g>}
    {type === "mathematics" && <g {...common}>
      <path d="M29 20v107h148M18 110l11 17 13-17M161 116l16 11-16 11" strokeWidth="3" />
      <path d="M39 109c29-3 35-68 65-68s30 50 67-18" strokeWidth="5" />
      <circle cx="104" cy="41" r="7" fill="currentColor" stroke="none" />
      <path d="M50 48h18m-9-9v18M131 104h20" strokeWidth="3" />
    </g>}
    {type === "ict" && <g {...common}>
      <rect x="30" y="28" width="140" height="91" rx="10" fill="currentColor" fillOpacity=".12" />
      <path d="M20 120h160l-12 13H32z" fill="currentColor" fillOpacity=".28" />
      <path d="m78 60-17 17 17 17m44-34 17 17-17 17m-15-41-14 50" strokeWidth="5" />
      <circle cx="47" cy="42" r="3" fill="currentColor" stroke="none" />
    </g>}
    {type === "constitution" && <g {...common}>
      <path d="m22 55 78-33 78 33v10H22zM24 121h152v12H24zM30 108h140v13H30z" fill="currentColor" fillOpacity=".18" />
      <path d="M36 65v43m18-43v43m20-43v43m18-43v43m16-43v43m18-43v43m20-43v43m18-43v43" strokeWidth="5" />
      <circle cx="100" cy="46" r="6" fill="currentColor" stroke="none" />
    </g>}
    {type === "ai" && <g {...common}>
      <path d="M43 38 97 22l57 28 14 49-49 34-67-13-23-47zM43 38l45 38 9-54m-9 54 66-26m-66 26 31 57m0 0 49-34m-80-23-36 44m36-44 80 23" strokeWidth="2.5" />
      {[[43,38],[97,22],[154,50],[168,99],[119,133],[52,120],[29,73],[88,76]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="currentColor" stroke="none" />)}
      <circle cx="88" cy="76" r="15" fill="currentColor" fillOpacity=".18" stroke="none" />
    </g>}
    {type === "books" && <g {...common}>
      <path d="M29 31h115a14 14 0 0 1 0 28H29zM44 63h113a14 14 0 0 1 0 28H44zM28 95h119a14 14 0 0 1 0 28H28z" fill="currentColor" fillOpacity=".13" />
      <path d="M48 32v27m94 5v27M48 96v27M47 45h93m-78 32h77m-91 32h94" strokeWidth="2.5" />
      <path d="M61 32v25m9-25v25" strokeWidth="3" />
    </g>}
    {type === "notes" && <g {...common}>
      <path d="M43 17h87l27 26v88H43z" fill="currentColor" fillOpacity=".12" />
      <path d="M130 17v26h27M63 59h74M63 76h74M63 93h53M63 110h67" strokeWidth="3" />
      <path d="m126 105 10 10 22-25" strokeWidth="5" />
    </g>}
    {type === "general" && <g {...common}>
      <path d="M28 34h60c8 0 13 3 13 10v83c-3-7-9-10-17-10H28zM172 34h-60c-8 0-13 3-13 10v83c3-7 9-10 17-10h56z" fill="currentColor" fillOpacity=".12" />
      <path d="M44 56h36M44 72h36m40-16h36m-36 16h36" strokeWidth="3" />
    </g>}
  </svg>;
}
