"use client";

import { useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 80;
const PULL_THRESHOLD = 90;
const LONG_PRESS_MS = 650;

export default function StudyHubGestures({ children }) {
  const touch = useRef(null);
  const longPressTimer = useRef(null);

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
        time: Date.now(),
        resource,
        cancelled: false,
      };

      clearLongPress();

      if (resource) {
        longPressTimer.current = setTimeout(() => {
          const current = touch.current;
          if (!current || current.cancelled) return;

          const dx = Math.abs(point.clientX - current.x);
          const dy = Math.abs(point.clientY - current.y);

          if (dx < 20 && dy < 20) {
            navigator.vibrate?.(20);
            window.dispatchEvent(
              new CustomEvent("studyhub:longpress", {
                detail: {
                  resourceId: resource.dataset.gestureResource,
                  resourceTitle: resource.dataset.gestureResourceTitle || "",
                },
              })
            );
          }
        }, LONG_PRESS_MS);
      }
    };

    const onTouchMove = (event) => {
      const current = touch.current;
      if (!current || event.touches.length !== 1) return;

      const point = event.touches[0];
      const dx = point.clientX - current.x;
      const dy = point.clientY - current.y;

      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
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
        if (dx > 0) {
          window.history.back();
        } else {
          window.history.forward();
        }
        return;
      }

      if (
        dy >= PULL_THRESHOLD &&
        absY > absX * 1.25 &&
        window.scrollY <= 2
      ) {
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

  return <>{children}</>;
}
