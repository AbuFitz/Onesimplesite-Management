/** What shows for the instant while a page loads: the shape of the page, softly pulsing, so a tap always feels answered. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skel" role="status" aria-label="Loading">
      <div className="skel-h" /><div className="skel-sub" />
      <div className="skel-tiles"><i /><i /><i /><i /></div>
      {Array.from({ length: rows }, (_, n) => <div key={n} className="skel-card" style={{ animationDelay: `${n * 90}ms` }}><b /><span /><span /></div>)}
    </div>
  );
}
