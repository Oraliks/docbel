import { describe, expect, it } from "vitest";
import {
  assertStagingDatabaseTarget,
  assertStagingStorageTargets,
  getAppEnvironment,
} from "@/lib/config/runtime-environment";

const stagingEnv = {
  APP_ENV: "staging",
  APP_DATABASE_TARGET: "ep-stage.eu-central-1.aws.neon.tech",
  APP_PRODUCTION_DATABASE_TARGET: "ep-prod.eu-central-1.aws.neon.tech",
  DATABASE_URL: "postgresql://app:secret@ep-stage-pooler.eu-central-1.aws.neon.tech/docbel?sslmode=require",
  DIRECT_URL: "postgresql://app:secret@ep-stage.eu-central-1.aws.neon.tech/docbel?sslmode=require",
};

describe("runtime environment identity", () => {
  it("accepts only an explicit supported environment", () => {
    expect(getAppEnvironment({ APP_ENV: "staging" })).toBe("staging");
    expect(getAppEnvironment({})).toBeNull();
    expect(() => getAppEnvironment({ APP_ENV: "preview" })).toThrow(/APP_ENV/);
  });

  it("accepts matching pooled and direct staging targets", () => {
    expect(() => assertStagingDatabaseTarget(stagingEnv)).not.toThrow();
  });

  it("rejects a mismatched direct URL or a production target", () => {
    expect(() =>
      assertStagingDatabaseTarget({
        ...stagingEnv,
        DIRECT_URL: "postgresql://app:secret@ep-prod.eu-central-1.aws.neon.tech/docbel",
      }),
    ).toThrow(/same staging database/);
    expect(() =>
      assertStagingDatabaseTarget({
        ...stagingEnv,
        APP_DATABASE_TARGET: stagingEnv.APP_PRODUCTION_DATABASE_TARGET,
      }),
    ).toThrow(/isolated target identity/);
  });

  it("fails closed when the staging database identity is incomplete", () => {
    expect(() => assertStagingDatabaseTarget({ APP_ENV: "staging" })).toThrow(/must be configured/);
  });

  it("requires four distinct public and private staging/production stores", () => {
    const stores = {
      APP_ENV: "staging",
      APP_PUBLIC_BLOB_STORE_ID: "public-stage",
      APP_PRIVATE_BLOB_STORE_ID: "private-stage",
      APP_PRODUCTION_PUBLIC_BLOB_STORE_ID: "public-prod",
      APP_PRODUCTION_PRIVATE_BLOB_STORE_ID: "private-prod",
    };
    expect(() => assertStagingStorageTargets(stores)).not.toThrow();
    expect(() =>
      assertStagingStorageTargets({ ...stores, APP_PRIVATE_BLOB_STORE_ID: "public-prod" }),
    ).toThrow(/distinct/);
    expect(() => assertStagingStorageTargets({ APP_ENV: "staging" })).toThrow(/must be configured/);
  });
});
