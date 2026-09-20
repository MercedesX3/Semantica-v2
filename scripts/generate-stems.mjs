#!/usr/bin/env node
/**
 * Generates the four emotion stems for each sound archetype with ElevenLabs.
 *
 * Run by hand, never deployed: there are sixteen files in total and they never
 * change once they sound right, so there is no reason to put a paid API behind
 * the web app. Nothing is generated unless --generate is passed, and a file that
 * already exists is skipped, so a rerun costs nothing.
 *
 *   node scripts/generate-stems.mjs                      # dry run, prints prompts
 *   node scripts/generate-stems.mjs --generate           # fills in what's missing
 *   node scripts/generate-stems.mjs --generate --force historical/joy
 *   node scripts/generate-stems.mjs --upload             # push to S3
 *
 * Why the prompts look the way they do: ElevenLabs returns one mixed track per
 * request, with no stems, no loop points and no key or tempo parameters. Four
 * stems are therefore four unrelated generations unless the prompt forces them
 * together. So each archetype pins one key, one tempo and one instrument family,
 * and the four stems differ only by register, texture and articulation.
 *
 * They never differ by mode. Sounding a major and a minor third over the same
 * root is the one combination guaranteed to clash, so "joy" brightens by moving
 * up and lightening rather than by turning major.
 *
 * Every prompt asks for sparse, sustained, loopable material with no percussion
 * and no melody. Thin drone-like layers stack tolerably even when generation
 * drifts; full arrangements do not.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "audio-stems");
const ENV_FILE = join(ROOT, "client", ".env");

const API_URL = "https://api.elevenlabs.io/v1/music";
const MODEL_ID = "music_v2";
const OUTPUT_FORMAT = "mp3_44100_128";
/** Long enough not to feel obviously repetitive, far below the 600s cap. */
const LENGTH_MS = 90_000;
/** Cooldown between requests to clear ElevenLabs concurrency locks (2 max). */
const COOLDOWN_MS = 3_500;

