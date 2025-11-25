"use client";

import { useEffect, useRef } from "react";

interface SidebarScrollContainerProps {
  children: React.ReactNode;
}

export default function SidebarScrollContainer({
  children,
}: SidebarScrollContainerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore scroll position on mount
    const savedScrollPos = sessionStorage.getItem("sidebarScrollPos");
    if (savedScrollPos && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = parseInt(savedScrollPos, 10);
    }

    // Save scroll position on scroll
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem(
          "sidebarScrollPos",
          scrollContainerRef.current.scrollTop.toString(),
        );
      }
    };

    const scrollContainer = scrollContainerRef.current;
    scrollContainer?.addEventListener("scroll", handleScroll);

    return () => {
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-2 scrollbar-custom"
    >
      {children}
    </div>
  );
}
