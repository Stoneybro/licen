"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Navigation() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/70">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 text-foreground">
          <Image
            src="/licen-logo-light.svg"
            alt="LICEN"
            width={22}
            height={14}
            priority
          />
          <span className="font-bold text-[16px] tracking-[0.2em] sm:tracking-[0.3em]">LICEN</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[12px] font-medium text-muted-foreground">
          <a href="#problem" className="hover:text-foreground transition-colors">Problem</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#policy" className="hover:text-foreground transition-colors">Policy</a>
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#tech" className="hover:text-foreground transition-colors">Stack</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/docs" className="hidden sm:inline-flex text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </Link>
          <Link
            href="/login?returnTo=/app/catalog"
            className="hidden md:inline-flex items-center h-8 px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Catalog
          </Link>
          <Link
            href="/login?returnTo=/app"
            className="inline-flex items-center h-8 px-3 text-[12px] font-medium border border-border text-foreground hover:border-foreground/60 transition-colors"
          >
            Launch app →
          </Link>
        </div>
      </div>
    </header>
  );
}
