import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HelpTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Help for ${label}`}
            className="size-8 shrink-0"
          />
        }
      >
        <CircleHelpIcon data-icon="inline-start" />
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-sm text-balance">{text}</TooltipContent>
    </Tooltip>
  );
}
