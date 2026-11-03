import type { Priority } from "../../types";
import { PRIORITY_CLASSES, PRIORITY_LABEL } from "../../utils/format";

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
