interface AllyMarkProps {
  className?: string;
}

export function AllyMark({ className = '' }: AllyMarkProps) {
  return (
    <span
      className={`ally-mark${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      A
    </span>
  );
}
