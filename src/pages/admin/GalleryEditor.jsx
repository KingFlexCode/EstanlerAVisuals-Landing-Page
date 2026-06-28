import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "../../components/UI";
import { COLORS } from "../../lib/constants";
import { supabase } from "../../lib/supabase";
import { AdminNav } from "./Dashboard";

const CLIENT_GALLERY_BUCKET = "client-galleries";

const STATUS_OPTIONS = ["draft", "published", "archived"];
const SIDEBAR_TABS = [
  { id: "photos", label: "Photos", icon: "▦" },
  { id: "design", label: "Design", icon: "◈" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "activity", label: "Activity", icon: "◷" },
];

const COVER_STYLES = [
  { id: "center", label: "Center", description: "Full-width cover with centered title." },
  { id: "left", label: "Left", description: "Title aligned to the left edge." },
  { id: "frame", label: "Frame", description: "Inset frame with clean border treatment." },
  { id: "stripe", label: "Stripe", description: "Minimal editorial stripe overlay." },
];

const GRID_STYLES = [
  { id: "masonry", label: "Masonry" },
  { id: "square", label: "Square" },
  { id: "editorial", label: "Editorial" },
];

const TYPOGRAPHY_STYLES = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "editorial", label: "Editorial" },
];

const pageStyle = {
  minHeight: "100vh",
  background: COLORS.bg,
  color: COLORS.white,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.035)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.white,
  padding: "10px 12px",
  fontFamily: "'Inter', sans-serif",
  fontSize: 13,
  outline: "none",
};

const buttonStyle = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.white,
  cursor: "pointer",
  padding: "9px 11px",
  fontFamily: "'Inter', sans-serif",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: COLORS.gold,
  border: "none",
  color: COLORS.bg,
};

function slugify(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value) {
  if (!value) return "No event date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function getFileExtension(fileName = "", fallback = "jpg") {
  return fileName.split(".").pop()?.toLowerCase() || fallback;
}

function sanitizeFileName(name = "") {
  const baseName = name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return baseName || `client-gallery-photo-${Date.now()}`;
}

function getGalleryPhotoUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(CLIENT_GALLERY_BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function getPhotoPreviewUrl(photo) {
  return getGalleryPhotoUrl(photo?.thumbnail_path || photo?.display_path || photo?.original_path);
}

function getCoverUrl(photo) {
  return getGalleryPhotoUrl(photo?.display_path || photo?.thumbnail_path || photo?.original_path);
}

function sortByOrder(items) {
  return [...items].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function isFinalUploadStatus(status) {
  return status === "done" || status === "failed" || status === "skipped";
}

async function resizeImage(file, maxSize, quality = 0.82) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = objectUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const targetWidth = Math.round(image.naturalWidth * scale);
    const targetHeight = Math.round(image.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) throw new Error("Could not create optimized gallery image.");

    return {
      blob,
      width: targetWidth,
      height: targetHeight,
      size: blob.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function FieldLabel({ children }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 6,
        color: COLORS.muted,
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function StatusBadge({ status }) {
  const color =
    status === "published"
      ? "#4ade80"
      : status === "archived"
        ? COLORS.muted
        : COLORS.gold;

  return (
    <span
      style={{
        border: `1px solid ${color}`,
        borderRadius: 999,
        color,
        padding: "5px 10px",
        fontFamily: "'Inter', sans-serif",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {status || "draft"}
    </span>
  );
}

function SettingCard({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: active ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? COLORS.gold : COLORS.border}`,
        color: COLORS.white,
        cursor: "pointer",
        padding: "0.85rem",
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            color: COLORS.muted,
            fontFamily: "'Inter', sans-serif",
            fontSize: 11,
            lineHeight: 1.5,
            marginTop: 5,
          }}
        >
          {description}
        </div>
      )}
    </button>
  );
}

function EmptyState({ children }) {
  return (
    <div
      style={{
        border: `1px dashed ${COLORS.border}`,
        color: COLORS.muted,
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        lineHeight: 1.6,
        padding: "2.25rem 1rem",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function UploadProgressPanel({ queue, uploading, elapsedSeconds }) {
  if (!queue.length) return null;

  const completedCount = queue.filter((item) => isFinalUploadStatus(item.status)).length;
  const successfulCount = queue.filter((item) => item.status === "done").length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const skippedCount = queue.filter((item) => item.status === "skipped").length;
  const totalProgress = Math.round(
    queue.reduce((total, item) => total + Number(item.progress || 0), 0) / queue.length,
  );
  const activeItem =
    queue.find((item) => uploading && !isFinalUploadStatus(item.status) && item.status !== "ready") ||
    null;
  const estimatedRemainingSeconds =
    uploading && totalProgress > 5
      ? Math.max(0, Math.round((elapsedSeconds * (100 - totalProgress)) / totalProgress))
      : null;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        background: "rgba(255,255,255,0.025)",
        padding: "0.85rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: 8 }}>
        <div>
          <FieldLabel>Upload Progress</FieldLabel>
          <div style={{ color: COLORS.white, fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 800 }}>
            {uploading ? "Uploading gallery photos" : "Upload complete"}
          </div>
          {activeItem && (
            <div style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 11, marginTop: 4 }}>
              Current: {activeItem.name}
            </div>
          )}
        </div>
        <div style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 11, textAlign: "right" }}>
          <div>{completedCount}/{queue.length}</div>
          <div>{formatDuration(elapsedSeconds)}</div>
          {estimatedRemainingSeconds !== null && <div>~{formatDuration(estimatedRemainingSeconds)} left</div>}
        </div>
      </div>

      <div
        style={{
          height: 8,
          border: `1px solid ${COLORS.border}`,
          background: "rgba(255,255,255,0.04)",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, totalProgress))}%`,
            height: "100%",
            background: COLORS.gold,
            transition: "width 0.2s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          color: COLORS.muted,
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          marginBottom: 10,
        }}
      >
        <div>Uploaded: {successfulCount}</div>
        <div>Skipped: {skippedCount}</div>
        <div>Failed: {failedCount}</div>
      </div>

      <div style={{ maxHeight: 185, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
        {queue.map((item, index) => {
          const statusColor =
            item.status === "done"
              ? "#9af0b8"
              : item.status === "failed"
                ? "#ff8b8b"
                : item.status === "skipped"
                  ? COLORS.muted
                  : COLORS.gold;

          return (
            <div
              key={`${item.name}-${index}`}
              style={{
                border: `1px solid ${COLORS.border}`,
                background: "rgba(0,0,0,0.18)",
                padding: "7px 8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    color: COLORS.white,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    color: statusColor,
                    flexShrink: 0,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {item.progress}%
                </span>
              </div>
              <div style={{ color: statusColor, fontFamily: "'Inter', sans-serif", fontSize: 10, marginTop: 3 }}>
                {item.message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryPreview({ gallery, sections, photos, coverPhoto, previewMode }) {
  const visibleSections = sortByOrder(sections).filter((section) => section.is_visible !== false);
  const themeColor = gallery.theme_color || COLORS.gold;
  const coverStyle = gallery.cover_style || "center";
  const gridStyle = gallery.grid_style || "masonry";
  const typography = gallery.typography_style || "classic";
  const coverUrl = getCoverUrl(coverPhoto);
  const objectPosition = `${gallery.cover_focal_x ?? 50}% ${gallery.cover_focal_y ?? 50}%`;
  const isMobile = previewMode === "mobile";

  const headingFont = typography === "modern" ? "'Inter', sans-serif" : "'Playfair Display', serif";
  const headingLetterSpacing = typography === "editorial" ? "0.18em" : "0.02em";
  const titleAlign = coverStyle === "left" ? "left" : "center";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isMobile ? 390 : 980,
        margin: "0 auto",
        background: "#fff",
        color: "#111",
        boxShadow: "0 28px 90px rgba(0,0,0,0.35)",
        overflow: "hidden",
        transition: "max-width 0.25s ease",
      }}
    >
      <section
        style={{
          minHeight: isMobile ? 330 : 420,
          background: coverUrl
            ? `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.48)), url(${coverUrl}) ${objectPosition} / cover`
            : "linear-gradient(135deg, #1c1c1c, #3b3b3b)",
          display: "flex",
          alignItems: coverStyle === "stripe" ? "center" : "flex-end",
          justifyContent: coverStyle === "left" ? "flex-start" : "center",
          padding: isMobile ? "2rem" : "3.5rem",
          boxSizing: "border-box",
          border: coverStyle === "frame" ? "18px solid #fff" : "none",
          position: "relative",
        }}
      >
        {coverStyle === "stripe" && (
          <span
            style={{
              position: "absolute",
              left: "12%",
              right: "12%",
              top: "50%",
              height: 1,
              background: "rgba(255,255,255,0.75)",
            }}
          />
        )}
        <div style={{ textAlign: titleAlign, color: "#fff", maxWidth: 760 }}>
          <div
            style={{
              color: themeColor,
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.16em",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            {formatDate(gallery.event_date)}
          </div>
          <h1
            style={{
              fontFamily: headingFont,
              fontSize: isMobile ? "2rem" : "3.1rem",
              fontWeight: typography === "modern" ? 700 : 600,
              letterSpacing: headingLetterSpacing,
              lineHeight: 1,
              margin: 0,
              textTransform: typography === "editorial" ? "uppercase" : "none",
            }}
          >
            {gallery.title || "Untitled Gallery"}
          </h1>
          {gallery.client_name && (
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                letterSpacing: "0.08em",
                margin: "1rem 0 0",
                textTransform: "uppercase",
              }}
            >
              {gallery.client_name}
            </p>
          )}
        </div>
      </section>

      <section style={{ padding: isMobile ? "1.25rem" : "2rem" }}>
        {visibleSections.length === 0 && (
          <div style={{ color: "#777", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>
            No visible photo sets yet.
          </div>
        )}

        {visibleSections.map((section) => {
          const sectionPhotos = sortByOrder(photos).filter((photo) => photo.section_id === section.id);

          return (
            <div key={section.id} style={{ marginBottom: isMobile ? "1.75rem" : "2.75rem" }}>
              <h2
                style={{
                  color: "#111",
                  fontFamily: headingFont,
                  fontSize: isMobile ? "1.15rem" : "1.45rem",
                  fontWeight: 600,
                  margin: "0 0 1rem",
                }}
              >
                {section.title}
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    gridStyle === "square"
                      ? `repeat(${isMobile ? 2 : 4}, 1fr)`
                      : `repeat(${isMobile ? 2 : 3}, 1fr)`,
                  gap: gridStyle === "editorial" ? 10 : 5,
                }}
              >
                {sectionPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    style={{
                      minHeight: gridStyle === "masonry" ? (index % 3 === 0 ? 210 : 150) : undefined,
                      aspectRatio: gridStyle === "square" ? "1 / 1" : index % 5 === 0 && gridStyle === "editorial" ? "4 / 5" : "3 / 2",
                      background: getPhotoPreviewUrl(photo)
                        ? `url(${getPhotoPreviewUrl(photo)}) center / cover`
                        : "#e6e6e6",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function GalleryEditor() {
  const { galleryId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [gallery, setGallery] = useState(null);
  const [sections, setSections] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploadStartedAt, setUploadStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState("photos");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [newSection, setNewSection] = useState("");
  const [targetSection, setTargetSection] = useState("");

  const coverPhoto = useMemo(
    () => photos.find((photo) => photo.id === gallery?.cover_image_id) || photos[0] || null,
    [gallery?.cover_image_id, photos],
  );

  useEffect(() => {
    loadWorkspace();
  }, [galleryId]);

  useEffect(() => {
    if (!uploading || !uploadStartedAt) return undefined;

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - uploadStartedAt) / 1000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [uploading, uploadStartedAt]);

  async function loadWorkspace() {
    setLoading(true);
    setError("");

    const [galleryResult, sectionResult, photoResult] = await Promise.all([
      supabase.from("client_galleries").select("*").eq("id", galleryId).single(),
      supabase
        .from("client_gallery_sections")
        .select("*")
        .eq("gallery_id", galleryId)
        .order("display_order", { ascending: true }),
      supabase
        .from("client_gallery_images")
        .select("*")
        .eq("gallery_id", galleryId)
        .order("display_order", { ascending: true }),
    ]);

    if (galleryResult.error) {
      setError(galleryResult.error.message);
      setGallery(null);
    } else {
      setGallery(galleryResult.data);
    }

    if (sectionResult.error) {
      setError(sectionResult.error.message);
      setSections([]);
    } else {
      const nextSections = sectionResult.data || [];
      setSections(nextSections);
      setTargetSection((current) => current || nextSections[0]?.id || "");
    }

    if (photoResult.error) {
      setError(photoResult.error.message);
      setPhotos([]);
    } else {
      setPhotos(photoResult.data || []);
    }

    setLoading(false);
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  function flash(message) {
    setNotice(message);
    setError("");
  }

  function setGalleryField(key, value) {
    setGallery((current) => ({ ...current, [key]: value }));
  }

  function updateQueueItem(index, patch) {
    setUploadQueue((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function saveGallery() {
    if (!gallery?.title?.trim()) {
      setError("Gallery title is required.");
      return;
    }

    setSaving(true);

    const payload = {
      title: gallery.title.trim(),
      slug: slugify(gallery.slug || gallery.title),
      client_name: gallery.client_name || null,
      client_email: gallery.client_email || null,
      event_date: gallery.event_date || null,
      description: gallery.description || null,
      status: gallery.status || "draft",
      cover_image_id: gallery.cover_image_id || null,
      cover_style: gallery.cover_style || "center",
      theme_color: gallery.theme_color || "#C8A96A",
      grid_style: gallery.grid_style || "masonry",
      typography_style: gallery.typography_style || "classic",
      cover_focal_x: Number(gallery.cover_focal_x ?? 50),
      cover_focal_y: Number(gallery.cover_focal_y ?? 50),
    };

    const { data, error: updateError } = await supabase
      .from("client_galleries")
      .update(payload)
      .eq("id", gallery.id)
      .select("*")
      .single();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setGallery(data);
    flash("Gallery workspace saved.");
  }

  async function addSection() {
    const title = newSection.trim();
    if (!title) return;

    const displayOrder = sections.length
      ? Math.max(...sections.map((section) => section.display_order || 0)) + 1
      : 0;

    const { data, error: insertError } = await supabase
      .from("client_gallery_sections")
      .insert({
        gallery_id: galleryId,
        title,
        display_order: displayOrder,
        is_visible: true,
      })
      .select("*")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSections((current) => sortByOrder([...current, data]));
    setTargetSection(data.id);
    setNewSection("");
    flash("Photo set added.");
  }

  async function saveSection(section, updates = {}) {
    const { data, error: updateError } = await supabase
      .from("client_gallery_sections")
      .update({
        title: section.title || "Untitled Set",
        is_visible: section.is_visible !== false,
        ...updates,
      })
      .eq("id", section.id)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSections((current) => current.map((item) => (item.id === section.id ? data : item)));
    flash("Photo set saved.");
  }

  async function uploadSelectedFiles(fileList) {
    const selectedFiles = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

    if (!selectedFiles.length) return;

    const sectionId = targetSection || sections[0]?.id;

    if (!sectionId) {
      setError("Create a photo set before uploading images.");
      return;
    }

    const startedAt = Date.now();
    const existingSectionPhotos = photos.filter((photo) => photo.section_id === sectionId);
    const safeGallerySlug = slugify(gallery.slug || gallery.title || gallery.id);
    const insertedPhotos = [];
    let firstCoverId = gallery.cover_image_id || null;

    setUploading(true);
    setUploadStartedAt(startedAt);
    setElapsedSeconds(0);
    setError("");
    setNotice(`Uploading ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"}...`);
    setUploadQueue(
      selectedFiles.map((file) => ({
        name: file.name,
        status: "ready",
        message: "Ready",
        progress: 0,
      })),
    );

    for (const [index, file] of selectedFiles.entries()) {
      const cleanName = sanitizeFileName(file.name);
      const extension = getFileExtension(file.name);
      const uniqueName = `${Date.now()}-${index}-${cleanName}`;
      const basePath = `${safeGallerySlug}/${sectionId}`;
      const originalPath = `${basePath}/originals/${uniqueName}.${extension}`;
      const displayPath = `${basePath}/display/${uniqueName}.webp`;
      const thumbnailPath = `${basePath}/thumbnails/${uniqueName}.webp`;

      try {
        updateQueueItem(index, {
          status: "processing",
          message: "Creating display + thumbnail",
          progress: 12,
        });

        const [displayImage, thumbnailImage] = await Promise.all([
          resizeImage(file, 2200, 0.84),
          resizeImage(file, 720, 0.78),
        ]);

        updateQueueItem(index, {
          status: "uploading",
          message: "Uploading original",
          progress: 34,
        });

        const originalUpload = await supabase.storage
          .from(CLIENT_GALLERY_BUCKET)
          .upload(originalPath, file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: file.type,
          });

        if (originalUpload.error) throw originalUpload.error;

        updateQueueItem(index, {
          status: "uploading",
          message: "Uploading display image",
          progress: 58,
        });

        const displayUpload = await supabase.storage
          .from(CLIENT_GALLERY_BUCKET)
          .upload(displayPath, displayImage.blob, {
            cacheControl: "31536000",
            upsert: false,
            contentType: "image/webp",
          });

        if (displayUpload.error) throw displayUpload.error;

        updateQueueItem(index, {
          status: "uploading",
          message: "Uploading thumbnail",
          progress: 76,
        });

        const thumbnailUpload = await supabase.storage
          .from(CLIENT_GALLERY_BUCKET)
          .upload(thumbnailPath, thumbnailImage.blob, {
            cacheControl: "31536000",
            upsert: false,
            contentType: "image/webp",
          });

        if (thumbnailUpload.error) throw thumbnailUpload.error;

        updateQueueItem(index, {
          status: "saving",
          message: "Saving gallery photo",
          progress: 92,
        });

        const title = cleanName.replace(/-/g, " ");

        const { data: insertedPhoto, error: insertError } = await supabase
          .from("client_gallery_images")
          .insert({
            gallery_id: galleryId,
            section_id: sectionId,
            file_name: file.name,
            title,
            alt_text: title,
            original_path: originalPath,
            display_path: displayPath,
            thumbnail_path: thumbnailPath,
            display_order: existingSectionPhotos.length + insertedPhotos.length,
            original_size_bytes: file.size,
            display_size_bytes: displayImage.size,
            thumbnail_size_bytes: thumbnailImage.size,
            display_width: displayImage.width,
            display_height: displayImage.height,
            thumbnail_width: thumbnailImage.width,
            thumbnail_height: thumbnailImage.height,
            mime_type: file.type,
            focal_x: 50,
            focal_y: 50,
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        insertedPhotos.push(insertedPhoto);
        setPhotos((current) => sortByOrder([...current, insertedPhoto]));

        if (!firstCoverId) {
          firstCoverId = insertedPhoto.id;
          await setCoverImage(insertedPhoto.id, false);
        }

        updateQueueItem(index, {
          status: "done",
          message: "Uploaded",
          progress: 100,
        });
      } catch (uploadError) {
        console.error(uploadError);
        updateQueueItem(index, {
          status: "failed",
          message: uploadError.message || "Upload failed",
          progress: 100,
        });
        setError(uploadError.message || "One image failed to upload.");
      }
    }

    const finishedElapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    setElapsedSeconds(finishedElapsedSeconds);
    setUploadStartedAt(null);
    setUploading(false);

    const failedCount = uploadQueue.filter((item) => item.status === "failed").length;

    flash(
      failedCount > 0
        ? `Upload finished with ${failedCount} failed image${failedCount === 1 ? "" : "s"}.`
        : `Done. Uploaded ${insertedPhotos.length} image${insertedPhotos.length === 1 ? "" : "s"}.`,
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function removePhoto(photoId) {
    const { error: deleteError } = await supabase
      .from("client_gallery_images")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPhotos((current) => current.filter((photo) => photo.id !== photoId));

    if (gallery.cover_image_id === photoId) {
      setGalleryField("cover_image_id", null);
    }

    flash("Photo removed from this client gallery.");
  }

  async function setCoverImage(photoId, showNotice = true) {
    const { data, error: updateError } = await supabase
      .from("client_galleries")
      .update({ cover_image_id: photoId })
      .eq("id", galleryId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setGallery(data);
    if (showNotice) flash("Cover photo updated.");
  }

  async function movePhoto(photo, direction) {
    const sectionPhotos = sortByOrder(photos.filter((item) => item.section_id === photo.section_id));
    const index = sectionPhotos.findIndex((item) => item.id === photo.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || swapIndex < 0 || swapIndex >= sectionPhotos.length) return;

    const firstPhoto = sectionPhotos[index];
    const secondPhoto = sectionPhotos[swapIndex];
    const firstOrder = firstPhoto.display_order ?? index;
    const secondOrder = secondPhoto.display_order ?? swapIndex;

    const [firstUpdate, secondUpdate] = await Promise.all([
      supabase
        .from("client_gallery_images")
        .update({ display_order: secondOrder })
        .eq("id", firstPhoto.id)
        .select("*")
        .single(),
      supabase
        .from("client_gallery_images")
        .update({ display_order: firstOrder })
        .eq("id", secondPhoto.id)
        .select("*")
        .single(),
    ]);

    if (firstUpdate.error || secondUpdate.error) {
      setError(firstUpdate.error?.message || secondUpdate.error?.message || "Could not reorder photos.");
      return;
    }

    setPhotos((current) =>
      sortByOrder(
        current.map((item) =>
          item.id === firstUpdate.data.id
            ? firstUpdate.data
            : item.id === secondUpdate.data.id
              ? secondUpdate.data
              : item,
        ),
      ),
    );
  }

  function openPreview() {
    if (!gallery?.slug) return;
    window.open(`/gallery/${gallery.slug}`, "_blank", "noopener,noreferrer");
  }

  function renderPhotosPanel() {
    const selectedSection = sections.find((section) => section.id === targetSection) || sections[0];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <FieldLabel>Upload Gallery Photos</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => uploadSelectedFiles(event.target.files)}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !selectedSection}
            style={{
              ...primaryButtonStyle,
              width: "100%",
              opacity: uploading || !selectedSection ? 0.55 : 1,
              cursor: uploading || !selectedSection ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading..." : "+ Upload Photos"}
          </button>
          <p
            style={{
              color: COLORS.muted,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              lineHeight: 1.6,
              margin: "0.65rem 0 0",
            }}
          >
            These photos belong only to this client gallery. They are not portfolio images.
          </p>
        </div>

        <UploadProgressPanel queue={uploadQueue} uploading={uploading} elapsedSeconds={elapsedSeconds} />

        <label>
          <FieldLabel>Upload Into Photo Set</FieldLabel>
          <select value={targetSection} onChange={(event) => setTargetSection(event.target.value)} style={inputStyle}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>

        <div>
          <FieldLabel>Create Photo Set</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              value={newSection}
              onChange={(event) => setNewSection(event.target.value)}
              placeholder="Reception, Ceremony, Portraits..."
              style={inputStyle}
            />
            <button type="button" onClick={addSection} style={buttonStyle}>
              Add
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sections.length === 0 && <EmptyState>Create a photo set before uploading images.</EmptyState>}

          {sortByOrder(sections).map((section) => {
            const sectionPhotos = sortByOrder(photos.filter((photo) => photo.section_id === section.id));

            return (
              <section key={section.id} style={{ border: `1px solid ${COLORS.border}`, padding: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
                  <input
                    value={section.title || ""}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item) =>
                          item.id === section.id ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    style={{ ...inputStyle, padding: "8px 9px" }}
                  />
                  <button type="button" onClick={() => saveSection(section)} style={buttonStyle}>
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSection(section, { is_visible: section.is_visible === false })}
                    style={buttonStyle}
                  >
                    {section.is_visible === false ? "Show" : "Hide"}
                  </button>
                </div>

                {sectionPhotos.length === 0 && <EmptyState>No photos in this set yet.</EmptyState>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {sectionPhotos.map((photo) => {
                    const isCover = gallery.cover_image_id === photo.id;

                    return (
                      <article
                        key={photo.id}
                        style={{
                          border: `1px solid ${isCover ? COLORS.gold : COLORS.border}`,
                          background: "rgba(255,255,255,0.025)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: "4 / 3",
                            background: getPhotoPreviewUrl(photo)
                              ? `url(${getPhotoPreviewUrl(photo)}) center / cover`
                              : "rgba(255,255,255,0.06)",
                          }}
                        />
                        <div style={{ padding: 8 }}>
                          <div
                            style={{
                              color: COLORS.white,
                              fontFamily: "'Inter', sans-serif",
                              fontSize: 11,
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {photo.title || photo.file_name || "Gallery photo"}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 8 }}>
                            <button type="button" onClick={() => movePhoto(photo, "up")} style={buttonStyle}>
                              ↑
                            </button>
                            <button type="button" onClick={() => movePhoto(photo, "down")} style={buttonStyle}>
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => setCoverImage(photo.id)}
                              style={{ ...buttonStyle, color: COLORS.gold }}
                            >
                              Cover
                            </button>
                            <button
                              type="button"
                              onClick={() => removePhoto(photo.id)}
                              style={{ ...buttonStyle, color: "#ff8b8b" }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDesignPanel() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <FieldLabel>Device Preview</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              style={{ ...buttonStyle, color: previewMode === "desktop" ? COLORS.gold : COLORS.white }}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              style={{ ...buttonStyle, color: previewMode === "mobile" ? COLORS.gold : COLORS.white }}
            >
              Mobile
            </button>
          </div>
        </div>

        <div>
          <FieldLabel>Cover Style</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {COVER_STYLES.map((style) => (
              <SettingCard
                key={style.id}
                active={(gallery.cover_style || "center") === style.id}
                title={style.label}
                description={style.description}
                onClick={() => setGalleryField("cover_style", style.id)}
              />
            ))}
          </div>
        </div>

        <label>
          <FieldLabel>Gallery Color</FieldLabel>
          <input
            type="color"
            value={gallery.theme_color || "#c8a96a"}
            onChange={(event) => setGalleryField("theme_color", event.target.value)}
            style={{ ...inputStyle, minHeight: 44, padding: 6 }}
          />
        </label>

        <div>
          <FieldLabel>Grid Style</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {GRID_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setGalleryField("grid_style", style.id)}
                style={{ ...buttonStyle, color: (gallery.grid_style || "masonry") === style.id ? COLORS.gold : COLORS.white }}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Typography</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {TYPOGRAPHY_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setGalleryField("typography_style", style.id)}
                style={{ ...buttonStyle, color: (gallery.typography_style || "classic") === style.id ? COLORS.gold : COLORS.white }}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Cover Focal Point</FieldLabel>
          <label style={{ display: "block", marginBottom: 10 }}>
            <span style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 11 }}>Horizontal</span>
            <input
              type="range"
              min="0"
              max="100"
              value={gallery.cover_focal_x ?? 50}
              onChange={(event) => setGalleryField("cover_focal_x", Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 11 }}>Vertical</span>
            <input
              type="range"
              min="0"
              max="100"
              value={gallery.cover_focal_y ?? 50}
              onChange={(event) => setGalleryField("cover_focal_y", Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderSettingsPanel() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextField label="Gallery Title" value={gallery.title} onChange={(value) => setGalleryField("title", value)} />
        <TextField label="URL Slug" value={gallery.slug} onChange={(value) => setGalleryField("slug", slugify(value))} />
        <label>
          <FieldLabel>Status</FieldLabel>
          <select
            value={gallery.status || "draft"}
            onChange={(event) => setGalleryField("status", event.target.value)}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Client Name" value={gallery.client_name} onChange={(value) => setGalleryField("client_name", value)} />
        <TextField label="Client Email" type="email" value={gallery.client_email} onChange={(value) => setGalleryField("client_email", value)} />
        <TextField label="Event Date" type="date" value={gallery.event_date} onChange={(value) => setGalleryField("event_date", value)} />
        <label>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={gallery.description || ""}
            onChange={(event) => setGalleryField("description", event.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        {["Privacy", "Download", "Favorites"].map((setting) => (
          <div
            key={setting}
            style={{
              border: `1px solid ${COLORS.border}`,
              color: COLORS.muted,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              lineHeight: 1.6,
              padding: "0.85rem",
            }}
          >
            <strong style={{ color: COLORS.white }}>{setting}</strong>
            <br />
            Coming in the related access, download, and favorites issues.
          </div>
        ))}
      </div>
    );
  }

  function renderActivityPanel() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            color: COLORS.muted,
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            lineHeight: 1.6,
            padding: "0.85rem",
          }}
        >
          <strong style={{ color: COLORS.white }}>Workspace Activity</strong>
          <br />
          Activity logging can be connected later. For EST-71, this panel reserves the workspace area.
        </div>
        <div style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
          Created: {gallery.created_at ? new Date(gallery.created_at).toLocaleString() : "Unknown"}
        </div>
        <div style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
          Updated: {gallery.updated_at ? new Date(gallery.updated_at).toLocaleString() : "Unknown"}
        </div>
      </div>
    );
  }

  function renderActivePanel() {
    if (activeTab === "design") return renderDesignPanel();
    if (activeTab === "settings") return renderSettingsPanel();
    if (activeTab === "activity") return renderActivityPanel();
    return renderPhotosPanel();
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <AdminNav onSignOut={handleSignOut} />
        <div style={{ padding: "3rem" }}>
          <Spinner />
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div style={pageStyle}>
        <AdminNav onSignOut={handleSignOut} />
        <div style={{ padding: "3rem", color: COLORS.white }}>Gallery not found.</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <AdminNav onSignOut={handleSignOut} />

      <header
        style={{
          height: 68,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surfaceDark || "#060606",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "0 1.5rem",
          position: "sticky",
          top: 56,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
          <button type="button" onClick={() => navigate("/admin/galleries")} style={buttonStyle}>
            ← Galleries
          </button>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                color: COLORS.white,
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.15rem",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {gallery.title || "Untitled Gallery"}
            </h1>
            <div style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", fontSize: 12 }}>
              {formatDate(gallery.event_date)} · {photos.length} photo{photos.length === 1 ? "" : "s"}
            </div>
          </div>
          <StatusBadge status={gallery.status} />
        </div>

        <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
          <button type="button" onClick={openPreview} style={buttonStyle}>
            Preview
          </button>
          <button type="button" disabled style={{ ...buttonStyle, opacity: 0.45, cursor: "not-allowed" }}>
            Share Later
          </button>
          <button type="button" onClick={saveGallery} disabled={saving} style={primaryButtonStyle}>
            {saving ? "Saving..." : "Save Gallery"}
          </button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px minmax(0, 1fr)",
          minHeight: "calc(100vh - 124px)",
        }}
      >
        <aside
          style={{
            borderRight: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceDark || "#060606",
            minHeight: "calc(100vh - 124px)",
            position: "sticky",
            top: 124,
            alignSelf: "start",
          }}
        >
          <div
            style={{
              height: 170,
              background: getCoverUrl(coverPhoto)
                ? `url(${getCoverUrl(coverPhoto)}) ${gallery.cover_focal_x ?? 50}% ${gallery.cover_focal_y ?? 50}% / cover`
                : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
              borderBottom: `1px solid ${COLORS.border}`,
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("design")}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.28)",
                border: "none",
                color: COLORS.white,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                opacity: 0.9,
                textTransform: "uppercase",
              }}
            >
              Change Cover / Design
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${COLORS.border}` }}>
            {SIDEBAR_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "rgba(255,255,255,0.07)" : "transparent",
                  border: "none",
                  borderRight: `1px solid ${COLORS.border}`,
                  color: activeTab === tab.id ? COLORS.gold : COLORS.muted,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  padding: "0.75rem 0.35rem",
                  textTransform: "uppercase",
                }}
                title={tab.label}
              >
                <div style={{ fontSize: 16, marginBottom: 4 }}>{tab.icon}</div>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: "calc(100vh - 354px)", overflowY: "auto", padding: "1rem" }}>
            {error && (
              <div
                style={{
                  border: "1px solid rgba(224,92,92,0.35)",
                  color: "#ff8b8b",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: "1rem",
                  padding: "0.75rem",
                }}
              >
                {error}
              </div>
            )}
            {notice && (
              <div
                style={{
                  border: "1px solid rgba(74,222,128,0.28)",
                  color: "#9af0b8",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: "1rem",
                  padding: "0.75rem",
                }}
              >
                {notice}
              </div>
            )}
            {renderActivePanel()}
          </div>
        </aside>

        <main
          style={{
            background: "#f4f4f4",
            minHeight: "calc(100vh - 124px)",
            overflowX: "auto",
            padding: "3rem 2rem",
          }}
        >
          <GalleryPreview
            gallery={gallery}
            sections={sections}
            photos={photos}
            coverPhoto={coverPhoto}
            previewMode={previewMode}
          />
        </main>
      </div>
    </div>
  );
}
