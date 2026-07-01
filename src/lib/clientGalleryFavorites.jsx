import { supabase } from "./supabase";

export const FAVORITES_TABLE = "client_gallery_favorites";
export const VISITOR_KEY = "client-gallery-visitor-id";

export function createGalleryVisitorId() {
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getGalleryVisitorId() {
  if (typeof window === "undefined") return "server-visitor";
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = createGalleryVisitorId();
  window.localStorage.setItem(VISITOR_KEY, next);
  return next;
}

export function emptyFavoriteSet() {
  return new Set();
}

export { supabase };
