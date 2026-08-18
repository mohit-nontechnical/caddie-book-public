import React from "react";

// Renders coach replies naturally. The model sometimes emits lightweight
// markdown (**bold**, *italics*, `code`, - bullets, 1. lists, ## headers)
// even when told not to — instead of showing raw markup in the bubble, this
// converts it to styled elements. Shared by the mobile CoachChat and the
// desktop DesktopCoach bubbles. Zero dependencies on purpose.

// ---- inline: **bold** / *italic* / `code` ----------------------------------

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} style={{ fontWeight: 650 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <span key={key} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.92em" }}>
          {part.slice(1, -1)}
        </span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

// ---- blocks: paragraphs, bullet lists, numbered lists, headers -------------

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number }
  | { kind: "h"; text: string };

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADER_RE = /^\s*#{1,6}\s+(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue; // blank line = block separator

    const header = line.match(HEADER_RE);
    if (header) {
      blocks.push({ kind: "h", text: header[1] });
      continue;
    }
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
      continue;
    }
    const numbered = line.match(NUMBER_RE);
    if (numbered) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ol") last.items.push(numbered[2]);
      else blocks.push({ kind: "ol", items: [numbered[2]], start: parseInt(numbered[1], 10) || 1 });
      continue;
    }
    // Plain text line. Consecutive plain lines (no blank between) stay in one
    // paragraph, separated by <br/> so intentional line breaks survive.
    const last = blocks[blocks.length - 1];
    if (last?.kind === "p") last.lines.push(line);
    else blocks.push({ kind: "p", lines: [line] });
  }
  return blocks;
}

export function CoachMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  const gap = 8;
  return (
    <>
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        const mb = isLast ? 0 : gap;
        if (b.kind === "h") {
          return (
            <div key={i} style={{ fontWeight: 650, margin: `0 0 ${isLast ? 0 : 4}px` }}>
              {renderInline(b.text, `h${i}`)}
            </div>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} style={{ margin: `0 0 ${mb}px`, paddingLeft: 19, listStyle: "disc" }}>
              {b.items.map((item, j) => (
                <li key={j} style={{ marginBottom: j === b.items.length - 1 ? 0 : 3 }}>
                  {renderInline(item, `u${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol") {
          return (
            <ol key={i} start={b.start} style={{ margin: `0 0 ${mb}px`, paddingLeft: 21, listStyle: "decimal" }}>
              {b.items.map((item, j) => (
                <li key={j} style={{ marginBottom: j === b.items.length - 1 ? 0 : 3 }}>
                  {renderInline(item, `o${i}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} style={{ margin: `0 0 ${mb}px` }}>
            {b.lines.map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line, `p${i}-${j}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
