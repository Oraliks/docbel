async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !/^(--apply|--dry-run|--max-files=\d+|--batch-size=\d+)$/.test(arg)) ||
      (args.includes("--apply") && args.includes("--dry-run"))) {
    throw new Error("Usage: migrate-private-blobs.ts [--dry-run|--apply] [--max-files=500] [--batch-size=100]");
  }
  const { migratePrivateBlobs } = await import("../lib/storage/private-blob-migration");
  const { prisma } = await import("../lib/prisma");
  try {
    const result = await migratePrivateBlobs({
      apply: args.includes("--apply"),
      maxFiles: Number(args.find((arg) => arg.startsWith("--max-files="))?.split("=")[1] ?? 500),
      batchSize: Number(args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? 100),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.cleanupPending || result.groups.some((group) => !["ready", "migrated"].includes(group.status))) {
      process.exitCode = 2;
    }
  } finally { await prisma.$disconnect(); }
}

main().catch(() => {
  // SDK/DB errors may contain URLs or connection details. Never echo them.
  console.error("Private Blob migration failed; no sensitive error details logged.");
  process.exitCode = 1;
});
