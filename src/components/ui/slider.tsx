import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// `color` replaces the ink of the filled part and the thumb
function Slider({
  className,
  thumbLabel,
  color,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel: string; color?: string }) {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn("relative flex h-5 w-32 touch-none items-center select-none", className)} {...props}>
      <SliderPrimitive.Track className="relative h-1.5 grow bg-sand-dark">
        <SliderPrimitive.Range className="absolute h-full bg-ink" style={color ? { backgroundColor: color } : undefined} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        style={color ? { backgroundColor: color } : undefined}
        className="block size-4 cursor-grab bg-ink outline-none hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
