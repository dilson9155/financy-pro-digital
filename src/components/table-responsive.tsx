"use client";

import { useEffect, useRef } from "react";

/**
 * Client wrapper used by <Table>. On phones the CSS in globals.css turns the
 * table into a stack of cards; to keep the values self-explanatory we label
 * every cell with the text of its column header. This is done at runtime so
 * every list in the app becomes mobile friendly without per-view code.
 */
export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return;

    const decorate = () => {
      const heads = Array.from(table.querySelectorAll("thead th"));
      if (heads.length === 0) return;

      const labels = heads.map((head) =>
        (head.textContent ?? "").replace(/\s+/g, " ").trim(),
      );

      table.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          if (cell.tagName !== "TD") return;
          const td = cell as HTMLElement;

          const header = labels[index] ?? "";
          const text = (td.textContent ?? "").trim();
          const hasControls = td.querySelector(
            "button, a[href], input, select, textarea, [role='button']",
          );

          // A cell is "plain" (no label, full width) when it has no header or
          // when it only holds action controls (buttons/links with no text).
          const isPlain = !header || (!text && Boolean(hasControls));

          if (isPlain) {
            td.classList.add("rt-plain");
            delete td.dataset.label;
          } else {
            td.classList.remove("rt-plain");
            td.dataset.label = header;
          }
        });
      });
    };

    decorate();

    // Rows change on filters/pagination, so re-decorate when the table mutates.
    const observer = new MutationObserver(decorate);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className="rt-table w-full caption-bottom text-sm">
        {children}
      </table>
    </div>
  );
}
