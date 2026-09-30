// @ts-nocheck
// scaffold-game.ts
// Custom Zoo tool: generate a new game skeleton from the "Adding a new game"
// checklist in .roorules — one folder + one GAME_REGISTRY entry, nothing else.
//
// It mirrors an existing, clean template game folder (default `game-12`, which
// is the boilerplate-only skeleton), rewrites every identity token to the new
// game's, and appends exactly one registry entry with an auto-picked unused
// opaque 5-digit route. main.jsx and GAME_CATALOG are never touched: both derive
// from the registry.
//
// Safety: additive only. It refuses to run if the target folder already exists
// or if the key / slug / route / label would collide with an existing game.
// It never commits and never pushes.

//@ts-ignore provided by the Zoo runtime, not resolvable from the app tsconfig
import { parametersSchema as z, defineCustomTool } from "@roo-code/types"
//@ts-ignore node builtins exist at runtime
import { promises as fs } from "fs"
//@ts-ignore node builtins exist at runtime
import path from "path"

// Card palettes, rotated by game number so a new card does not clash with a
// neighbour. Mirrors the shape every existing registry meta uses.
const PALETTES = [
  { hue: "#8B5CF6", tint: "#F3F0FF", gradient: "linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 55%, #6D28D9 100%)", ring: "ring-[#DDD6FE]" },
  { hue: "#10B981", tint: "#ECFDF5", gradient: "linear-gradient(135deg, #6EE7B7 0%, #10B981 55%, #047857 100%)", ring: "ring-[#A7F3D0]" },
  { hue: "#0EA5E9", tint: "#E0F2FE", gradient: "linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 55%, #0369A1 100%)", ring: "ring-[#BAE6FD]" },
  { hue: "#FB7185", tint: "#FFF0F2", gradient: "linear-gradient(135deg, #FDA4AF 0%, #FB7185 55%, #BE123C 100%)", ring: "ring-[#FECDD3]" },
  { hue: "#F59E0B", tint: "#FFF7E6", gradient: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 55%, #B45309 100%)", ring: "ring-[#FDE68A]" },
  { hue: "#34D399", tint: "#EEFCF6", gradient: "linear-gradient(135deg, #A7EE7E 0%, #4DD4A6 55%, #2CB5D2 100%)", ring: "ring-[#DCF8C6]" },
]

const EMOJIS = ["\u2728", "\uD83D\uDE80", "\uD83C\uDFAF", "\uD83E\uDDE9", "\uD83C\uDF1F", "\uD83C\uDFA8", "\uD83D\uDC23", "\uD83C\uDF40"]

// Files that are template-only and must never be copied into a new game.
const SKIP_DIRS = new Set(["dev-backup", "node_modules", ".git"])

type Tokens = { slug: string; spaced: string; camel: string; pascal: string; number: string }

/** Derive the four identity spellings a game folder uses from its slug. */
function deriveTokens(slug: string): Tokens {
  const words = slug.split(/[-_]+/).filter(Boolean)
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
  const spaced = words.map(cap).join(" ")
  const camel = words.map((w, i) => (i === 0 ? w : cap(w))).join("")
  const pascal = words.map(cap).join("")
  const numMatch = slug.match(/(\d+)/)
  return { slug, spaced, camel, pascal, number: numMatch ? numMatch[1] : "" }
}

/** Replace every occurrence of a literal (no regex escaping headaches). */
function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack
  return haystack.split(needle).join(replacement)
}

/** Rewrite all identity tokens in one file's contents. Order avoids re-matching. */
function rewrite(content: string, from: Tokens, to: Tokens): string {
  let out = content
  // slug first ('game-12' -> 'game-14'); the camel/pascal forms can't occur
  // inside the hyphenated form, so ordering is mainly belt-and-braces.
  out = replaceAll(out, from.slug, to.slug)
  out = replaceAll(out, from.camel, to.camel)
  out = replaceAll(out, from.spaced, to.spaced)
  out = replaceAll(out, from.pascal, to.pascal)
  // Guard the bare-number JSX attribute explicitly; never touch bare numbers
  // (font sizes, timings) elsewhere.
  if (from.number && to.number) {
    out = replaceAll(out, `gameNumber={${from.number}}`, `gameNumber={${to.number}}`)
  }
  return out
}

/** Recursively list text files under a folder, skipping template-only paths. */
async function collectFiles(dir: string, base: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    if (/\.test\.(js|jsx|ts|tsx)$/.test(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, base)))
    } else {
      out.push(path.relative(base, full))
    }
  }
  return out
}

