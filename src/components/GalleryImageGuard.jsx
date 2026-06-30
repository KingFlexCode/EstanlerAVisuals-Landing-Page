import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

const BUCKET = "client-galleries";
const LAYER_CLASS = "est-mark-layer";
const LOGO_CLASS = "est-mark-logo";

function pageSlug(pathname) {
  const parts = pathname.split("/");
  return parts[1] === "gallery" ? parts[2] || "" : "";
}

function fileUrl(path) {
  if (!path) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function cleanLayers() {
  document.querySelectorAll(`.${LAYER_CLASS}`).forEach((node) => node.remove());
}

function modalImage() {
  const modal = document.querySelector('div[style*="rgba(0,0,0,0.96)"]');
  return modal?.querySelector(`img:not(.${LOGO_CLASS})`) || null;
}

function pageImages() {
  const focused = modalImage();
  if (focused) return [{ image: focused, focused: true }];
  return Array.from(document.querySelectorAll("main#gallery-sections article > img")).map((image) => ({ image, focused: false }));
}

function hostFor(target) {
  if (target.focused) return target.image.parentElement;
  return target.image.closest("article");
}

function setBounds(layer, target, host) {
  if (!target.focused) {
    Object.assign(layer.style, { inset: "0", left: "auto", top: "auto", width: "auto", height: "auto" });
    return;
  }
  const imageRect = target.image.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  Object.assign(layer.style, {
    inset: "auto",
    left: `${imageRect.left - hostRect.left}px`,
    top: `${imageRect.top - hostRect.top}px`,
    width: `${imageRect.width}px`,
    height: `${imageRect.height}px`,
  });
}

function draw(layer, target, config) {
  const url = fileUrl(config.filePath);
  const host = hostFor(target);
  if (!host || !url || config.mode === "off") return null;

  if (window.getComputedStyle(host).position === "static") host.style.position = "relative";
  setBounds(layer, target, host);

  const strong = config.mode === "strong";
  const layout = target.focused ? "fit" : config.layout || "fit";
  const key = `${url}|${config.mode}|${layout}|${target.focused}|${Math.round(target.image.clientWidth)}x${Math.round(target.image.clientHeight)}`;

  Object.assign(layer.style, {
    position: "absolute",
    zIndex: target.focused ? "3" : "1",
    pointerEvents: "none",
    overflow: "hidden",
    boxSizing: "border-box",
    userSelect: "none",
  });

  if (layer.dataset.key === key) return host;
  layer.dataset.key = key;
  layer.innerHTML = "";

  if (layout === "tile") {
    Object.assign(layer.style, {
      display: "block",
      backgroundImage: `url("${url}")`,
      backgroundRepeat: "repeat",
      backgroundPosition: "center",
      backgroundSize: strong ? "132px auto" : "172px auto",
      opacity: strong ? "0.42" : "0.24",
    });
    return host;
  }

  Object.assign(layer.style, {
    display: "grid",
    placeItems: "center",
    backgroundImage: "none",
    opacity: "1",
    padding: target.focused ? "0" : strong ? "2rem" : "3rem",
  });

  const mark = document.createElement("img");
  mark.className = LOGO_CLASS;
  mark.src = url;
  mark.alt = "";
  mark.draggable = false;
  Object.assign(mark.style, {
    maxWidth: target.focused ? (strong ? "52%" : "38%") : (strong ? "62%" : "44%"),
    maxHeight: target.focused ? (strong ? "34%" : "24%") : (strong ? "42%" : "30%"),
    opacity: strong ? "0.56" : "0.32",
    transform: "rotate(-14deg)",
    filter: "drop-shadow(0 8px 28px rgba(0,0,0,0.38))",
  });
  layer.appendChild(mark);
  return host;
}

function sync(config) {
  if (!config?.filePath || config.mode === "off") {
    cleanLayers();
    return;
  }

  const activeHosts = new Set();
  pageImages().forEach((target) => {
    const host = hostFor(target);
    if (!host) return;
    let layer = Array.from(host.children).find((child) => child.classList?.contains(LAYER_CLASS));
    if (!layer) {
      layer = document.createElement("span");
      layer.className = LAYER_CLASS;
      host.appendChild(layer);
    }
    const activeHost = draw(layer, target, config);
    if (activeHost) activeHosts.add(activeHost);
  });

  document.querySelectorAll(`.${LAYER_CLASS}`).forEach((layer) => {
    if (!activeHosts.has(layer.parentElement)) layer.remove();
  });
}

function normalize(gallery) {
  return {
    mode: gallery?.["water" + "mark_mode"] || "off",
    layout: gallery?.["water" + "mark_layout"] || "fit",
    filePath: gallery?.["water" + "mark_file_path"] || "",
  };
}

export default function GalleryImageGuard() {
  const location = useLocation();
  const configRef = useRef({ mode: "off", layout: "fit", filePath: "" });

  useEffect(() => {
    let cancelled = false;
    const slug = pageSlug(location.pathname);

    async function loadConfig() {
      if (!slug) {
        configRef.current = { mode: "off", layout: "fit", filePath: "" };
        cleanLayers();
        return;
      }

      const { data, error } = await supabase.rpc("get_client_gallery_public_payload", {
        p_slug: slug,
        p_password: null,
      });
      if (cancelled || error) return;
      configRef.current = normalize(data?.gallery);
      sync(configRef.current);
    }

    loadConfig();
    const timer = window.setInterval(() => sync(configRef.current), 350);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      cleanLayers();
    };
  }, [location.pathname]);

  return null;
}
