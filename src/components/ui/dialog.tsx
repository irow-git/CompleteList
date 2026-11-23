import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Close } from "pixelarticons/react"

import { cn } from "@/lib/utils"

// A dialog that's closed with its × button, Escape or a click outside (unlike AlertDialog, which needs an answer).
// Styled like AlertDialog

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/45 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "option-clip fixed top-1/2 left-1/2 z-50 w-[520px] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 bg-sand-light p-6 font-chava text-base text-black/88 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          title="Close"
          className="absolute top-5 right-5 cursor-pointer text-black/45 hover:text-black/88"
        >
          <Close className="size-6" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("font-pixel text-lg leading-snug", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-black/65", className)} {...props} />
}

export { Dialog, DialogContent, DialogTitle, DialogDescription }
