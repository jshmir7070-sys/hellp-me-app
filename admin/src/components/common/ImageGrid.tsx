interface ImageGridProps {
  images: string[];
  maxDisplay?: number;
}

const toAbsUrl = (p: string) => {
  if (!p) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return `${window.location.origin}${p}`;
};

export function ImageGrid({ images, maxDisplay = 6 }: ImageGridProps) {
  if (!images || images.length === 0) {
    return <div className="text-sm text-muted-foreground">이미지 없음</div>;
  }

  const displayImages = images.slice(0, maxDisplay);
  const remaining = images.length - maxDisplay;

  return (
    <div className="grid grid-cols-3 gap-2">
      {displayImages.map((img, idx) => {
        const url = toAbsUrl(img);
        return (
          <a
            key={idx}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative"
          >
            <img
              className="w-full h-20 object-cover rounded border hover:opacity-80 transition"
              src={url}
              alt={`이미지 ${idx + 1}`}
            />
          </a>
        );
      })}
      {remaining > 0 ? (
        <div className="flex items-center justify-center h-20 rounded border bg-muted text-sm text-muted-foreground">
          +{remaining}
        </div>
      ) : null}
    </div>
  );
}
