const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

function partialSuffixLength(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let length = max; length > 0; length -= 1) {
    if (text.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

export function createReasoningStripper() {
  let buffer = '';
  let insideReasoning = false;

  return {
    push(delta: string): string {
      buffer += delta;
      let output = '';

      while (true) {
        if (insideReasoning) {
          const closeIndex = buffer.indexOf(CLOSE_TAG);
          if (closeIndex === -1) {
            const keep = partialSuffixLength(buffer, CLOSE_TAG);
            buffer = buffer.slice(buffer.length - keep);
            break;
          }
          buffer = buffer.slice(closeIndex + CLOSE_TAG.length);
          insideReasoning = false;
          continue;
        }

        const openIndex = buffer.indexOf(OPEN_TAG);
        if (openIndex !== -1) {
          output += buffer.slice(0, openIndex);
          buffer = buffer.slice(openIndex + OPEN_TAG.length);
          insideReasoning = true;
          continue;
        }

        const keep = partialSuffixLength(buffer, OPEN_TAG);
        output += buffer.slice(0, buffer.length - keep);
        buffer = buffer.slice(buffer.length - keep);
        break;
      }

      return output;
    },

    flush(): string {
      if (insideReasoning) {
        buffer = '';
        return '';
      }
      const remaining = buffer;
      buffer = '';
      return remaining;
    },
  };
}