export const STEMS = ["neutral", "joy", "sadness", "tension"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One musical world per archetype. `bed` is appended to every prompt so the key,
 * tempo and constraints are stated identically for all four stems.
 */
/*
 * Each stem is pinned to its own register and instrument family.
 *
 * The first pass asked every stem for the same thing — sparse, sustained, no
 * melody — and got four near-identical recordings back: measured against each
 * other, sci-fi's neutral and joy were 0.91 cosine-similar and historical's
 * neutral and sadness 0.83, so two books whose mixes differed completely still
 * sounded the same. The constraint that made them layer also collapsed the
 * timbral space, and "neutral" became a generic version of its siblings.
 *
 * So the sparse/key/tempo rules stay — they are what lets four independent
 * generations stack — and separation now comes from register and instrument:
 *
 *   tension  sub-bass, dark, no highs
 *   neutral  low-mid, static, no vibrato, deliberately plain
 *   sadness  mid, expressive, slow vibrato
 *   joy      high, bright, bell-like
 *
 * Non-overlapping registers keep the stems distinguishable while still sitting
 * in one key.
 */
const ARCHETYPES = {
  historical: {
    bed: "A minor, 68 BPM, chamber acoustic recording, sparse and sustained, no percussion, no drums, no melody line, even dynamics, seamless loop, ambient underscore",
    stems: {
      neutral:
        "low register sustained cello drone, open fifths, no vibrato, completely static, plain and dark",
      joy: "high register celeste and harp harmonics, bright bell-like tones, airy and glassy",
      sadness:
        "mid register solo violin, thin and exposed, slow heavy vibrato, mournful",
      tension:
        "sub-bass contrabass bowed cluster, very low, dissonant, no high frequencies",
    },
  },
  scifi: {
    bed: "D minor, 72 BPM, analog synthesizer, sparse and sustained, no percussion, no drums, no arpeggios, no melody line, even dynamics, seamless loop, ambient underscore",
    stems: {
      neutral:
        "low register analog synth drone, static, no filter movement, flat and dark",
      joy: "high register crystalline bell synth, sparkling glassy upper partials",
      sadness:
        "mid register detuned synth strings, hollow and cold, slow drift",
      tension:
        "sub-bass synth rumble, very low metallic pulse, no high frequencies",
    },
  },
  thriller: {
    bed: "C minor, 76 BPM, hybrid orchestral and electronic, sparse and sustained, no percussion, no drums, no melody line, even dynamics, seamless loop, ambient underscore",
    stems: {
      neutral:
        "low register muted sustained cello, static, dry and plain, no vibrato",
      joy: "high register flute harmonics, thin bright airy upper register",
      sadness: "mid register clarinet, breathy and exposed, bleak",
      tension:
        "sub-bass bowed metal cluster, very low dissonant rumble, no high frequencies",
    },
  },
  contemporary: {
    bed: "F major, 70 BPM, intimate acoustic recording, sparse and sustained, no percussion, no drums, no melody line, even dynamics, seamless loop, ambient underscore",
    stems: {
      neutral:
        "low register felt piano sustained single notes, static, muted and plain",
      joy: "high register acoustic guitar harmonics, bright and glassy, open",
      sadness: "mid register bowed vibraphone, warm and slow, gently wavering",
      tension:
        "sub-bass synth drone under very low piano, dark, no high frequencies",
    },
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

/** The full prompt for one stem: its own texture, then the archetype's rules. */
export function promptFor(archetype, stem) {
  const a = ARCHETYPES[archetype];
  return `${a.stems[stem]}, ${a.bed}`;
}

const relPath = (archetype, stem) => join(archetype, `stem_${stem}.mp3`);
const outPath = (archetype, stem) => join(OUT_DIR, relPath(archetype, stem));

/** Reads one key out of client/.env without pulling in a dotenv dependency. */
function readEnv(name) {
  if (!existsSync(ENV_FILE)) return null;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (match && match[1] === name) return match[2].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function parseArgs(argv) {
  const args = { generate: false, upload: false, force: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--generate") args.generate = true;
    else if (argv[i] === "--upload") args.upload = true;
    else if (argv[i] === "--force") {
      const target = argv[i + 1];
      if (!target || target.startsWith("--")) {
        throw new Error("--force needs a target, e.g. --force historical/joy");
      }
      args.force.add(target);
      i += 1;
    } else if (argv[i] === "--dry-run") {
      // The default; accepted so it can be written out explicitly.
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

/** Every stem, tagged with whether this run would actually generate it. */
function plan(force) {
  const rows = [];
  for (const archetype of ARCHETYPE_NAMES) {
    for (const stem of STEMS) {
      const path = outPath(archetype, stem);
      const forced = force.has(`${archetype}/${stem}`) || force.has(archetype);
      const exists = existsSync(path);
      rows.push({
        archetype,
        stem,
        path,
        exists,
        todo: forced || !exists,
        reason: forced ? "forced" : exists ? "already generated" : "missing",
      });
    }
  }
  return rows;
}

/** Generates one stem with automatic retry if 429 concurrency limit hits. */
async function generateOne(row, apiKey, retries = 3) {
  const prompt = promptFor(row.archetype, row.stem);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Connection": "close", // Explicitly close socket to release concurrency slot
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: LENGTH_MS,
        output_format: OUTPUT_FORMAT,
        force_instrumental: true,
        model_id: MODEL_ID,
      }),
    });

    if (res.status === 429) {
      if (attempt < retries) {
        const waitTime = attempt * 5000;
        process.stdout.write(`[Rate limited, retrying in ${waitTime / 1000}s...] `);
        await sleep(waitTime);
        continue;
      }
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText} ${detail.slice(0, 300)}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length < 10_000) {
      throw new Error(`suspiciously small response (${audio.length} bytes): ${audio.toString("utf8").slice(0, 200)}`);
    }

    mkdirSync(dirname(row.path), { recursive: true });
    writeFileSync(row.path, audio);
    return audio.length;
  }
}

function uploadAll(bucket) {
  const rows = plan(new Set()).filter((r) => r.exists);
  if (rows.length === 0) throw new Error("nothing generated yet — run --generate first");

  for (const row of rows) {
    const key = `audio/${relPath(row.archetype, row.stem).split("\\").join("/")}`;
    execFileSync(
      "aws",
      [
        "s3", "cp", row.path, `s3://${bucket}/${key}`,
        "--content-type", "audio/mpeg",
        "--cache-control", "public, max-age=31536000, immutable",
      ],
      { stdio: "inherit" },
    );
  }
  console.log(`\nuploaded ${rows.length} files to s3://${bucket}/audio/`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.upload) {
    const bucket = readEnv("AUDIO_BUCKET") ?? process.env.AUDIO_BUCKET;
    if (!bucket) throw new Error("set AUDIO_BUCKET in client/.env (terraform output audio_bucket)");
    uploadAll(bucket);
    return;
  }

  const rows = plan(args.force);
  const todo = rows.filter((r) => r.todo);

  if (!args.generate) {
    console.log("DRY RUN — nothing will be generated and nothing will be spent.\n");
    for (const archetype of ARCHETYPE_NAMES) {
      console.log(`${archetype}`);
      for (const stem of STEMS) {
        const row = rows.find((r) => r.archetype === archetype && r.stem === stem);
        const mark = row.todo ? "WOULD GENERATE" : "skip";
        console.log(`  ${stem.padEnd(8)} ${mark.padEnd(15)} ${row.reason}`);
        console.log(`    "${promptFor(archetype, stem)}"`);
      }
      console.log();
    }
    console.log(`${todo.length} of ${rows.length} stems would be generated at ${LENGTH_MS / 1000}s each.`);
    console.log("Re-run with --generate to actually generate them.");
    return;
  }

  const apiKey = readEnv("ELEVEN_LABS_KEY");
  if (!apiKey) throw new Error("ELEVEN_LABS_KEY is not set in client/.env");

  if (todo.length === 0) {
    console.log("Everything is already generated. Use --force <archetype>/<stem> to redo one.");
    return;
  }

  console.log(`Generating ${todo.length} stem(s) sequentially...\n`);
  let done = 0;

  for (let i = 0; i < todo.length; i += 1) {
    const row = todo[i];
    process.stdout.write(`  [${i + 1}/${todo.length}] ${row.archetype}/${row.stem} ... `);
    try {
      const bytes = await generateOne(row, apiKey);
      console.log(`ok (${(bytes / 1024).toFixed(0)} KB)`);
      done += 1;
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
    }

    // Cooldown before opening the next request so the upstream slot clears
    if (i < todo.length - 1) {
      await sleep(COOLDOWN_MS);
    }
  }

  console.log(`\n${done} of ${todo.length} generated into ${OUT_DIR}`);
  console.log("Listen to them before uploading, then run with --upload.");
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});