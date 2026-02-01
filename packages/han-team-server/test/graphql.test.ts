/**
 * GraphQL API Tests
 *
 * Tests for the GraphQL schema, handler, and type definitions.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { printSchema, lexicographicSortSchema } from "graphql";
import { schema } from "../lib/graphql/schema.ts";
import { getApiInfo } from "../lib/graphql/types/api-info.ts";

describe("GraphQL Schema", () => {
  it("should build a valid schema", () => {
    expect(schema).toBeDefined();
    expect(schema.getQueryType()).toBeDefined();
    expect(schema.getMutationType()).toBeDefined();
  });

  it("should have all expected types", () => {
    const typeMap = schema.getTypeMap();

    // Core entity types
    expect(typeMap.User).toBeDefined();
    expect(typeMap.Team).toBeDefined();
    expect(typeMap.Organization).toBeDefined();
    expect(typeMap.Session).toBeDefined();

    // Enum types
    expect(typeMap.SessionStatus).toBeDefined();
    expect(typeMap.SessionVisibility).toBeDefined();
    expect(typeMap.TeamMemberRole).toBeDefined();
    expect(typeMap.OrgMemberRole).toBeDefined();
    expect(typeMap.BillingPlan).toBeDefined();
    expect(typeMap.ErrorCode).toBeDefined();

    // Error types
    expect(typeMap.BaseError).toBeDefined();
    expect(typeMap.AuthError).toBeDefined();
    expect(typeMap.ValidationError).toBeDefined();
    expect(typeMap.FieldError).toBeDefined();

    // API info type
    expect(typeMap.ApiInfo).toBeDefined();
  });

  it("should have descriptions on all types", () => {
    const typeMap = schema.getTypeMap();

    // Check that user-defined types have descriptions
    const userTypes = Object.entries(typeMap).filter(
      ([name]) => !name.startsWith("__") && !["String", "Int", "Float", "Boolean", "ID"].includes(name)
    );

    for (const [name, type] of userTypes) {
      // Skip PageInfo and connection types from Relay plugin
      if (name === "PageInfo" || name.endsWith("Connection") || name.endsWith("Edge")) {
        continue;
      }

      expect(type.description, `Type ${name} should have a description`).toBeDefined();
    }
  });

  it("should export schema as SDL", () => {
    const sortedSchema = lexicographicSortSchema(schema);
    const sdl = printSchema(sortedSchema);

    expect(sdl).toContain("type Query");
    expect(sdl).toContain("type Mutation");
    expect(sdl).toContain("type User");
    expect(sdl).toContain("type Session");

    // Check for descriptions in SDL
    expect(sdl).toContain('"""');
  });
});

describe("GraphQL Query", () => {
  it("should have apiInfo query", () => {
    const queryType = schema.getQueryType();
    expect(queryType).toBeDefined();

    const fields = queryType!.getFields();
    expect(fields.apiInfo).toBeDefined();
    expect(fields.apiInfo.description).toBeDefined();
  });

  it("should have me query for current user", () => {
    const queryType = schema.getQueryType();
    const fields = queryType!.getFields();

    expect(fields.me).toBeDefined();
    expect(fields.me.description).toContain("authenticated user");
  });

  it("should have organization query with id argument", () => {
    const queryType = schema.getQueryType();
    const fields = queryType!.getFields();

    expect(fields.organization).toBeDefined();
    expect(fields.organization.args).toHaveLength(1);
    expect(fields.organization.args[0].name).toBe("id");
    expect(fields.organization.args[0].description).toBeDefined();
  });

  it("should have team query with id argument", () => {
    const queryType = schema.getQueryType();
    const fields = queryType!.getFields();

    expect(fields.team).toBeDefined();
    expect(fields.team.args).toHaveLength(1);
    expect(fields.team.args[0].name).toBe("id");
  });

  it("should have session query with id argument", () => {
    const queryType = schema.getQueryType();
    const fields = queryType!.getFields();

    expect(fields.session).toBeDefined();
    expect(fields.session.args).toHaveLength(1);
    expect(fields.session.args[0].name).toBe("id");
  });
});

describe("GraphQL Mutation", () => {
  it("should have updateSessionVisibility mutation (deprecated)", () => {
    const mutationType = schema.getMutationType();
    expect(mutationType).toBeDefined();

    const fields = mutationType!.getFields();
    expect(fields.updateSessionVisibility).toBeDefined();
    expect(fields.updateSessionVisibility.deprecationReason).toContain("updateSessionSharing");
  });
});

describe("ApiInfo", () => {
  it("should return correct info for development", () => {
    const info = getApiInfo("development");

    expect(info.version).toBe("0.1.0");
    expect(info.environment).toBe("development");
    expect(info.introspectionEnabled).toBe(true);
    expect(info.features).toContain("playground");
  });

  it("should return correct info for production", () => {
    const info = getApiInfo("production");

    expect(info.version).toBe("0.1.0");
    expect(info.environment).toBe("production");
    expect(info.introspectionEnabled).toBe(false);
    expect(info.features).not.toContain("playground");
  });

  it("should have core features in all environments", () => {
    for (const env of ["development", "staging", "production"] as const) {
      const info = getApiInfo(env);

      expect(info.features).toContain("sessions");
      expect(info.features).toContain("teams");
      expect(info.features).toContain("organizations");
      expect(info.features).toContain("analytics");
    }
  });
});

describe("Error Types", () => {
  it("should have all error codes defined", () => {
    const errorCodeType = schema.getType("ErrorCode");
    expect(errorCodeType).toBeDefined();

    // biome-ignore lint: Type assertion is safe here
    const enumType = errorCodeType as any;
    const values = enumType.getValues().map((v: any) => v.name);

    expect(values).toContain("UNAUTHENTICATED");
    expect(values).toContain("INVALID_TOKEN");
    expect(values).toContain("INSUFFICIENT_PERMISSIONS");
    expect(values).toContain("NOT_FOUND");
    expect(values).toContain("ALREADY_EXISTS");
    expect(values).toContain("VALIDATION_ERROR");
    expect(values).toContain("INVALID_INPUT");
    expect(values).toContain("RATE_LIMITED");
    expect(values).toContain("INTERNAL_ERROR");
    expect(values).toContain("SERVICE_UNAVAILABLE");
  });

  it("should have descriptions on all error codes", () => {
    const errorCodeType = schema.getType("ErrorCode");
    // biome-ignore lint: Type assertion is safe here
    const enumType = errorCodeType as any;

    for (const value of enumType.getValues()) {
      expect(value.description, `Error code ${value.name} should have a description`).toBeDefined();
    }
  });
});
