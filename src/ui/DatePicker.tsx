import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIsoDate } from "@/engine/dates";
import { cn } from "cn";

function parseIso(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
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
  const [typed, setTyped] = useState(value);
  const selected = useMemo(() => parseIso(value), [value]);
  const label = selected ? formatIsoDate(value) : "Choose a date";
  const selectedYear = selected?.getFullYear();
  const startYear = Math.min(1900, selectedYear ?? 1900);
  const endYear = Math.max(2100, selectedYear ?? 2100);
  useEffect(() => {
    setTyped(value);
  }, [value]);
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
          startMonth={new Date(startYear, 0)}
          endMonth={new Date(endYear, 11)}
          onSelect={(date) => {
            onChange(date ? toIso(date) : "");
            if (date) setOpen(false);
          }}
        />
        <Field>
          <FieldLabel htmlFor={`${id}-typed`}>Type a date</FieldLabel>
          <Input
            id={`${id}-typed`}
            name={`${id}-typed`}
            value={typed}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-typed-hint`}
            onValueChange={(next) => {
              setTyped(next);
              const trimmed = next.trim();
              if (trimmed === "") {
                onChange("");
                return;
              }
              const parsed = parseIso(trimmed);
              if (parsed) onChange(toIso(parsed));
            }}
          />
          <FieldDescription id={`${id}-typed-hint`}>Year-month-day, such as 1998-04-12. Any year is accepted.</FieldDescription>
        </Field>
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
