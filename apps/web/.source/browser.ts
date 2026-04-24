// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"architecture.mdx": () => import("../content/docs/architecture.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "protocol-overview.mdx": () => import("../content/docs/protocol-overview.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), }),
};
export default browserCollections;