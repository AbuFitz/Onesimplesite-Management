/** Plain data so the browser can use it too. */
export const KINDS = [
  { id: "business", label: "Limited company", hint: "A registered company (Ltd, LLP, PLC)" },
  { id: "sole_trader", label: "Sole trader", hint: "Self-employed, trading as themselves" },
  { id: "individual", label: "Individual", hint: "A person, not a company" },
] as const;
