/** Original vector geometry: scalable live decoration, never reference artwork. */
export function DecoFan({ className = "" }: { className?: string }) {
  return <svg className={`deco-fan ${className}`} viewBox="0 0 200 130" fill="none" aria-hidden="true">
    <path d="m100 114-7 7 7 7 7-7-7-7Z" stroke="currentColor" />
    {Array.from({ length: 17 }, (_, index) => {
      const angle = (index * 10 + 10) * Math.PI / 180;
      const x = 100 + Math.cos(angle) * 89;
      const y = 105 - Math.sin(angle) * 89;
      return <path key={index} d={`M100 108 100 105 ${x.toFixed(2)} ${y.toFixed(2)}`} stroke="currentColor" strokeWidth={index % 4 === 0 ? .85 : .5} />;
    })}
    <path d="M12 92a89 89 0 0 1 176 0M22 95a79 79 0 0 1 156 0" stroke="currentColor" strokeWidth=".5" />
  </svg>;
}

export function DecoFrame() {
  return <div className="deco-frame" aria-hidden="true">{["tl", "tr", "bl", "br"].map((corner) => <svg key={corner} className={`deco-corner deco-corner-${corner}`} viewBox="0 0 100 100" fill="none">
    <path d="M1 85V1h84M8 68V8h60M15 51V15h36M1 70A69 69 0 0 0 70 1" stroke="currentColor" strokeWidth=".7" />
    {[15, 30, 45, 60, 75].map((angle) => <path key={angle} d={`M1 1 ${1 + Math.cos(angle * Math.PI / 180) * 69} ${1 + Math.sin(angle * Math.PI / 180) * 69}`} stroke="currentColor" strokeWidth=".5" />)}
    <path d="m1 1 7 3-4 4-3-7Z" fill="currentColor" />
  </svg>)}</div>;
}

export function StorySprig() {
  return <svg className="reference-sprig" viewBox="0 0 100 36" fill="none" aria-hidden="true"><path d="M7 28C28 26 52 17 91 7M28 23c-7-9-5-16 2-14 7 2 4 10-2 14Zm15-6c-4-10-1-16 5-12s3 10-5 12Zm10-2c6 4 13 9 15 3s-5-8-15-3Zm-22 7c5 4 10 9 14 5s-2-9-14-5Z" stroke="currentColor" strokeWidth=".8" /></svg>;
}
