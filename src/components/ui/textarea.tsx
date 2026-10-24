import * as React from "react"

import { cn } from "@/lib/utils"

// forwardRef because this project is on React 18 (react-hook-form's register() needs the ref)
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentPropsWithoutRef<"textarea">>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "block w-full resize-none overflow-hidden bg-sand px-[22px] py-1 text-sm leading-[22px] text-black/88 outline-none placeholder:text-black/25 aria-invalid:bg-error-bg",
        className
      )}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
