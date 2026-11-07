"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const reveals = ".how-section .section-heading, .steps > div, .match-request-section .wrap, .help-guide, .help-callout, .tutor-card";

export function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    if (!window.IntersectionObserver || !Element.prototype.animate) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const stars = new Set<HTMLElement>();
    const visibleStars = new Set<HTMLElement>();
    const play = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
      if (reduced.matches || document.hidden) return;
      const animation = element.animate(frames, {
        duration, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
      animations.add(animation);
      animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    };
    const sync = () => {
      stars.forEach(star => {
        star.dataset.motionActive = String(!reduced.matches && !document.hidden && visibleStars.has(star));
      });
      if (reduced.matches || document.hidden) animations.forEach(animation => animation.cancel());
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        if (element.matches(".hero-star")) {
          if (entry.isIntersecting) visibleStars.add(element);
          else visibleStars.delete(element);
          sync();
          if (entry.isIntersecting && !seen.has(element)) {
            seen.add(element);
            const artwork = element.querySelector("svg");
            if (artwork) play(artwork, [{ transform: "rotate(-12deg) scale(.94)" }, { transform: "rotate(0) scale(1)" }], 650);
          }
        } else if (entry.isIntersecting) {
          observer.unobserve(element);
          const index = element.matches(".tutor-card") && element.parentElement
            ? Array.from(element.parentElement.children).indexOf(element) : 0;
          play(element, [{ opacity: .35, transform: "translateY(12px)" }, { opacity: 1, transform: "translateY(0)" }], 400, Math.min(index * 45, 180));
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
    const register = (root: Element) => {
      const elements = [root, ...root.querySelectorAll(`${reveals}, .hero-star`)];
      elements.forEach(element => {
        if (element.matches(".hero-star")) {
          stars.add(element as HTMLElement);
          observer.observe(element);
        } else if (element.matches(reveals) && !seen.has(element)) {
          seen.add(element);
          observer.observe(element);
        }
      });
    };
    register(document.body);
    const mutations = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "attributes") {
          const element = record.target as Element;
          if (element.matches(".save-button")) {
            animations.forEach(animation => { if ((animation.effect as KeyframeEffect)?.target === element) animation.cancel(); });
            play(element, [{ transform: "scale(.94)" }, { transform: "scale(1)" }], 180);
          }
          return;
        }
        record.removedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          [node, ...node.querySelectorAll(`${reveals}, .hero-star`)].forEach(element => {
            observer.unobserve(element);
            stars.delete(element as HTMLElement);
            visibleStars.delete(element as HTMLElement);
          });
        });
        record.addedNodes.forEach(node => { if (node instanceof Element) register(node); });
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      animations.forEach(animation => animation.cancel());
      stars.forEach(star => delete star.dataset.motionActive);
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pathname]);
  return null;
}
