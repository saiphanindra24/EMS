export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: "full" | "mark";
  className?: string;
}) {
  if (variant === "mark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/volksskatt-mark.png"
        alt="VolkssKatt"
        className={className ?? "h-10 w-10 object-contain"}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/volksskatt-logo.png"
      alt="VolkssKatt Infotech Private Limited"
      className={className ?? "h-12 w-auto object-contain object-left"}
    />
  );
}