export default defineCustomTool({
  name: "scaffold_game",
  description:
    "Generate a new game skeleton: clones a template game folder (default game-12) rewriting every " +
    "identity token to the new game, then appends ONE GAME_REGISTRY entry with an auto-picked unused " +
    "opaque 5-digit route. main.jsx and GAME_CATALOG are never touched (both derive from the registry). " +
    "Additive only: refuses to run if the folder exists or the key/slug/route/label would collide. " +
    "Never commits or pushes.",
  parameters: z.object({
    gameNumber: z.number().int().positive().describe("Numeric game id, e.g. 14. Drives the key and default slug."),
    slug: z.string().optional().describe("Folder under src/games/. Defaults to 'game-<gameNumber>'."),
    title: z.string().optional().describe("Card + gate label. Defaults to 'Game <N> (Coming Soon)'."),
    route: z.string().optional().describe("Opaque 5-digit route like '/84037'. If omitted, an unused one is picked."),
    term: z.number().int().positive().optional().describe("Academic term id. Defaults to 4."),
    kind: z.enum(["phaser", "react"]).optional().describe("'phaser' (default) clones a template folder; 'react' emits a single-component skeleton."),
    templateSlug: z.string().optional().describe("Existing game folder to mirror. Defaults to 'game-12'."),
    emoji: z.string().optional().describe("Card emoji. Defaults to a rotated pick."),
    category: z.string().optional().describe("Optional one-line note describing the game's category, stored only in the generated comment."),
    dryRun: z.boolean().optional().describe("When true, report what would happen without writing anything."),
  }),
  async execute(args: any, context: any) {
    const say = (message: string) => {
      //@ts-ignore task.say exists at runtime
      try { context?.task?.say?.("custom_tool", message) } catch { /* noop */ }
    }

    //@ts-ignore process is provided by the Node runtime
    const repoRoot: string = (context as any)?.task?.cwd ?? process.cwd()
    const gameNumber = Number(args.gameNumber)
    if (!Number.isInteger(gameNumber) || gameNumber <= 0) {
      return "Error: gameNumber must be a positive integer."
    }

    const slug = (args.slug || `game-${gameNumber}`).trim()
    const title = (args.title || `Game ${gameNumber} (Coming Soon)`).trim()
    const term = args.term ?? 4
    const kind = args.kind ?? "phaser"
    const dryRun = args.dryRun === true
    const templateSlug = (args.templateSlug || "game-12").trim()

    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      return `Error: slug '${slug}' must be lowercase kebab-case (letters, digits, hyphens).`
    }

    const from = deriveTokens(templateSlug)
    const to = deriveTokens(slug)

    const registryPath = path.join(repoRoot, "src", "games", "registry.js")
    const destDir = path.join(repoRoot, "src", "games", slug)
    const templateDir = path.join(repoRoot, "src", "games", templateSlug)

    // ---- Read + validate the registry -------------------------------------
    let registry: string
    try {
      registry = await fs.readFile(registryPath, "utf8")
    } catch {
      return `Error: could not read registry at ${registryPath}. Is the repo root correct?`
    }

    const existingKeys = [...registry.matchAll(/\bkey:\s*'([^']*)'/g)].map((m) => m[1])
    const existingSlugs = [...registry.matchAll(/\bslug:\s*'([^']*)'/g)].map((m) => m[1])
    const existingRoutes = new Set([...registry.matchAll(/\broute:\s*'([^']*)'/g)].map((m) => m[1]))
    const existingLabels = [...registry.matchAll(/\blabel:\s*'([^']*)'/g)].map((m) => m[1])

    const key = String(gameNumber)

    if (existingKeys.includes(key)) return `Error: registry already has key '${key}'. Pick a different gameNumber.`
    if (existingSlugs.includes(slug)) return `Error: registry already has slug '${slug}'.`
    if (existingLabels.includes(title)) return `Error: registry already uses the label '${title}'. Pick a different title.`
    // Never let a scaffold target the template folder itself — that would
    // rewrite an existing game in place.
    if (slug === templateSlug) {
      return `Error: slug '${slug}' is the template folder. Pick a different slug (it is usually taken by an existing game).`
    }

    // ---- Target folder must not exist -------------------------------------
    if (!dryRun) {
      try {
        await fs.access(destDir)
        return `Error: 'src/games/${slug}/' already exists. Refusing to overwrite.`
      } catch { /* good: does not exist */ }
    }

    // ---- Resolve the route ------------------------------------------------
    let route = (args.route || "").trim()
    if (route) {
      if (!/^\/\d{5}$/.test(route)) return `Error: route '${route}' must look like '/12345' (slash + 5 digits).`
      if (existingRoutes.has(route)) return `Error: route '${route}' is already used.`
    } else {
      const used = new Set(existingRoutes)
      let candidate = ""
      for (let i = 0; i < 5000 && !candidate; i++) {
        const n = 10000 + Math.floor(Math.random() * 90000)
        const r = `/${n}`
        if (!used.has(r)) candidate = r
      }
      if (!candidate) return "Error: could not find an unused 5-digit route. Pass one explicitly."
      route = candidate
    }

    // ---- Build the registry entry ----------------------------------------
    const palette = PALETTES[gameNumber % PALETTES.length]
    const emoji = args.emoji || EMOJIS[gameNumber % EMOJIS.length]
    const categoryNote = args.category ? ` ${args.category}` : ""

    const entry =
      `  {\n` +
      `    // Skeleton entry — the mechanics and final title arrive with the gameplay\n` +
      `    // brief. Change label/title/subtitle only in tandem with GamePage.jsx's\n` +
      `    // gate labels, or the lock screen and the card disagree.${categoryNote}\n` +
      `    key: '${key}',\n` +
      `    slug: '${slug}',\n` +
      `    route: '${route}',\n` +
      `    term: ${term},\n` +
      `    progressKey: '${slug}',\n` +
      `    meta: {\n` +
      `      emoji: '${emoji}',\n` +
      `      label: '${title}',\n` +
      `      title: '${title}',\n` +
      `      subtitle: 'Coming soon',\n` +
      `      description: 'A brand-new game is being built — check back soon!',\n` +
      `      hue: '${palette.hue}',\n` +
      `      tint: '${palette.tint}',\n` +
      `      gradient: '${palette.gradient}',\n` +
      `      ring: '${palette.ring}',\n` +
      `    },\n` +
      `    load: () => import('@/games/${slug}/GamePage'),\n` +
      `  },\n`

    // Insert before the closing `];` of the GAME_REGISTRY array (the `];` that
    // immediately precedes the derived exports).
    const markerIdx = registry.indexOf("\nexport const GAME_CATALOG")
    if (markerIdx < 0) return "Error: could not locate the end of GAME_REGISTRY in registry.js (marker missing)."
    const head = registry.slice(0, markerIdx)
    const bracketIdx = head.lastIndexOf("];")
    if (bracketIdx < 0) return "Error: could not find the GAME_REGISTRY closing bracket."
    const nextRegistry = registry.slice(0, bracketIdx) + entry + registry.slice(bracketIdx)

    // ---- Plan the file set ------------------------------------------------
    const created: string[] = []
    const writes: Array<{ abs: string; rel: string; content: string }> = []

    if (kind === "phaser") {
      let existsTemplate = true
      try { await fs.access(templateDir) } catch { existsTemplate = false }
      if (!existsTemplate) {
        return `Error: template folder 'src/games/${templateSlug}/' not found. Pass a valid templateSlug or use kind:'react'.`
      }

      const rels = await collectFiles(templateDir, templateDir)
      if (rels.length === 0) return `Error: template folder 'src/games/${templateSlug}/' has no files to copy.`

      for (const rel of rels) {
        const src = path.join(templateDir, rel)
        const raw = await fs.readFile(src, "utf8")
        const rewritten = rewrite(raw, from, to)
        const relOut = `src/games/${slug}/${rel.split(path.sep).join("/")}`
        writes.push({ abs: path.join(destDir, rel), rel: relOut, content: rewritten })
      }
    } else {
      // react: a single-component game plus a gated page wrapper, matching the
      // "both gates in that order" rule.
      const gameJsx =
        `// Game.jsx\n` +
        `// ${to.spaced} — BOILERPLATE ONLY. React game shell.\n` +
        `//\n` +
        `// TODO: implement the ${to.spaced} mechanics, then call\n` +
        `// logPlaySession({ game: '${slug}', ... }) on completion (slug must equal\n` +
        `// this game's registry progressKey).\n` +
        `import { logPlaySession } from '@/api/logPlaySession';\n` +
        `\n` +
        `export default function Game({ playerName }) {\n` +
        `  // Placeholder completion — proves the logging path end to end.\n` +
        `  const finish = () => {\n` +
        `    logPlaySession({\n` +
        `      game: '${slug}',\n` +
        `      playerName: playerName || 'Guest',\n` +
        `      stars: 0,\n` +
        `      totalRounds: 0,\n` +
        `      peakStreak: 0,\n` +
        `      mistakes: 0,\n` +
        `    });\n` +
        `  };\n` +
        `\n` +
        `  return (\n` +
        `    <div className="flex h-full w-full flex-col items-center justify-center gap-6">\n` +
        `      <div className="rounded-3xl bg-white/95 px-8 py-10 text-center shadow-xl ring-1 ring-black/5">\n` +
        `        <h2 className="font-heading text-3xl font-bold text-[#3b2f1e]">${to.spaced}</h2>\n` +
        `        <p className="mt-2 text-sm text-[#6b5b45]">This game is being built 🚧</p>\n` +
        `      </div>\n` +
        `      <button\n` +
        `        type="button"\n` +
        `        onClick={finish}\n` +
        `        className="rounded-full bg-[#3b2f1e] px-6 py-2.5 text-sm font-bold text-white shadow-lg"\n` +
        `      >\n` +
        `        Finish (placeholder)\n` +
        `      </button>\n` +
        `    </div>\n` +
        `  );\n` +
        `}\n`

      const pageJsx =
        `// GamePage.jsx\n` +
        `// ${to.spaced} — page chrome. The \`gameLabel\` values here must match the\n` +
        `// catalogue entry's label/title in registry.js, or the lock screen and the\n` +
        `// card disagree.\n` +
        `import { Link } from 'react-router-dom';\n` +
        `import Game from '@/games/${slug}/Game';\n` +
        `import NameGate from '@/auth/NameGate';\n` +
        `import GameAccessGate from '@/auth/GameAccessGate';\n` +
        `import { usePlayerStore } from '@/auth/playerStore';\n` +
        `\n` +
        `export default function GamePage() {\n` +
        `  return (\n` +
        `    <NameGate gameLabel="${title}">\n` +
        `      <GameAccessGate gameNumber={${gameNumber}} gameLabel="${title}">\n` +
        `        <GamePageInner />\n` +
        `      </GameAccessGate>\n` +
        `    </NameGate>\n` +
        `  );\n` +
        `}\n` +
        `\n` +
        `function GamePageInner() {\n` +
        `  const playerName = usePlayerStore((s) => s.playerName);\n` +
        `  return (\n` +
        `    <div className="aura-page relative flex h-[100dvh] w-full flex-col items-center overflow-hidden">\n` +
        `      <Link\n` +
        `        to="/"\n` +
        `        className="font-body relative z-20 ml-3 mt-3 flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2.5 text-sm font-bold text-[#3b2f1e] shadow-lg"\n` +
        `      >\n` +
        `        🏠 Home\n` +
        `      </Link>\n` +
        `      <div className="relative z-10 flex w-full min-h-0 flex-1 items-center justify-center">\n` +
        `        <Game playerName={playerName} />\n` +
        `      </div>\n` +
        `    </div>\n` +
        `  );\n` +
        `}\n`

      writes.push({ abs: path.join(destDir, "Game.jsx"), rel: `src/games/${slug}/Game.jsx`, content: gameJsx })
      writes.push({ abs: path.join(destDir, "GamePage.jsx"), rel: `src/games/${slug}/GamePage.jsx`, content: pageJsx })
    }

    // ---- Dry run: report only --------------------------------------------
    if (dryRun) {
      const preview =
        `DRY RUN — nothing written.\n\n` +
        `Would create folder: src/games/${slug}/ (kind: ${kind})\n` +
        `Would write ${writes.length} file(s):\n` +
        writes.map((w) => `  - ${w.rel}`).join("\n") +
        `\n\nWould append ONE registry entry:\n` +
        `  key='${key}' slug='${slug}' route='${route}' term=${term} progressKey='${slug}' label='${title}'\n` +
        `\nNo change to main.jsx or GAME_CATALOG (both derive from the registry).`
      say(preview)
      return preview
    }

    // ---- Write everything -------------------------------------------------
    try {
      for (const w of writes) {
        await fs.mkdir(path.dirname(w.abs), { recursive: true })
        await fs.writeFile(w.abs, w.content, "utf8")
        created.push(w.rel)
      }
      await fs.writeFile(registryPath, nextRegistry, "utf8")
    } catch (error: any) {
      return `Error while writing files: ${error?.message ?? String(error)}. Some files may have been created — check src/games/${slug}/ and clean up manually if needed.`
    }

    const summary =
      `Scaffolded ${to.spaced} (key '${key}').\n\n` +
      `Folder: src/games/${slug}/  (kind: ${kind})\n` +
      `Files created (${created.length}):\n` +
      created.map((f) => `  - ${f}`).join("\n") +
      `\n\nRegistry: appended ONE entry in src/games/registry.js\n` +
      `  key='${key}' slug='${slug}' route='${route}' term=${term} progressKey='${slug}'\n` +
      `  label='${title}'\n` +
      `\nmain.jsx and GAME_CATALOG were NOT touched — both derive from the registry.\n\n` +
      `Remaining manual steps from the checklist:\n` +
      `  1. Add public/game-icons/${slug.replace(/-/g, "")}.png and one line in src/games/gameIcons.js (optional).\n` +
      `  2. Verify the card label, on-screen heading and gate labels agree, and that no other game uses this name.\n` +
      `  3. Run npm run lint and vite build; then have an admin add the game to a class from the panel's Catalogue.\n` +
      `  4. Replace the placeholder mechanics when the gameplay brief arrives; keep logPlaySession's\n` +
      `     game value equal to progressKey ('${slug}').\n\n` +
      `Nothing was committed or pushed.`

    say(summary)
    return summary
  },
})
