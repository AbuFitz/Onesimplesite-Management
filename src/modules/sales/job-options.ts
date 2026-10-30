/** Plain-English choices for the New ticket popup. Pure data, safe to import in the browser. */
export const CATEGORIES = [
  "Trades and building", "Food and drink", "Health and beauty", "Shops and retail", "Professional services",
  "Property", "Education and kids", "Charity and community", "Events and leisure", "Something else",
] as const;
export const REACH = ["Local area", "Across the UK", "Worldwide"] as const;
export const WORK_TYPES = [
  { id: "simple", label: "A simple website", hint: "A few pages that tell people who they are and how to get in touch." },
  { id: "shop", label: "An online shop", hint: "Sell products online and take payment." },
  { id: "booking", label: "A website with bookings", hint: "Customers book appointments or tables." },
  { id: "redesign", label: "Redo their current website", hint: "They have a site that needs a fresh look." },
  { id: "onepage", label: "One page only", hint: "A single, quick page." },
  { id: "care", label: "Hosting and upkeep only", hint: "Keep an existing site running and up to date." },
  { id: "other", label: "Something else", hint: "We'll describe it in the notes." },
] as const;
export const EXTRAS = ["Contact form", "Online booking", "Take payments", "Photo gallery", "Blog or news", "Google reviews", "Map and opening hours", "Email sign-up"] as const;
export const SIZES = ["One page", "Up to 5 pages", "6 to 10 pages", "More than 10 pages"] as const;
export const DOMAINS = ["They already have a web address", "We register one for them", "Not sure yet"] as const;
export const CONTENT = ["They send us everything", "We write it for them", "A mix of both"] as const;
export const TIMING = ["As soon as possible", "Within a month", "No rush"] as const;
export const PRIORITIES = [
  { id: "low", label: "Low" }, { id: "normal", label: "Normal" }, { id: "high", label: "High" }, { id: "urgent", label: "Urgent" },
] as const;
export const SOURCES = ["Phone call", "Email", "Website form", "Referral", "Social media", "In person", "Other"] as const;
export const PAYMENT_PLANS = [
  { id: "split", label: "Half now, half when it goes live", text: "50% on signing\n50% on launch" },
  { id: "upfront", label: "All up front", text: "100% on signing" },
  { id: "monthly", label: "Spread over monthly payments", text: "Monthly payments, agreed in the notes" },
  { id: "custom", label: "Something else (say below)", text: "" },
] as const;
