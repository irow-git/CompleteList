import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 bg-ink font-[inherit] whitespace-nowrap text-white outline-none select-none transition-colors enabled:hover:text-highlight disabled:cursor-not-allowed disabled:bg-black/4 disabled:text-black/25 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-8 px-[15px] text-sm",
        sm: "h-6 px-[7px] text-sm",
        lg: "h-10 px-[15px] text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Button({
  className,
  size,
  asChild = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
