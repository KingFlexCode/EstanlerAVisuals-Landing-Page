import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { COLORS, BASE, CATEGORY_LABELS } from "../lib/constants";
import Footer from "../components/Footer";

const FILTERS = ["All", ...Object.values(CATEGORY_LABELS)];

function buildPublicUrl(path) {
  if (!path) return "";
  return `${BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function mapPortfolioImage(image) {
  return {
    id: image.id,
    category: image.category,
    label: image.title || image.file_name,
    img: buildPublicUrl(image.thumbnail_path || image.original_path),
    fullImg: buildPublicUrl(image.original_path),
    aspect: image.aspect_ratio || "4 / 5",
    objectPosition: `${image.object_position_x ?? 50}% ${image.object_position_y ?? 50}%`,
    zoom: Number(image.zoom || 1),
  };
}

function getCategoryCounts(items) {
  return items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
}

// ─── Spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6rem 0" }}>
      <div style={{
        width: "28px", height: "28px",
        border: `2px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.gold}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Category nav pills ───────────────────────────────────────────────
function CategoryNav({ active, onChange, counts }) {
  return (
    <div style={{
      display: "flex", gap: "0", overflowX: "auto",
      borderBottom: `1px solid ${COLORS.border}`,
      scrollbarWidth: "none",
      msOverflowStyle: "none",
    }}>
      {FILTERS.map(f => {
        const isActive = active === f;
        const categoryKey = Object.keys(CATEGORY_LABELS).find(key => CATEGORY_LABELS[key] === f);
        const count = f === "All"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : counts[categoryKey] || 0;
        return (
          <button key={f} onClick={() => onChange(f)} style={{
            fontFamily: "'Inter', sans-serif", fontWeight: isActive ? 500 : 300,
            fontSize: "12px", letterSpacing: "0.08em",
            color: isActive ? COLORS.text : COLORS.muted,
            background: "none", border: "none",
            borderBottom: isActive ? `2px solid ${COLORS.gold}` : "2px solid transparent",
            padding: "1rem 1.25rem 0.875rem",
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 0.2s",
            marginBottom: "-1px",
          }}>
            {f}
            {count > 0 && (
              <span style={{
                marginLeft: "6px", fontSize: "10px",
                color: isActive ? COLORS.gold : COLORS.muted,
                opacity: 0.7,
              }}>({count})</span>
            )}
          </button>
        );
      })}
      <style>{`::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// ─── Collage grid ─────────────────────────────────────────────────────
// Alternates between different layout patterns for visual variety
function CollageGrid({ items, onSelect }) {
  if (items.length === 0) return null;

  const groups = chunkItems(items);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {groups.map((group, gi) => (
        <CollageRow key={gi} items={group} onSelect={onSelect} startIndex={
          groups.slice(0, gi).reduce((a, g) => a + g.length, 0)
        } />
      ))}
    </div>
  );
}

// Split items into groups of varying sizes for collage effect
function chunkItems(items) {
  const groups = [];
  let i = 0;
  let rowIndex = 0;
  while (i < items.length) {
    const pattern = rowIndex % 4;
    let size;
    if (pattern === 0) size = Math.min(3, items.length - i); // 3 equal
    else if (pattern === 1) size = Math.min(2, items.length - i); // 2 - one tall one wide
    else if (pattern === 2) size = Math.min(4, items.length - i); // 4 small
    else size = Math.min(2, items.length - i); // 2 equal
    groups.push(items.slice(i, i + size));
    i += size;
    rowIndex++;
  }
  return groups;
}

function CollageRow({ items, onSelect, startIndex }) {
  const count = items.length;

  if (count === 1) {
    return (
      <div style={{ height: "clamp(280px, 45vw, 560px)" }}>
        <PhotoTile item={items[0]} index={startIndex} onSelect={onSelect} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", height: "clamp(220px, 35vw, 440px)" }}>
        {items.map((item, i) => (
          <PhotoTile key={item.id} item={item} index={startIndex + i} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "4px", height: "clamp(200px, 32vw, 400px)" }}>
        {items.map((item, i) => (
          <PhotoTile key={item.id} item={item} index={startIndex + i} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  if (count === 4) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "4px", height: "clamp(180px, 28vw, 340px)" }}>
        {items.map((item, i) => (
          <PhotoTile key={item.id} item={item} index={startIndex + i} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", height: "clamp(180px, 28vw, 340px)" }}>
      {items.map((item, i) => (
        <PhotoTile key={item.id} item={item} index={startIndex + i} onSelect={onSelect} />
      ))}
    </div>
  );
}

function PhotoTile({ item, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const baseZoom = item.zoom || 1;

  return (
    <div
      onClick={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative", overflow: "hidden",
        cursor: "pointer", background: COLORS.surface,
        height: "100%",
      }}
    >
      <img
        src={item.img}
        alt={item.label}
        loading="lazy"
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: item.objectPosition || "50% 50%",
          display: "block",
          transform: hovered ? `scale(${baseZoom * 1.04})` : `scale(${baseZoom})`,
          transition: "transform 0.5s ease",
        }}
        onError={e => { e.currentTarget.parentElement.style.display = "none"; }}
      />
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────
function Lightbox({ item, items, onClose, onNav }) {
  const idx = items.findIndex(i => i.id === item.id);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && idx < items.length - 1) onNav(items[idx + 1]);
      if (e.key === "ArrowLeft" && idx > 0) onNav(items[idx - 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, items, onClose, onNav]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(10,10,10,0.96)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: "absolute", top: "1.5rem", right: "1.5rem",
        background: "none", border: "none", color: "#fff",
        fontSize: "1.4rem", cursor: "pointer", zIndex: 201,
        opacity: 0.7,
      }}>✕</button>

      {/* Prev */}
      {idx > 0 && (
        <button onClick={e => { e.stopPropagation(); onNav(items[idx - 1]); }} style={{
          position: "absolute", left: "1.5rem",
          background: "none", border: "none", color: "#fff",
          fontSize: "2.5rem", cursor: "pointer", zIndex: 201, opacity: 0.6,
        }}>‹</button>
      )}

      <img
        src={item.fullImg || item.img}
        alt={item.label}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "90vw", maxHeight: "88vh", objectFit: "contain" }}
      />

      {/* Next */}
      {idx < items.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNav(items[idx + 1]); }} style={{
          position: "absolute", right: "1.5rem",
          background: "none", border: "none", color: "#fff",
          fontSize: "2.5rem", cursor: "pointer", zIndex: 201, opacity: 0.6,
        }}>›</button>
      )}
    </div>
  );
}

// ─── Main Work page ───────────────────────────────────────────────────
export default function Work() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState(null);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);

      const { data, error } = await supabase
        .from("portfolio_images")
        .select("*")
        .eq("is_visible", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading portfolio images:", error);
        setAllItems([]);
        setCounts({});
        setLoading(false);
        return;
      }

      const results = (data || []).map(mapPortfolioImage);
      setAllItems(results);
      setCounts(getCategoryCounts(results));
      setLoading(false);
    }
    fetchAll();
  }, []);

  const filtered = filter === "All"
    ? allItems
    : allItems.filter(w => CATEGORY_LABELS[w.category] === filter);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>

      {/* Page header */}
      <div style={{
        paddingTop: "88px",
        padding: "88px clamp(1.5rem, 5vw, 4rem) 0",
        background: COLORS.bg,
      }}>

        {/* Category nav */}
        <CategoryNav
          active={filter}
          onChange={setFilter}
          counts={counts}
        />
      </div>

      {/* Grid */}
      <div style={{ padding: "4px" }}>
        {loading && <Spinner />}

        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: "center", padding: "6rem 2rem",
            fontFamily: "'Inter', sans-serif", fontWeight: 300,
            fontSize: "0.9rem", color: COLORS.muted,
          }}>No photos in this category yet.</div>
        )}

        {!loading && filtered.length > 0 && (
          <CollageGrid items={filtered} onSelect={setLightbox} />
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          item={lightbox}
          items={filtered}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      )}

      <Footer light />
    </div>
  );
}
