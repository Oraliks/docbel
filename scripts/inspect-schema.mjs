import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const tool = await prisma.tool.findUnique({
  where: { id: "cmp48unp4000c13p5q9hhv9r1" },
  include: { documentTemplate: { select: { schema: true, id: true } } },
});
if (tool?.documentTemplate?.schema) {
  const schema = tool.documentTemplate.schema;
  console.log("Number of fields:", schema.length);
  for (const f of schema) {
    console.log(JSON.stringify({ label: f.label, type: f.type, position: f.position }));
  }
}
await prisma.$disconnect();
