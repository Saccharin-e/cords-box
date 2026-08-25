import type { ReactNode } from 'react';
import katex from 'katex';

interface MarkdownDocViewerProps {
  content: string;
}

export function MarkdownDocViewer({ content }: MarkdownDocViewerProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        color: '#d4d4d8',
        fontSize: '14px',
        lineHeight: 1.65,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h1
                key={idx}
                style={{
                  margin: '4px 0 2px 0',
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.3px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingBottom: '8px',
                }}
              >
                {renderInline(block.text)}
              </h1>
            );
          case 'h2':
            return (
              <h2
                key={idx}
                style={{
                  margin: '14px 0 2px 0',
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#f4f4f5',
                  letterSpacing: '-0.2px',
                }}
              >
                {renderInline(block.text)}
              </h2>
            );
          case 'h3':
            return (
              <h3
                key={idx}
                style={{
                  margin: '10px 0 2px 0',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  letterSpacing: '-0.1px',
                }}
              >
                {renderInline(block.text)}
              </h3>
            );
          case 'p':
            return (
              <p key={idx} style={{ margin: 0, color: '#a1a1aa' }}>
                {renderInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul
                key={idx}
                style={{
                  margin: '0',
                  paddingLeft: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} style={{ color: '#d4d4d8' }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              <div
                key={idx}
                style={{
                  overflowX: 'auto',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: 'rgba(18, 18, 21, 0.7)',
                  margin: '6px 0',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '13px',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{
                            padding: '9px 12px',
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '0.2px',
                          }}
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          borderBottom: rIdx === block.rows.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                          backgroundColor: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        }}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              padding: '8px 12px',
                              color: '#cbd5e1',
                            }}
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'codeblock':
            return (
              <div
                key={idx}
                style={{
                  borderRadius: '8px',
                  backgroundColor: '#0d0d10',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '12px 16px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: '12px',
                  color: '#38bdf8',
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
                <pre style={{ margin: 0 }}>{block.text}</pre>
              </div>
            );
          case 'math': {
            const html = katex.renderToString(block.text, {
              displayMode: true,
              throwOnError: false,
              output: 'html',
            });
            return (
              <div
                key={idx}
                style={{
                  padding: '14px 20px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(2, 132, 199, 0.06)',
                  border: '1px solid rgba(2, 132, 199, 0.22)',
                  fontSize: '15px',
                  color: '#7dd3fc',
                  margin: '8px 0',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
                  overflowX: 'auto',
                  textAlign: 'center',
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          default:
            return null;
        }
      })}
    </article>
  );
}

interface HeadingBlock {
  type: 'h1' | 'h2' | 'h3';
  text: string;
}
interface ParagraphBlock {
  type: 'p';
  text: string;
}
interface UlBlock {
  type: 'ul';
  items: string[];
}
interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}
interface CodeBlock {
  type: 'codeblock';
  language?: string;
  text: string;
}
interface MathBlock {
  type: 'math';
  text: string;
}

type MarkdownBlock = HeadingBlock | ParagraphBlock | UlBlock | TableBlock | CodeBlock | MathBlock;

function parseMarkdownBlocks(raw: string): MarkdownBlock[] {
  const lines = raw.trim().split('\n');
  const blocks: MarkdownBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: 'codeblock',
        language,
        text: codeLines.join('\n'),
      });
      continue;
    }

    // Math blocks $$
    if (trimmed.startsWith('$$')) {
      if (trimmed.endsWith('$$') && trimmed.length > 4) {
        blocks.push({
          type: 'math',
          text: trimmed.slice(2, -2).trim(),
        });
        i++;
        continue;
      } else {
        // Multi-line $$ block
        const mathLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const lastLine = lines[i].trim().replace(/\$\$$/, '');
          if (lastLine) mathLines.push(lastLine);
          i++;
        }
        blocks.push({
          type: 'math',
          text: mathLines.join('\n').trim(),
        });
        continue;
      }
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', text: trimmed.slice(2) });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
      i++;
      continue;
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const headers = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      i++;

      if (i < lines.length && lines[i].includes('---')) {
        i++;
      }

      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        rows.push(rowCells);
        i++;
      }

      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Paragraph
    blocks.push({ type: 'p', text: trimmed });
    i++;
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\$[^$]+\$|\*[^*]+\*)/g;
  const tokens = text.split(regex);

  tokens.forEach((tok, idx) => {
    if (!tok) return;

    if (tok.startsWith('**') && tok.endsWith('**')) {
      const inner = tok.slice(2, -2);
      parts.push(
        <strong key={idx} style={{ color: '#ffffff', fontWeight: 600 }}>
          {renderInline(inner)}
        </strong>,
      );
    } else if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      const inner = tok.slice(1, -1);
      parts.push(
        <em key={idx} style={{ color: '#f4f4f5', fontStyle: 'italic' }}>
          {renderInline(inner)}
        </em>,
      );
    } else if (tok.startsWith('`') && tok.endsWith('`')) {
      parts.push(
        <code
          key={idx}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#38bdf8',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '0.9em',
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith('$') && tok.endsWith('$')) {
      const mathExp = tok.slice(1, -1);
      const html = katex.renderToString(mathExp, {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
      parts.push(
        <span
          key={idx}
          style={{
            display: 'inline-block',
            color: '#7dd3fc',
            padding: '0 2px',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      );
    } else {
      parts.push(tok);
    }
  });

  return parts;
}
