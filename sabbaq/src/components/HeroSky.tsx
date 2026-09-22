/**
 * سماء الواجهة: شمس تدور أشعّتها ببطء وغيوم تنجرف.
 *
 * زخرفة خالصة بـ SVG و CSS — لا صور تُحمَّل ولا مكتبة. مخفيّة عن قارئات
 * الشاشة، وتتوقّف حركتها لمن طلب تقليل الحركة (globals.css).
 */
export default function HeroSky() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg
        viewBox="0 0 120 120"
        width="132"
        height="132"
        className="hero-sun"
        style={{ position: "absolute", top: 18, insetInlineEnd: "5%" }}
      >
        <g style={{ transformOrigin: "60px 60px", animation: "spin 36s linear infinite" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x="56"
              y="4"
              width="8"
              height="20"
              rx="4"
              fill="var(--sun)"
              stroke="var(--outline)"
              strokeWidth="2.5"
              transform={`rotate(${i * 30} 60 60)`}
            />
          ))}
        </g>
        <circle cx="60" cy="60" r="30" fill="var(--sun)" stroke="var(--outline)" strokeWidth="3" />
        <circle cx="50" cy="56" r="3.4" fill="var(--outline)" />
        <circle cx="70" cy="56" r="3.4" fill="var(--outline)" />
        <path d="M49 67c6 6 16 6 22 0" stroke="var(--outline)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="65" r="4" fill="var(--berry)" opacity="0.55" />
        <circle cx="76" cy="65" r="4" fill="var(--berry)" opacity="0.55" />
      </svg>

      {[
        { top: 40, start: "8%", scale: 1, drift: "46px", dur: "13s" },
        { top: 118, start: "26%", scale: 0.7, drift: "-36px", dur: "17s" },
        { top: 70, start: "70%", scale: 0.85, drift: "30px", dur: "15s" },
      ].map((c, i) => (
        <svg
          key={i}
          className="hero-cloud"
          viewBox="0 0 120 60"
          width={120 * c.scale}
          height={60 * c.scale}
          style={
            {
              position: "absolute",
              top: c.top,
              insetInlineStart: c.start,
              "--drift": c.drift,
              animation: `drift ${c.dur} ease-in-out infinite alternate`,
            } as React.CSSProperties
          }
        >
          <path
            d="M22 50c-10 0-16-7-16-14s6-13 14-13c2-10 11-17 22-17 10 0 18 6 21 14 3-2 7-3 10-3 11 0 19 8 19 18 8 1 14 7 14 14 0 1 0 1 0 1z"
            fill="#fff"
            stroke="var(--outline)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}
