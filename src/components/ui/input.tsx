import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "min-w-0 bg-sand text-black/88 outline-none placeholder:text-black/25 aria-invalid:bg-error-bg",
  {
    variants: {
      size: {
        default: "h-[30px] px-[18px] py-1 text-sm leading-[22px]",
        lg: "h-[38px] w-full px-[21px] py-[5.5px] text-lg leading-[27px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// forwardRef because this project is on React 18 (react-hook-form's register() needs the ref)
const Input = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<"input">, "size"> & VariantProps<typeof inputVariants>
>(({ className, size, ...props }, ref) => {
  return (
    <input
      ref={ref}
      data-slot="input"
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
