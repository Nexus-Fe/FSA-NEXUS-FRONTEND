"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import "./BackToTop.css";

const SCROLL_THRESHOLD = 360;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Về đầu trang"
      title="Về đầu trang"
      onClick={scrollToTop}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}
