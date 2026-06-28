import { defaultMagnexisConfig, loadMagnexisConfigFromWorkspace, type MagnexisConfig } from "../../config/src/index";

export interface IndexerConfig {
  ignore: string[];
  maxFiles: number;
  enabled: boolean;
}

export interface IndexedFileSummary {
  path: string;
  ignored: boolean;
}

export const defaultIndexerConfig: IndexerConfig = {
  ignore: [...defaultMagnexisConfig.indexing.ignore, ".next", "coverage", "vendor"],
  maxFiles: 5000,
  enabled: true
};

export function resolveIndexerConfig(workspaceRoot: string): IndexerConfig {
  const project = loadMagnexisConfigFromWorkspace(workspaceRoot);
  return mergeIndexerConfig(project);
}

export function mergeIndexerConfig(config: MagnexisConfig): IndexerConfig {
  return {
    ignore: uniqueStrings([
      ...defaultIndexerConfig.ignore,
      ...config.indexing.ignore
    ]),
    maxFiles: Math.max(1, config.context.maxFiles),
    enabled: config.indexing.enabled
  };
}

export function shouldIgnorePath(pathname: string, ignoreList: string[] = defaultIndexerConfig.ignore): boolean {
  const normalized = pathname.replace(/\\/g, "/");
  return ignoreList.some((entry) => normalized.includes(entry));
}

export function summarizeIndexedPaths(paths: string[], ignoreList: string[] = defaultIndexerConfig.ignore): IndexedFileSummary[] {
  return paths.map((filePath) => ({
    path: filePath,
    ignored: shouldIgnorePath(filePath, ignoreList)
  }));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
