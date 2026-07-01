import { zipSync } from "fflate";
import { supabase } from "./supabase";

export const FAVORITES_TABLE = "client_gallery_favorites";
export const VISITOR_KEY = "client-gallery-visitor-id";
export const FAVORITES_STORAGE_PREFIX = "client-gallery-favorites:";
const CLIENT_GALLERY_BUCKET = "client-galleries";

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

export async function loadGalleryFavorites(galleryId, visitorId = getGalleryVisitorId()) {
  if (!galleryId || !visitorId) return new Set();
  const { data, error } = await supabase
    .from(FAVORITES_TABLE)
    .select("image_id")
    .eq("gallery_id", galleryId)
    .eq("visitor_id", visitorId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.image_id));
}

export async function saveGalleryFavorite(galleryId, imageId, visitorId = getGalleryVisitorId()) {
  if (!galleryId || !imageId || !visitorId) return;
  const { error } = await supabase
    .from(FAVORITES_TABLE)
    .upsert(
      { gallery_id: galleryId, image_id: imageId, visitor_id: visitorId },
      { onConflict: "gallery_id,image_id,visitor_id" },
    );
  if (error) throw error;
}

export async function removeGalleryFavorite(galleryId, imageId, visitorId = getGalleryVisitorId()) {
  if (!galleryId || !imageId || !visitorId) return;
  const query = supabase.from(FAVORITES_TABLE);
  const { error } = await query["delete"]()
    .eq("gallery_id", galleryId)
    .eq("image_id", imageId)
    .eq("visitor_id", visitorId);
  if (error) throw error;
}

export async function loadGalleryFavoriteSummary(galleryId) {
  if (!galleryId) return [];
  const { data, error } = await supabase
    .from("client_gallery_favorite_summary")
    .select("image_id,favorite_count,last_favorited_at")
    .eq("gallery_id", galleryId);
  if (error) throw error;
  return data || [];
}

function parseFavoriteIds(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function syncFavoriteIds(galleryId, previousIds, nextIds) {
  const visitorId = getGalleryVisitorId();
  const previous = new Set(previousIds);
  const next = new Set(nextIds);
  await Promise.all([...next].map((imageId) => saveGalleryFavorite(galleryId, imageId, visitorId)));
  await Promise.all([...previous].filter((imageId) => !next.has(imageId)).map((imageId) => removeGalleryFavorite(galleryId, imageId, visitorId)));
}

function adminGalleryId() {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/admin\/galleries\/([^/]+)/);
  return match?.[1] || "";
}

function galleryPublicUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(CLIENT_GALLERY_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function selectedImagePath(image) {
  return image?.original_path || image?.display_path || image?.thumbnail_path || "";
}

function safeFileName(value = "gallery-photo") {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "gallery-photo";
}

function saveBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function saveSelectedImage(row) {
  const image = row.image;
  const url = galleryPublicUrl(selectedImagePath(image));
  if (!url) throw new Error("Selected image is missing a file path.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Selected image could not be prepared.");
  const blob = await response.blob();
  saveBlob(blob, safeFileName(image.file_name || image.title || image.id));
}

async function saveSelectedZip(rows, button) {
  if (!rows.length) {
    button.textContent = "No Favorites";
    window.setTimeout(() => { button.textContent = "Download Favorites ZIP"; }, 1600);
    return;
  }

  const originalLabel = button.textContent;
  const files = {};
  button.disabled = true;

  try {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const image = row.image;
      const url = galleryPublicUrl(selectedImagePath(image));
      if (!url) continue;
      button.textContent = `Preparing ${index + 1}/${rows.length}`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const fileName = safeFileName(image.file_name || image.title || `selected-photo-${index + 1}.jpg`);
      files[`${String(index + 1).padStart(3, "0")}-${fileName}`] = new Uint8Array(buffer);
    }

    if (!Object.keys(files).length) throw new Error("No selected files could be prepared.");
    button.textContent = "Packaging ZIP";
    const zipBytes = zipSync(files, { level: 0 });
    saveBlob(new Blob([zipBytes], { type: "application/zip" }), `client-favorites-${new Date().toISOString().slice(0, 10)}.zip`);
    button.textContent = "ZIP Started";
  } catch {
    button.textContent = "ZIP Failed";
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = originalLabel;
    }, 1800);
  }
}

async function loadAdminFavoriteRows(galleryId) {
  const summary = await loadGalleryFavoriteSummary(galleryId);
  const ids = summary.map((item) => item.image_id).filter(Boolean);
  if (!ids.length) return [];
  const { data: images, error } = await supabase
    .from("client_gallery_images")
    .select("id,file_name,title,section_id,display_order,original_path,display_path,thumbnail_path")
    .in("id", ids);
  if (error) throw error;
  const imageMap = new Map((images || []).map((image) => [image.id, image]));
  return summary
    .map((item) => ({ ...item, image: imageMap.get(item.image_id) }))
    .filter((item) => item.image)
    .sort((a, b) => Number(a.image.display_order || 0) - Number(b.image.display_order || 0));
}

