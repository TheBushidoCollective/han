export interface BlueprintMetadata {
  name: string;
  summary: string;
}

export interface Blueprint extends BlueprintMetadata {
  content: string;
}

export interface SearchBlueprintsResult {
  blueprints: BlueprintMetadata[];
}

export interface ReadBlueprintResult extends Blueprint {}

export interface WriteBlueprintResult {
  success: boolean;
  message: string;
}
