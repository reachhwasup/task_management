import { useState } from "react";
import { initials } from "../../utils/format";

interface AvatarProps {
  name: string;
  color?: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md";
}

const SIZE_CLASSES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
};

export default function Avatar({ name, color = "#94a3b8", imageUrl, size = "sm" }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        title={name}
        onError={() => setImageFailed(true)}
        className={`shrink-0 rounded-full object-cover ${SIZE_CLASSES[size]}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
