"use client";

import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 80;
const PULL_THRESHOLD = 90;
const LONG_PRESS_MS = 650;

export default function StudyHubGestures({ children }) {
  const touch = useRef(null);
  const longPressTimer = useRef(null);
  const controlsRef = useRef(null);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const dragFrame = useRef(null);
  const dragStart = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!open || !controlsRef.current) return;
      if (!controlsRef.current.contains(event.target)) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    const clearLongPress = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return;
      const point = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      const resource = target?.closest("[data-gesture-resource]");

      touch.current = { x: point.clientX, y: point.clientY, resource, cancelled: false };
      clearLongPress();

      if (resource) {
        longPressTimer.current = setTimeout(() => {
          const current = touch.current;
          if (!current || current.cancelled) return;
          navigator.vibrate?.(20);
          window.dispatchEvent(new CustomEvent("studyhub:longpress", {
            detail: {
              resourceId: resource.dataset.gestureResource,
              resourceTitle: resource.dataset.gestureResourceTitle || "",
            },
          }));
        }, LONG_PRESS_MS);
      }
    };

    const onTouchMove = (event) => {
      const current = touch.current;
      if (!current || event.touches.length !== 1) return;
      const point = event.touches[0];
      if (Math.abs(point.clientX - current.x) > 12 || Math.abs(point.clientY - current.y) > 12) {
        clearLongPress();
        current.cancelled = true;
      }
    };

    const onTouchEnd = (event) => {
      clearLongPress();
      const current = touch.current;
      touch.current = null;
      if (!current || current.cancelled || !event.changedTouches.length) return;

      const point = event.changedTouches[0];
      const dx = point.clientX - current.x;
      const dy = point.clientY - current.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX >= SWIPE_THRESHOLD && absX > absY * 1.25) {
        if (dx > 0) window.history.back();
        else window.history.forward();
        return;
      }

      if (dy >= PULL_THRESHOLD && absY > absX * 1.25 && window.scrollY <= 2) {
        window.location.reload();
      }
    };

    const onTouchCancel = () => {
      clearLongPress();
      touch.current = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      clearLongPress();
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      if (dragFrame.current) cancelAnimationFrame(dragFrame.current);
    };
    return () => {
      clearLongPress();
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      if (dragFrame.current) cancelAnimationFrame(dragFrame.current);
    };
  }, [open]);

  const goBack = () => { setOpen(false); window.history.back(); };
  const goForward = () => { setOpen(false); window.history.forward(); };
  const refresh = () => { setOpen(false); window.location.reload(); };
  const home = () => { setOpen(false); window.location.assign("/"); };

  const startDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = true;
    dragMoved.current = false;

    const rect = controlsRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top,
    };

    const move = (e) => {
      if (!dragging.current || !dragStart.current || !controlsRef.current) return;
      const d = dragStart.current;
      const x = Math.min(Math.max(d.left + e.clientX - d.pointerX, 8), window.innerWidth - 62);
      const y = Math.min(Math.max(d.top + e.clientY - d.pointerY, 8), window.innerHeight - 62);
      dragMoved.current = Math.abs(e.clientX - d.pointerX) > 4 || Math.abs(e.clientY - d.pointerY) > 4;

      if (!dragFrame.current) {
        dragFrame.current = requestAnimationFrame(() => {
          dragFrame.current = null;
          const r = controlsRef.current;
          if (!r || !dragStart.current) return;
          const now = dragStart.current;
          const dx = e.clientX - now.pointerX;
          const dy = e.clientY - now.pointerY;
          r.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        });
      }
    };

    const end = (e) => {
      const d = dragStart.current;
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);

      if (d) {
        const x = Math.min(Math.max(d.left + e.clientX - d.pointerX, 8), window.innerWidth - 62);
        const y = Math.min(Math.max(d.top + e.clientY - d.pointerY, 8), window.innerHeight - 62);
        if (dragMoved.current) setPosition({ x, y });
      }

      if (controlsRef.current) controlsRef.current.style.transform = "translate3d(0,0,0)";
      dragStart.current = null;
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  };

  const toggle = () => {
    if (!dragMoved.current) setOpen((value) => !value);
    dragMoved.current = false;
  };

  const positionStyle = position
    ? { left: position.x, top: position.y }
    : { right: 14, bottom: "calc(96px + env(safe-area-inset-bottom))" };

  return (
    <>
      {children}

      <div
        ref={controlsRef}
        aria-label="Study Hub controls"
        style={{
          position: "fixed",
          zIndex: 2147483647,
          ...positionStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          pointerEvents: "none",
          willChange: "transform",
          transform: "translate3d(0,0,0)",
        }}
      >
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto" }}>
            {[
              ["←", "Back", goBack],
              ["→", "Forward", goForward],
              ["↻", "Refresh", refresh],
              ["⌂", "Home", home],
            ].map(([icon, label, action]) => (
              <button
                key={label}
                type="button"
                onClick={action}
                aria-label={label}
                title={label}
                style={{
                  width: 46, height: 46, borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.2)",
                  background: "rgba(18,18,24,.94)", color: "#fff",
                  boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                  fontSize: 21, cursor: "pointer",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label={open ? "Close Study Hub controls" : "Open Study Hub controls"}
          title="Study Hub controls — drag to move"
          onPointerDown={startDrag}
          onClick={toggle}
          style={{
            pointerEvents: "auto",
            touchAction: "none",
            width: 54, height: 54, padding: 0,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,.28)",
            background: open ? "rgba(35,35,45,.96)" : "rgba(20,20,28,.94)",
            color: "#fff",
            boxShadow: "0 8px 28px rgba(0,0,0,.42)",
            fontSize: 24, cursor: "grab",
            display: "grid", placeItems: "center",
            userSelect: "none", WebkitUserSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
    </>
  );
}
