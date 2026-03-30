import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * Parse text with formatting syntax:
 * - _text_ → italic
 * - *text* → bold
 * - __text__ → underline
 * - ~~text~~ → strikethrough
 * - `code` → inline code
 * - ||text|| → spoiler (click to reveal)
 */
export function FormattedText({ text, className = '' }: FormattedTextProps) {
  if (!text) return null;

  // Split by patterns and map to components
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Combined regex for all patterns
  const pattern = /(_([^_]+)_)|\*([^*]+)\*|(__([^_]+)__)|(~~([^~]+)~~)|(`([^`]+)`)|(\|\|([^|]+)\|\|)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = pattern.lastIndex;

    // Add text before match
    if (matchStart > lastIndex) {
      elements.push(<span key={key++}>{remaining.slice(lastIndex, matchStart)}</span>);
    }

    // Determine which pattern matched
    const [full, _italic, italicText, boldText, _underline, underlineText, _strike, strikeText, _code, codeText, _spoiler, spoilerText] = match;

    if (italicText) {
      elements.push(<em key={key++} className="italic text-gray-300">{italicText}</em>);
    } else if (boldText) {
      elements.push(<strong key={key++} className="font-bold text-white">{boldText}</strong>);
    } else if (underlineText) {
      elements.push(<u key={key++} className="underline decoration-indigo-400">{underlineText}</u>);
    } else if (strikeText) {
      elements.push(<del key={key++} className="line-through text-gray-500">{strikeText}</del>);
    } else if (codeText) {
      elements.push(
        <code key={key++} className="px-1.5 py-0.5 bg-white/10 rounded text-sm font-mono text-indigo-300">
          {codeText}
        </code>
      );
    } else if (spoilerText) {
      elements.push(
        <Spoiler key={key++} text={spoilerText} />
      );
    }

    lastIndex = matchEnd;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <span className={className}>{elements}</span>;
}

function Spoiler({ text }: { text: string }) {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={`cursor-pointer rounded px-1 transition-all-custom ${
        revealed
          ? 'bg-white/10 text-gray-200'
          : 'bg-black/60 text-transparent hover:bg-black/40'
      }`}
      title={revealed ? 'Click to hide' : 'Click to reveal spoiler'}
    >
      {text}
    </span>
  );
}
