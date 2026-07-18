"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="w-full bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/send" className="font-semibold text-base text-zinc-950 tracking-tight">
          Private Emailer
        </Link>

        {/* Two Navigation Links */}
        <nav className="flex gap-6">
          <Link
            href="/send"
            className={cn(
              "text-sm font-medium transition-colors py-1.5 px-2 rounded-lg",
              pathname === "/send" || pathname === "/"
                ? "text-zinc-950 bg-zinc-100 font-semibold"
                : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            Send Email
          </Link>
          <Link
            href="/feedback"
            className={cn(
              "text-sm font-medium transition-colors py-1.5 px-2 rounded-lg",
              pathname === "/feedback"
                ? "text-zinc-950 bg-zinc-100 font-semibold"
                : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            Feedback
          </Link>
        </nav>
      </div>
    </header>
  );
}
