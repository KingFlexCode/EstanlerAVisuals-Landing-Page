export const COLORS = {
  // Light warm theme for Work/Portfolio pages
  bg: "#FAF8F5",
  bgDark: "#0A0A0A",
  white: "#FFFFFF",
  gold: "#C8A96B",
  goldDeep: "#D4AF37",
  muted: "rgba(30,20,10,0.45)",
  mutedDark: "rgba(255,255,255,0.45)",
  border: "rgba(200,169,107,0.25)",
  borderDark: "rgba(200,169,107,0.18)",
  surface: "#F3EFE8",
  surfaceDark: "#060606",
  text: "#1A1208",
};

export const BASE = "https://kkimcezmyiqtfjdczeii.supabase.co/storage/v1/object/public/Portfolio";

// Exact folder names as they appear in Supabase Storage
export const FOLDER_CATEGORY_MAP = {
  "Birthdays/originals":    "birthday",
  "Engadgements/originals": "engagement",
  "Landscapes/originals":   "landscape",
  "Lifestyle/originals":    "lifestyle",
  "Portraits/originals":    "portrait",
  "Things/originals":       "things",
  "Weddings/originals":     "wedding",
};

export const ASPECT_MAP = {
  "Birthdays/originals":    "4/5",
  "Engadgements/originals": "3/4",
  "Landscapes/originals":   "16/9",
  "Lifestyle/originals":    "4/5",
  "Portraits/originals":    "4/5",
  "Things/originals":       "1/1",
  "Weddings/originals":     "3/4",
};

export const CATEGORY_LABELS = {
  birthday:   "Birthdays",
  engagement: "Engagements",
  landscape:  "Landscapes",
  lifestyle:  "Lifestyle",
  portrait:   "Portraits",
  things:     "Things",
  wedding:    "Weddings",
};
