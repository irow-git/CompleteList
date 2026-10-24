import * as React from "react"
import { Close } from "pixelarticons/react"

import { cn } from "@/lib/utils"

// Small "×" used to remove a tag or clear a field's value
function RemoveButton({ className,size, ...props }: React.ComponentPropsWithoutRef<"button"> & {size: 'sm' | 'lg'}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-slot="remove-button"
      className={cn(
        "flex w-2.5 cursor-pointer items-center justify-center text-black/45 hover:text-black/88",
        className
      )}
      // Keep focus where it is (the select trigger or the date input)
      onMouseDown={(event) => event.preventDefault()}
      {...props}
    >
      <Close className={`size-${size === 'sm' ? 3 : 6} shrink-0`} />
    </button>
  )
}

export { RemoveButton }
