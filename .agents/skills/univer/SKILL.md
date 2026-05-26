---
name: univer
description: >
  Univer CLI skill for working with .univer workbook files in the terminal.
  Use it when an agent needs real workbook semantics: sheets, ranges, formulas,
  formatting, layout, previews, imports, exports, or versioned workbook state.
---

# univer-cli

`univer` is a spreadsheet engine in the terminal. Use it when an agent needs real workbook semantics: sheets, ranges, formulas, formatting, layout, previews, imports, exports, or versioned workbook state.

Install the CLI with `npm i -g univer-cli`. Update the CLI with `univer update`. The executable is `univer`; `unv` may be available as a short alias.

## Core Mental Model

Treat workbook-visible state as the source of truth. A successful command summary, package metadata, or an internal manifest does not prove that sheet names, cell values, formulas, formatting, or exported handoff files are correct.

The workbook path is the local identity. Pick one explicit path such as `./budget.univer` and use that path as the CLI target. Do not target workbooks by `unitId`, `sessionId`, manifest ids, or runtime ids.

`.univer` and `.unv` files are CLI operation targets, not agent-editable data stores. Read and write workbook data through public CLI surfaces such as `inspect`, `search`, `pipe`, `run`, `export`, `status`, and `commit`.

Use `univer help` and `univer help <command...>` for exact syntax. For `run` scripts, use `univer help run` and `univer help run <topic>` before relying on unfamiliar APIs.

## Use When

Use this skill when the task involves spreadsheet or workbook work, especially:

- creating, importing, exporting, or handing off `.xlsx`, `.csv`, `.univer`, or `.unv` files
- inspecting workbook shape, sheets, ranges, formulas, formatting, or visible cell state
- locating content-defined rows, columns, headers, or cells before editing
- making bounded edits to cells, formulas, formatting, charts, shapes, floating images, layout, or sheet structure
- streaming rectangular workbook data through shell tools before reading it into context
- writing generated matrix data back into a sheet-qualified range
- previewing workbook state locally with `univer view`
- reading submitted local viewer review comments with `univer view comments`
- creating, restoring, resetting, pulling, or syncing local workbook changesets
- proving that a workbook-visible mutation or export is correct enough to hand back

## Default Operating Loop

1. Pick one explicit workbook path, for example `./budget.univer`.
2. Create or import a workbook first if no `.univer` or `.unv` target exists.
3. Inspect workbook-visible state before deciding where to write.
4. Locate targets from visible headers, values, formulas, or inspected ranges.
5. Choose the smallest public CLI surface that fits the task.
6. Mutate through the CLI, not by editing package internals.
7. Verify changed workbook-visible state with `inspect`, `pipe out`, or another public read.
8. Export only after verification when the user needs a handoff file.
9. After changes have been verified, if the user may need to inspect, audit, or review the final workbook, run `univer view "$WB" --no-open --json` to get a local preview link and include that link in your response.
10. Commit or sync only after verified changes when versioning is part of the workflow.

## Hard Rules

- Do not read `.univer` or `.unv` internals to infer workbook contents.
- Do not write, patch, unzip, rezip, rename internal files, or manipulate workbook package contents.
- Do not inspect `manifest.json`, snapshots, mutation logs, or package fragments as a substitute for workbook-visible reads.
- Do not guess sheet names, row numbers, formulas, ranges, or changed cells from memory or file metadata.
- Do not treat stdout summaries as proof of workbook state. Verify with a workbook-visible read.
- Do not invent commands or `run` APIs. Check `univer help` and documented run topics.

Direct package access can corrupt workbooks or teach the agent false state. If the CLI cannot read what you need, diagnose the CLI/runtime path instead of bypassing it.

## Command Selection

