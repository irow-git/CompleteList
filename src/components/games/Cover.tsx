import { useEffect, useState } from "react";
import { imageUrl } from "@/lib/images";
import { titleWithoutArticle } from "@/lib/titles";
import { cn } from "@/lib/utils";

// Games without a cover (or whose image isn't on this computer yet) get a placeholder: the title's first letter on a
// colour picked from the title, so a game keeps the same colour between visits
const COVER_COLORS = ["#47434d", "#7e768a", "#555559", "#6b5d52", "#4e5b63", "#5f4b57", "#3f5246"];

export const coverColor = (title: string) => {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
};

// The placeholder's background, also behind a cover while it loads
export const coverBackground = (title: string) => `linear-gradient(0deg, black 0%, ${coverColor(title)} 100%)`;

// The placeholder's letter, filling whatever box it's in. Its size is 45% of the nearest container's width (cqw), so
// the box (or one around it) needs `@container`
export const CoverLetter: React.FC<{ title: string; className?: string }> = ({ title, className }) => (
  <span aria-hidden className={cn("absolute inset-0 flex items-center justify-center font-pixel text-[45cqw] text-white/85", className)}>
    {titleWithoutArticle(title).charAt(0).toUpperCase()}
  </span>
);

// A game's or DLC's cover filling its box, or the placeholder when it has none or the file is missing. `owner` is the
// game's or DLC's id (covers are stored per owner, see src/lib/images.ts)
export const Cover: React.FC<{
  owner: string;
  image: string | null;
  title: string;
  className?: string;
  letterClassName?: string;
}> = ({ owner, image, title, className, letterClassName }) => {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [owner, image]);

  return (
    <div className={cn("@container relative overflow-hidden", className)} style={{ background: coverBackground(title) }}>
      {image && !missing ? (
        <img
          src={imageUrl(owner, image)}
          alt=""
          loading="lazy"
          onError={() => setMissing(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <CoverLetter title={title} className={letterClassName} />
      )}
    </div>
  );
};
