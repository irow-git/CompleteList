"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "pixelarticons/react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-5 shrink-0 cursor-pointer items-center justify-center border border-input bg-sand outline-none transition-colors hover:border-primary focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:border-transparent data-[state=checked]:hover:bg-black/54",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <Check className="size-6" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
