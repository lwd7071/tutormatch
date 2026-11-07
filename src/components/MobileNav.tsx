"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type NavItem = {
  label: string;
  href: string;
  icon:
    | "home"
    | "search"
    | "book"
    | "calendar"
    | "chat"
    | "users"
    | "shield"
    | "money"
    | "help"
    | "account"
    | "more";
};

function Icon({ name }: { name: NavItem["icon"] }) {
  const paths: Record<NavItem["icon"], React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    book: (
      <>
        <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1z" />
        <path d="M12 6v14" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 15h3" />
      </>
    ),
    chat: (
      <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-5 3V5a1 1 0 0 1 1-1z" />
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2zM17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M5 9h1M18 15h1" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function MobileNav({
  items,
  activeHref,
  moreItems = [],
}: {
  items: NavItem[];
  activeHref: string;
  moreItems?: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const moreActive = moreItems.some((item) => item.href === activeHref);
  return (
    <>
      {open && (
        <div
          className="mobile-more-backdrop"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
          aria-hidden="true"
        />
      )}
      {open && (
        <div
          ref={dialog}
          className="mobile-more"
          role="dialog"
          aria-modal="true"
          aria-label="Các mục khác"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls =
              dialog.current?.querySelectorAll<HTMLElement>("a, button");
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="mobile-more-heading">
            <strong>Các mục khác</strong>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
              aria-label="Đóng menu"
            >
              ×
            </button>
          </div>
          {moreItems.map((item, index) => (
            <Link
              key={item.href}
              ref={index === 0 ? firstItem : undefined}
              href={item.href}
              aria-current={item.href === activeHref ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
      <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
        {items.map((item) =>
          item.icon === "more" ? (
            <button
              key="more"
              ref={trigger}
              type="button"
              className={moreActive || open ? "active" : ""}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen((value) => !value)}
            >
              <Icon name="more" />
              <span>Thêm</span>
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === activeHref ? "active" : ""}
              aria-current={item.href === activeHref ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
