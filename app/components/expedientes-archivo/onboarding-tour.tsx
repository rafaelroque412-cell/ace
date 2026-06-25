"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Sparkles, HelpCircle } from "lucide-react";

export type TourStep = {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: string;
};

type Props = {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

export function OnboardingTour({ steps, open, onClose, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const updateTargetRect = useCallback(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      }, 200);
    }
  }, [open, step]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateTargetRect]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight" && !isLast) {
        setCurrentStep((s) => s + 1);
      } else if (e.key === "ArrowLeft" && !isFirst) {
        setCurrentStep((s) => s - 1);
      } else if (e.key === "Enter" && isLast) {
        onComplete?.();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isLast, isFirst, onClose, onComplete]);

  if (!open || !step) return null;

  const padding = 8;
  const spotlightStyle: React.CSSProperties = targetRect
    ? {
        position: "fixed",
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.6)",
        borderRadius: 12,
        zIndex: 200,
        pointerEvents: "none",
        transition: "all 300ms ease",
      }
    : {};

  const popoverStyle: React.CSSProperties = (() => {
    if (!targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 201,
      };
    }
    const popoverWidth = 360;
    const popoverHeight = 240;
    const margin = 16;
    const pos = step.position ?? "bottom";

    let top = 0;
    let left = 0;

    if (pos === "bottom") {
      top = targetRect.bottom + margin;
      left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
    } else if (pos === "top") {
      top = targetRect.top - popoverHeight - margin;
      left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
    } else if (pos === "right") {
      top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
      left = targetRect.right + margin;
    } else if (pos === "left") {
      top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
      left = targetRect.left - popoverWidth - margin;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

    return {
      position: "fixed",
      top,
      left,
      width: popoverWidth,
      zIndex: 201,
    };
  })();

  return (
    <>
      {targetRect ? <div style={spotlightStyle} aria-hidden="true" /> : null}
      <div className="expTour" style={popoverStyle} role="dialog" aria-label="Tutorial guiado">
        <div className="expTourHeader">
          <div className="expTourBadge">
            <Sparkles size={12} /> Paso {currentStep + 1} de {steps.length}
          </div>
          <button
            type="button"
            className="expTourClose"
            onClick={onClose}
            aria-label="Cerrar tutorial"
          >
            <X size={16} />
          </button>
        </div>
        <div className="expTourBody">
          <h3 className="expTourTitle">{step.title}</h3>
          <p className="expTourContent">{step.content}</p>
          {step.action ? <p className="expTourAction">{step.action}</p> : null}
        </div>
        <div className="expTourFooter">
          <div className="expTourProgress" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`expTourDot ${i <= currentStep ? "active" : ""}`}
              />
            ))}
          </div>
          <div className="expTourActions">
            {!isFirst ? (
              <button
                type="button"
                className="expBtn expBtn-ghost expBtn-small"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
            ) : null}
            {isLast ? (
              <button
                type="button"
                className="expBtn expBtn-primary expBtn-small"
                onClick={() => {
                  onComplete?.();
                  onClose();
                }}
              >
                Finalizar <Sparkles size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="expBtn expBtn-primary expBtn-small"
                onClick={() => setCurrentStep((s) => s + 1)}
              >
                Siguiente <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const TOUR_KEY = "exp-tour-completed-v1";

export function useTour(steps: TourStep[], storageKey = TOUR_KEY) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const completed = window.localStorage.getItem(storageKey);
      if (!completed) {
        const timer = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, [storageKey]);

  const complete = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // Ignorar
    }
  }, [storageKey]);

  const restart = useCallback(() => {
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, close, complete, restart, Tour: OnboardingTour, steps };
}

export function TourTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="expTourTrigger"
      onClick={onClick}
      title="Ver tutorial"
      aria-label="Ver tutorial guiado"
    >
      <HelpCircle size={14} /> Tutorial
    </button>
  );
}
