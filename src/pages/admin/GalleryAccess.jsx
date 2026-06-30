import { Link, useParams } from "react-router-dom";
import { COLORS } from "../../lib/constants";

export default function GalleryAccess() {
  const { galleryId } = useParams();
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.white, display: "grid", placeItems: "center", padding: "2rem", textAlign: "center" }}>
      <div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", margin: "0 0 1rem" }}>Access settings moved</h1>
        <p style={{ color: COLORS.muted, fontFamily: "'Inter', sans-serif", lineHeight: 1.7, margin: "0 0 1.5rem" }}>
          Access settings are now managed inside the gallery workspace Settings tab.
        </p>
        <Link to={`/admin/galleries/${galleryId}`} style={{ color: COLORS.gold, fontFamily: "'Inter', sans-serif", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Open Gallery Settings
        </Link>
      </div>
    </div>
  );
}