| Need                                                                          | Prefer                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Discover exact command syntax                                                 | `univer help`, `univer help <command...>`                             |
| Start a workbook package                                                      | `univer new` or `univer import`                                       |
| Hand back Excel-compatible output                                             | `univer export`                                                       |
| Understand workbook shape before editing                                      | `univer inspect workbook`, then `univer inspect range`                |
| Locate content-defined cells                                                  | `univer search`, scoped with `--sheet` and/or `--range` when possible |
| Stream rectangular data through shell tools                                   | `univer pipe out`                                                     |
| Write a known rectangular matrix back                                         | `univer pipe in`                                                      |
| Apply bounded workbook-local logic                                            | `univer run --file`                                                   |
| Create or maintain workbook charts                                            | `univer run --file` with `univer help run charts`                     |
| Create or maintain workbook shapes and connectors                             | `univer run --file` with `univer help run shapes`                     |
| Create or maintain workbook floating images                                   | `univer run --file` with `univer help run images`                     |
| Preview readonly workbook state                                               | `univer view --no-open --json` or `univer view`                       |
| Read local viewer review feedback                                             | `univer view comments "$WB" --json`                                   |
| Check local versioning state                                                  | `univer status`                                                       |
| Create a local changeset from local mutations                                 | `univer commit --message <message>`                                   |
| Discard uncommitted local mutations                                           | `univer restore`                                                      |
| Reset local unsynced commits                                                  | `univer reset --soft HEAD~N` or `univer reset --hard HEAD~N`          |
| Initialize a local package from an existing remote unit                       | `univer clone --unit-id <unitID>`                                     |
| Pull remote-only changes for a bound package                                  | `univer pull`                                                         |
| Sync local and remote versioning state                                        | `univer sync`                                                         |
| Diagnose runtime problems                                                     | `univer doctor`, `univer daemon status`                               |
| Prepare a bug report or Univer team support artifact after user authorization | `univer doctor collect`                                               |

Use canonical command help such as `univer help inspect range` and `univer help pipe out`. Top-level help group headings are visual sections only; do not run group-prefixed topics such as `univer help read inspect range`.

## Execution Results

Treat non-zero exit as failure even when stdout is partially present. Read stderr before changing approach; it usually contains the stable diagnostic code, usage, and retry examples.

Keep data stdout clean in shell pipelines. If diagnostics are needed, capture stderr separately so downstream tools receive only workbook data.

```bash
univer inspect range "$WB" --range 'Sheet1!A1:D20' > ./range.md 2> ./range.err
status=$?
if [ "$status" -ne 0 ]; then
  sed -n '1,80p' ./range.err
  exit "$status"
fi
sed -n '1,40p' ./range.md
```

## Workflow Recipes

These are verified command shapes. Replace paths, sheet names, and ranges with inspected workbook facts.

### Create Or Import, Then Inspect

```bash
WB=./orders.univer
univer import ./orders.csv "$WB" --json
univer inspect workbook "$WB"
univer inspect range "$WB" --range 'Sheet1!A1:D4'
```

Use `new` when the task starts from a blank workbook:

```bash
WB=./workbook.univer
univer new "$WB" --name "Workbook"
univer inspect workbook "$WB"
```

### Locate Before Editing

Use `search` before editing when the target is defined by visible workbook content:

```bash
univer search "$WB" West
```

Plain text output is one A1 reference per matched cell, which keeps shell pipelines clean. With no
matches, stdout is empty and the command still succeeds. Use `--json` when you need match metadata,
the matched cell data preview, truncation flags, counts, or the searched scope:

```bash
univer search "$WB" West --sheet Orders --range 'A1:Z200' --json
```

By default, search checks `displayValue`, so formatted values such as dates are searchable by the
same strings a user sees in the sheet. Use `--type rawValue` for underlying numeric/string values
such as spreadsheet date serials, and `--type formula` for formulas:

```bash
univer search "$WB" 2024-01-01
univer search "$WB" 45292 --type rawValue
univer search "$WB" SUM --type formula --json
```

Useful narrowing options:

- `--sheet <name>` may be repeated.
- `--range <A1>` may be repeated; unqualified ranges require a `--sheet`.
- `--case-sensitive` and `--whole-cell` tighten matching.
- `--max-results` limits returned matches; truncation is reported on stderr for text output and in JSON fields for `--json`.
- `--max-cell-value-length` bounds previewed cell data in JSON.

If `search` fails, read stderr for the diagnostic message before changing approach. If the target is
not content-defined, inspect a bounded range and derive the edit boundary from visible headers and
sample rows:

```bash
univer inspect range "$WB" --range 'Sheet1!A1:D20'
```

### Pipe Out Through Shell Tools