function buildAdminFavoritesPanel(rows) {
  const totalSelections = rows.reduce((total, row) => total + Number(row.favorite_count || 0), 0);
  const panel = document.createElement("section");
  panel.id = "est74-admin-favorites-panel";
  panel.style.cssText = "background:#fff;border:1px solid #e5e5e5;color:#111;margin:0 0 1.25rem;padding:1rem;font-family:'Inter',sans-serif;";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;";

  const title = document.createElement("div");
  title.innerHTML = `<strong>${rows.length}</strong> favorited photo${rows.length === 1 ? "" : "s"} · <strong>${totalSelections}</strong> total selection${totalSelections === 1 ? "" : "s"}`;
  title.style.cssText = "font-size:12px;color:#555;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy Favorite Names";
  copyButton.style.cssText = "background:transparent;border:1px solid #ddd;color:#111;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.12em;padding:9px 11px;text-transform:uppercase;";
  copyButton.onclick = async () => {
    const names = rows.map((row) => row.image.file_name || row.image.title || row.image.id).join("\n");
    await navigator.clipboard.writeText(names || "No favorite selections yet.");
    copyButton.textContent = "Copied";
    window.setTimeout(() => { copyButton.textContent = "Copy Favorite Names"; }, 1600);
  };

  const zipButton = document.createElement("button");
  zipButton.type = "button";
  zipButton.textContent = "Download Favorites ZIP";
  zipButton.style.cssText = "background:#111;border:1px solid #111;color:#fff;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:.12em;padding:9px 11px;text-transform:uppercase;";
  zipButton.onclick = () => saveSelectedZip(rows, zipButton);

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "Refresh";
  refreshButton.style.cssText = copyButton.style.cssText;
  refreshButton.onclick = () => renderAdminFavoritePanel(true);

  actions.append(zipButton, copyButton, refreshButton);
  header.append(title, actions);
  panel.append(header);

  if (rows.length) {
    const helper = document.createElement("p");
    helper.textContent = "Click a filename to download that one selected image, or use the ZIP button for the full client selection.";
    helper.style.cssText = "color:#777;font-size:12px;line-height:1.5;margin:.8rem 0 0;";
    panel.append(helper);

    const list = document.createElement("div");
    list.style.cssText = "display:grid;gap:6px;margin-top:.85rem;max-height:240px;overflow:auto;";
    rows.forEach((row) => {
      const item = document.createElement("div");
      item.style.cssText = "display:flex;justify-content:space-between;gap:1rem;border-top:1px solid #eee;color:#555;font-size:12px;padding:.55rem 0 0;";
      const name = document.createElement("button");
      name.type = "button";
      name.textContent = row.image.file_name || row.image.title || row.image.id;
      name.style.cssText = "background:transparent;border:none;color:#111;cursor:pointer;font:inherit;padding:0;text-align:left;text-decoration:underline;text-underline-offset:3px;";
      name.onclick = async () => {
        const original = name.textContent;
        name.textContent = "Preparing image...";
        try {
          await saveSelectedImage(row);
          name.textContent = "Download started";
        } catch {
          name.textContent = "Download failed";
        } finally {
          window.setTimeout(() => { name.textContent = original; }, 1600);
        }
      };
      const count = document.createElement("strong");
      count.textContent = `♥ ${row.favorite_count}`;
      count.style.color = "#00b894";
      item.append(name, count);
      list.append(item);
    });
    panel.append(list);
  } else {
    const empty = document.createElement("p");
    empty.textContent = "No client favorites have been saved for this gallery yet.";
    empty.style.cssText = "color:#777;font-size:12px;margin:.85rem 0 0;";
    panel.append(empty);
  }

  return panel;
}

async function renderAdminFavoritePanel(force = false) {
  const galleryId = adminGalleryId();
  const main = document.querySelector("main");
  if (!galleryId || !main) return;
  const existing = document.getElementById("est74-admin-favorites-panel");
  if (existing && !force) return;
  if (existing) existing.remove();
  try {
    const rows = await loadAdminFavoriteRows(galleryId);
    main.prepend(buildAdminFavoritesPanel(rows));
  } catch {
    // Keep the gallery workspace stable if favorites are not ready yet.
  }
}

function installAdminFavoritePanel() {
  if (typeof window === "undefined" || window.__est74AdminFavoritesInstalled) return;
  window.__est74AdminFavoritesInstalled = true;
  window.setInterval(() => renderAdminFavoritePanel(false), 2400);
}

export function installGalleryFavoriteSync() {
  if (typeof window === "undefined" || window.__galleryFavoriteSyncInstalled) return;
  window.__galleryFavoriteSyncInstalled = true;
  const installedAt = Date.now();

  const nativeSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = (key, value) => {
    const normalizedKey = String(key);
    const previousValue = normalizedKey.startsWith(FAVORITES_STORAGE_PREFIX) ? window.localStorage.getItem(normalizedKey) : null;
    const isInitialEmptyOverwrite = Date.now() - installedAt < 3000 && previousValue && previousValue !== "[]" && value === "[]";
    nativeSetItem(key, isInitialEmptyOverwrite ? previousValue : value);
    if (!normalizedKey.startsWith(FAVORITES_STORAGE_PREFIX) || isInitialEmptyOverwrite) return;
    const galleryId = normalizedKey.slice(FAVORITES_STORAGE_PREFIX.length);
    syncFavoriteIds(galleryId, parseFavoriteIds(previousValue), parseFavoriteIds(value)).catch(() => undefined);
  };

  installAdminFavoritePanel();
}

export function emptyFavoriteSet() {
  return new Set();
}

export { supabase };
