type Props = {
  appName?: string;
  logoUrl?: string | null;
  logoLetter?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
};

const ATLAS_MARK = "/brand/atlasnow_logo.png";

export function BrandMark({
  logoUrl,
  logoLetter = "A",
  size = "md",
  className = "",
}: Props) {
  const src = logoUrl || ATLAS_MARK;
  return (
    <span className={`relative flex shrink-0 items-center justify-center ${sizes[size]} ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
          {logoLetter.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
