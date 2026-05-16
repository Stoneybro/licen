// @ts-nocheck
import { default as __fd_glob_22 } from "../content/docs/user-guide/meta.json?collection=meta"
import { default as __fd_glob_21 } from "../content/docs/resources/meta.json?collection=meta"
import { default as __fd_glob_20 } from "../content/docs/developer-guide/meta.json?collection=meta"
import { default as __fd_glob_19 } from "../content/docs/architecture/meta.json?collection=meta"
import { default as __fd_glob_18 } from "../content/docs/meta.json?collection=meta"
import * as __fd_glob_17 from "../content/docs/user-guide/data-providers.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/user-guide/ai-researchers.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/resources/troubleshooting.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/resources/smart-contracts.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/developer-guide/smart-contracts.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/developer-guide/orchestrator.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/developer-guide/local-setup.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/developer-guide/indexer.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/developer-guide/deployment.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/architecture/trust-model.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/architecture/system-overview.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/architecture/key-exchange.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/architecture/data-lifecycle.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/why-0g.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/how-it-works.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/business-model.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.doc("docs", "content/docs", {"business-model.mdx": __fd_glob_0, "how-it-works.mdx": __fd_glob_1, "index.mdx": __fd_glob_2, "quickstart.mdx": __fd_glob_3, "why-0g.mdx": __fd_glob_4, "architecture/data-lifecycle.mdx": __fd_glob_5, "architecture/key-exchange.mdx": __fd_glob_6, "architecture/system-overview.mdx": __fd_glob_7, "architecture/trust-model.mdx": __fd_glob_8, "developer-guide/deployment.mdx": __fd_glob_9, "developer-guide/indexer.mdx": __fd_glob_10, "developer-guide/local-setup.mdx": __fd_glob_11, "developer-guide/orchestrator.mdx": __fd_glob_12, "developer-guide/smart-contracts.mdx": __fd_glob_13, "resources/smart-contracts.mdx": __fd_glob_14, "resources/troubleshooting.mdx": __fd_glob_15, "user-guide/ai-researchers.mdx": __fd_glob_16, "user-guide/data-providers.mdx": __fd_glob_17, });

export const meta = await create.meta("meta", "content/docs", {"meta.json": __fd_glob_18, "architecture/meta.json": __fd_glob_19, "developer-guide/meta.json": __fd_glob_20, "resources/meta.json": __fd_glob_21, "user-guide/meta.json": __fd_glob_22, });