import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({ className, thumbLabel, ...props }: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel: string }) {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn("relative flex h-5 w-32 touch-none items-center select-none", className)} {...props}>
      <SliderPrimitive.Track className="relative h-1.5 grow bg-sand-dark">
        <SliderPrimitive.Range className="absolute h-full bg-ink" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        className="block size-4 cursor-grab bg-ink outline-none hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
