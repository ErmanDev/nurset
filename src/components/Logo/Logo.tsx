import logoUrl from "../../assets/logo.svg";

interface Props {
  /** "light" places the logo on a white chip so it reads on the blue brand gradient. */
  variant?: "default" | "light";
  /** Rendered height in px; width follows the logo's aspect ratio. */
  height?: number;
}

export default function Logo({ variant = "default", height = 38 }: Props) {
  const img = <img src={logoUrl} alt="NurSet" height={height} style={{ display: "block", width: "auto" }} />;

  if (variant === "light") {
    return (
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignSelf: "flex-start",
          padding: "8px 14px",
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 6px 18px rgba(20, 40, 80, 0.18)",
        }}
      >
        {img}
      </div>
    );
  }
  return img;
}
