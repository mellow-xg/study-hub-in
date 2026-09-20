"use client";

import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 80;
const PULL_THRESHOLD = 90;
const LONG_PRESS_MS = 650;

export default function StudyHubGestures({ children }) {
  const touch = useRef(null);
  const longPressTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const dragging = useRef(false);
  const dragMoved = useRef(false);

  useEffect(() => {
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

      touch.current = {
        x: point.clientX,
        y: point.clientY,
        startY: point.clientY,
        startX: point.clientX,
        resource,
        cancelled: false,
      };

      clearLongPress();

      if (resource) {
        longPressTimer.current = setTimeout(() => {
          const current = touch.current;
          if (!current || current.cancelled) return;
          if (Math.abs(point.clientX - current.x) < 20 && Math.abs(point.clientY - current.y) < 20) {
            navigator.vibrate?.(20);
            window.dispatchEvent(new CustomEvent("studyhub:longpress", {
              detail: {
                resourceId: resource.dataset.gestureResource,
                resourceTitle: resource.dataset.gestureResourceTitle || "",
              },
            }));
          }
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
    };
  }, []);

  const goBack = () => {
    setOpen(false);
    window.history.back();
  };

  const goForward = () => {
    setOpen(false);
    window.history.forward();
  };

  const refresh = () => {
    setOpen(false);
    window.location.reload();
  };

  const home = () => {
    setOpen(false);
    window.location.assign("/");
  };

  const startDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = true;
    dragMoved.current = false;
    const move = (e) => {
      if (!dragging.current) return;
      dragMoved.current = true;
      const px = e.clientX;
      const py = e.clientY;
      setPosition({
        x: Math.min(Math.max(px - 28, 8), window.innerWidth - 64),
        y: Math.min(Math.max(py - 28, 8), window.innerHeight - 64),
      });
    };
    const end = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const toggle = () => {
    if (!dragMoved.current) setOpen((value) => !value);
    dragMoved.current = false;
  };

  const style = position.x == null
    ? { right: "14px", bottom: "calc(96px + env(safe-area-inset-bottom))" }
    : { left: position.x, top: position.y };

  return (
    <>
      {children}
      <div
        aria-label="Study Hub controls"
        style={{
          position: "fixed",
          zIndex: 2147483647,
          ...style,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {open && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
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
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.2)",
                  background: "rgba(18,18,24,.92)",
                  color: "#fff",
                  boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                  fontSize: 21,
                  cursor: "pointer",
                  backdropFilter: "blur(10px)",
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
            width: 54,
            height: 54,
            borderRadius: 999,
            border: "2px solid rgba(255,255,255,.28)",
            background: open ? "rgba(35,35,45,.96)" : "rgba(20,20,28,.94)",
            color: "#fff",
            boxShadow: "0 8px 28px rgba(0,0,0,.42)",
            fontSize: 24,
            cursor: "grab",
            display: "grid",
            placeItems: "center",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
    </>
  );
}
