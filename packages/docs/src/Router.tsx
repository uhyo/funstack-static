"use client";

import { Router as FunStackRotuter, type RouterProps } from "@funstack/router";
import { useEffect } from "react";

export const Router: React.FC<RouterProps> = (props) => {
  // Auto scroll to top - this should be handled by the browser per spec,
  // but currently Chrome and Safari do not follow the spec.
  useEffect(() => {
    // @ts-expect-error -- TypeScript does not yet know about the Navigation API
    const navigation = window.navigation;
    if (!navigation) {
      return;
    }
    const controller = new AbortController();
    navigation.addEventListener(
      "navigatesuccess",
      () => {
        const transition = navigation.transition;
        if (
          transition.navigationType === "push" ||
          transition.navigationType === "replace"
        ) {
          // Safari is known to ignore scrolling immediately after a push/replace navigation, so we wait a bit
          // Also, Safari doesn't handle scrolling to 0, so we use the -1 trick
          setTimeout(() => {
            window.scrollTo(0, -1);
          }, 10);
        }
      },
      { signal: controller.signal },
    );
    return () => {
      controller.abort();
    };
  }, []);
  return <FunStackRotuter {...props} />;
};
