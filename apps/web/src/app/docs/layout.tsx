import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

import "fumadocs-ui/style.css";

import { source } from "@/lib/source";
import { docsLayoutConfig } from "./layout.config";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.pageTree} {...docsLayoutConfig}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
