import { adaptRawSource, type RawSource } from "./opportunity-source-adapter.js";
import { RemoteOkSource } from "./remoteok-source.js";
import { RemotiveSource } from "./remotive-source.js";

export function createDefaultPublicSources(): readonly { readonly name: string; discover(): Promise<readonly import("../domain/opportunity.js").Opportunity[]> }[] {
  const sources: readonly RawSource[] = [new RemoteOkSource(), new RemotiveSource()];
  return sources.map(adaptRawSource);
}
