import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const entries = ['lib/baremes-autonome', 'components/admin/baremes-autonome', 'app/admin/baremes-autonome', 'app/api/admin/baremes-autonome']
function files(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? e.name === '__tests__' ? [] : files(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [])
}
describe('independent runtime boundary', () => {
  it('walks resolved transitive imports and rejects historical business, APIs and effects', () => {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options
    const visited = new Set<string>()
    const walk = (relative: string) => {
      const absolute = path.resolve(root, relative).replaceAll('\\', '/')
      if (visited.has(absolute) || absolute.includes('/node_modules/')) return
      visited.add(absolute)
      expect(absolute).not.toMatch(/\/lib\/(baremes(?:\/|-parser)|chomage\/params|calculators\/chomage)/)
      const source = fs.readFileSync(absolute, 'utf8')
      expect(source).not.toMatch(/\/api\/baremes(?:\/|["'`])|prisma\.(?:bareme\w*|bareSheet)\b|(?:revalidateTag|revalidatePath|publishEvent)\s*\(/i)
      const file = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        let specifier: ts.Expression | undefined
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(file) === 'require')) specifier = node.arguments[0]
        if (specifier && ts.isStringLiteral(specifier)) {
          const resolved = ts.resolveModuleName(specifier.text, absolute, options, ts.sys).resolvedModule?.resolvedFileName
          if (resolved && !resolved.includes('node_modules')) walk(resolved)
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
    }
    entries.flatMap(files).forEach(walk)
    expect(visited.size).toBeGreaterThan(15)
  })
  it('creates only dedicated tables, with dedicated binary originals and no legacy foreign keys', () => {
    const sql = fs.readFileSync('prisma/migrations/20261024120000_autonomous_rates/migration.sql', 'utf8')
    expect(sql).not.toMatch(/^\s*(?:DROP|ALTER|DELETE|TRUNCATE)\s/im)
    for (const match of sql.matchAll(/(?:TABLE|REFERENCES|INTO)\s+"([^"]+)"/g)) expect(match[1]).toMatch(/^AutonomousRate/)
    expect(sql).toContain('"original" BYTEA NOT NULL')
    const service = fs.readFileSync('lib/baremes-autonome/service.ts', 'utf8')
    expect(service).not.toMatch(/saveBlob|deleteBlob|fetch\(|revalidate|writeFile|unlink|baremeFile/)
    expect(fs.readFileSync('next.config.ts', 'utf8')).toContain("'./lib/baremes-autonome/__tests__/**'")
  })
})
