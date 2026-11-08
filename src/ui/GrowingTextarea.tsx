import type { ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";

const supportsFieldSizing = typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");

export function GrowingTextarea({
  className,
  value,
  onChange,
  ...props
}: ComponentProps<typeof Textarea>) {
  if (supportsFieldSizing) {
    return <Textarea className={className} value={value} onChange={onChange} {...props} />;
  }
  const text = typeof value === "string" ? value : "";
  return (
    <div className="grow-wrap" data-replicated-value={text}>
      <Textarea
        className={className}
        value={value}
        onChange={(event) => {
          const parent = event.currentTarget.parentElement;
          if (parent) parent.dataset.replicatedValue = event.currentTarget.value;
          onChange?.(event);
        }}
        {...props}
      />
    </div>
  );
}
