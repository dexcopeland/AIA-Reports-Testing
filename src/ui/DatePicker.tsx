import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIsoDate } from "@/engine/dates";
import { cn } from "cn";

function parseIso(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function DatePicker({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIso(value), [value]);
  const label = selected ? formatIsoDate(value) : "Choose a date";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "min-h-11 w-full justify-start bg-card px-3 text-left text-base font-normal",
              selected ? "text-foreground" : "text-muted-foreground",
              className,
            )}
          />
        }
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          startMonth={new Date(2018, 0)}
          endMonth={new Date(2040, 11)}
          onSelect={(date) => {
            onChange(date ? toIso(date) : "");
            if (date) setOpen(false);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          Clear date
        </Button>
      </PopoverContent>
    </Popover>
  );
}
