// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"business-model.mdx": () => import("../content/docs/business-model.mdx?collection=docs"), "how-it-works.mdx": () => import("../content/docs/how-it-works.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), "why-0g.mdx": () => import("../content/docs/why-0g.mdx?collection=docs"), "architecture/data-lifecycle.mdx": () => import("../content/docs/architecture/data-lifecycle.mdx?collection=docs"), "architecture/key-exchange.mdx": () => import("../content/docs/architecture/key-exchange.mdx?collection=docs"), "architecture/system-overview.mdx": () => import("../content/docs/architecture/system-overview.mdx?collection=docs"), "developer-guide/deployment.mdx": () => import("../content/docs/developer-guide/deployment.mdx?collection=docs"), "developer-guide/indexer.mdx": () => import("../content/docs/developer-guide/indexer.mdx?collection=docs"), "developer-guide/local-setup.mdx": () => import("../content/docs/developer-guide/local-setup.mdx?collection=docs"), "developer-guide/orchestrator.mdx": () => import("../content/docs/developer-guide/orchestrator.mdx?collection=docs"), "developer-guide/smart-contracts.mdx": () => import("../content/docs/developer-guide/smart-contracts.mdx?collection=docs"), "resources/smart-contracts.mdx": () => import("../content/docs/resources/smart-contracts.mdx?collection=docs"), "resources/troubleshooting.mdx": () => import("../content/docs/resources/troubleshooting.mdx?collection=docs"), "user-guide/ai-researchers.mdx": () => import("../content/docs/user-guide/ai-researchers.mdx?collection=docs"), "user-guide/data-providers.mdx": () => import("../content/docs/user-guide/data-providers.mdx?collection=docs"), }),
};
export default browserCollections;