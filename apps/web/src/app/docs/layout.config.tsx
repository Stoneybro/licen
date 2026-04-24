import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export const docsLayoutConfig: BaseLayoutProps = {
  nav: {
    title: (
      <span className="inline-flex items-center gap-2">
        <Image
          src="/licen-logo-light.svg"
          alt="LICEN"
          width={22}
          height={14}
          priority
        />
        <span className="font-semibold tracking-[0.2em]">LICEN Docs</span>
      </span>
    ),
    url: "/docs",
  },
  links: [
    {
      text: "Back to Home",
      url: "/",
      external: true,
    },
  ],
};
