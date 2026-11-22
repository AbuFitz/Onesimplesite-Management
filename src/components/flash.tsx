/** The one-line confirmation or error after something was saved. */
export function Flash({ done, error }: { done?: string; error?: string }) {
  return <>{done && <p role="status" className="mb-3 rounded-xl bg-[#dff5ea] px-3 py-2 text-sm font-semibold text-[#0a5a3d]">{done}</p>}{error && <p role="alert" className="mb-3 rounded-xl bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#a12a1f]">{error}</p>}</>;
}