Use `pipe out` when the shell can reduce or reshape rectangular data before the agent reads it. Prefer TSV for `awk`, JSON for `jq`, and `--type rawValue` when formatted display text is not safe enough for comparisons.

```bash
univer pipe out "$WB" --range 'Sheet1!A1:D4' --format tsv > ./orders.tsv
awk -F '\t' 'BEGIN{OFS="\t"} NR==1 || $2=="West" {print $1,$3}' ./orders.tsv > ./west.tsv
sed -n '1,5p' ./west.tsv
```

### Pipe In Generated Table Data

Write only a known matrix into an explicit, sheet-qualified range. Make `pipe in` the terminal stage of a pipeline unless you intentionally want its success summary downstream.

```bash
univer pipe in "$WB" --range 'Sheet1!F1:G3' --input-format tsv --data-file ./west.tsv
univer inspect range "$WB" --range 'Sheet1!F1:G3'
univer pipe out "$WB" --range 'Sheet1!F1:G3' --format tsv
```

Verify headers, sample rows, and key columns. Row count alone is weak evidence because shifted columns can still preserve row count.

### Run A Bounded Workbook Script

Use `run --file` for workbook-native logic that does not fit `inspect`, `search`, `pipe`, or `export`. Check `univer help run` and the relevant `univer help run <topic>` manual before using unfamiliar APIs.

```bash
cat > ./review.js << 'JS'
() => {
  const workbook = univerAPI.getActiveWorkbook();
  const sheet = workbook.getSheetByName("Sheet1");
  if (!sheet) return { success: false, error: "Sheet1 not found" };

  sheet.getRange("I1:J3").setValues([
    ["metric", "value"],
    ["west_orders", 2],
    ["reviewed", "yes"],
  ]);

  return { success: true, changedRanges: ["Sheet1!I1:J3"] };
}
JS

univer run "$WB" --file ./review.js
univer inspect range "$WB" --range 'Sheet1!I1:J3'
```

### Create Or Maintain Charts

```bash
univer help run charts
univer run "$WB" --file ./create-chart.js
univer view "$WB" --no-open --json
```

### Create Or Maintain Shapes

```bash
univer help run shapes
univer run "$WB" --file ./create-shapes.js
univer view "$WB" --no-open --json
```

### Create Or Maintain Floating Images

```bash
univer help run images
univer run "$WB" --file ./create-image.js
univer view "$WB" --no-open --json
```

### Preview Locally

```bash
univer view "$WB" --no-open --json
univer view comments "$WB" --json
univer view comments --session "<session-id>" --all --json
```

### Version Verified Changes

```bash
univer status "$WB"
univer commit "$WB" --message "Update review ranges"
univer status "$WB"
```

### Export Handoff

```bash
univer inspect workbook "$WB"
univer export "$WB" ./handoff.xlsx --json
test -s ./handoff.xlsx
univer import ./handoff.xlsx ./handoff.univer --json
univer inspect workbook ./handoff.univer
```

## Gotchas

- `manifest.json` is metadata only. It does not prove sheet names, formulas, changed cells, or handoff correctness.
- Package contents are not a meaningful way to infer spreadsheet data. Use public CLI reads instead.
- Local file identity is the workbook path, such as `./budget.univer`, not `unitId`, `sessionId`, or manifest ids.
- Command success is not enough after import, mutation, export, or handoff. Verify workbook-visible state.
- A non-zero exit means the operation failed. Read stderr for the diagnostic, usage, and retry guidance.
- Quote the full range: `--range 'Sheet1!A1:J20'`, not just the sheet name fragment.
- `pipe in` writes parsed matrix data and reports a summary; it does not echo input.
- `view` is readonly preview. Do not treat it as mutation verification unless the task is visual review.
- `commit` is local only; use `sync` to push local changesets.
- `restore` discards only uncommitted local mutations; it does not remove local commits.
- `reset` is local-only and limited to `HEAD~N` over unsynced local commits.
- `sync` does not push uncommitted local mutations. Commit verified workbook changes first.
- `clone` replaced older remote binding wording. Do not use or invent a `bind` command.
- If runtime-backed commands fail to start, inspect `univer daemon status` before retrying blindly.

## Support

Public issues: <https://github.com/dream-num/skills/issues>. Community: <https://discord.gg/nThHPupraR>.

Skill document revision: 2026-05-22.
