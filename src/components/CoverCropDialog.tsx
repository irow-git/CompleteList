import { useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { COVER_ASPECT, CropArea, cropCover, readImage } from "@/lib/images";
import { ipcErrorMessage } from "@/lib/ipcError";
import { cn } from "@/lib/utils";

// The area the picture is shown in; it's scaled to fit, while the crop itself happens at full resolution
const STAGE_WIDTH = 700;
const STAGE_HEIGHT = 480;
const MIN_CROP_WIDTH = 60;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Keeps the frame at the cover's ratio and inside the picture
function fit(area: Pick<CropArea, "x" | "y" | "width">, image: { width: number; height: number }): CropArea {
  const maxWidth = Math.min(image.width, image.height * COVER_ASPECT);
  const width = clamp(area.width, Math.min(MIN_CROP_WIDTH, maxWidth), maxWidth);
  const height = width / COVER_ASPECT;
  return { width, height, x: clamp(area.x, 0, image.width - width), y: clamp(area.y, 0, image.height - height) };
}

// The largest frame that fits, centred
const initialArea = (image: { width: number; height: number }) => {
  const width = Math.min(image.width, image.height * COVER_ASPECT);
  return fit({ width, x: (image.width - width) / 2, y: (image.height - width / COVER_ASPECT) / 2 }, image);
};

type Drag = { mode: "move" | "resize"; pointerX: number; pointerY: number; start: CropArea };

// Picks the part of a picture shown as the card's cover, then stores it. Resolves to the stored image's reference
export const CoverCropDialog: React.FC<{ file: File | null; onCancel: () => void; onDone: (ref: string) => void }> = ({ file, onCancel, onDone }) => {
  const [image, setImage] = useState<{ bitmap: ImageBitmap; url: string } | null>(null);
  const [area, setArea] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const url = URL.createObjectURL(file);
    let bitmap: ImageBitmap | null = null;
    setError(null);
    readImage(file)
      .then((loaded) => {
        bitmap = loaded;
        if (cancelled) return loaded.close();
        setImage({ bitmap: loaded, url });
        setArea(initialArea(loaded));
      })
      .catch((reason) => setError(ipcErrorMessage(reason)));
    return () => {
      cancelled = true;
      bitmap?.close();
      URL.revokeObjectURL(url);
      setImage(null);
      setArea(null);
    };
  }, [file]);

  const size = image ? { width: image.bitmap.width, height: image.bitmap.height } : null;
  const scale = size ? Math.min(STAGE_WIDTH / size.width, STAGE_HEIGHT / size.height) : 1;

  const startDrag = (mode: Drag["mode"]) => (event: React.PointerEvent<HTMLElement>) => {
    if (!area) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, pointerX: event.clientX, pointerY: event.clientY, start: area };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current || !size) return;
    const { mode, pointerX, pointerY, start } = drag.current;
    const dx = (event.clientX - pointerX) / scale;
    const dy = (event.clientY - pointerY) / scale;
    if (mode === "move") {
      setArea(fit({ ...start, x: start.x + dx, y: start.y + dy }, size));
    } else {
      // The top-left corner stays put; the frame follows whichever way the pointer moved further
      const width = Math.min(start.width + Math.max(dx, dy * COVER_ASPECT), size.width - start.x, (size.height - start.y) * COVER_ASPECT);
      setArea(fit({ ...start, width }, size));
    }
  };

  // Zooms around the frame's centre
  const resizeBy = (factor: number) => {
    if (!area || !size) return;
    const width = area.width * factor;
    const centreX = area.x + area.width / 2;
    const centreY = area.y + area.height / 2;
    setArea(fit({ width, x: centreX - width / 2, y: centreY - width / COVER_ASPECT / 2 }, size));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!area || !size) return;
    const step = (event.shiftKey ? 0.1 : 0.01) * size.width;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      setArea(fit({ ...area, x: area.x + moves[event.key][0], y: area.y + moves[event.key][1] }, size));
    } else if (event.key === "+" || event.key === "=") {
      resizeBy(1.05);
    } else if (event.key === "-") {
      resizeBy(1 / 1.05);
    }
  };

  const save = async () => {
    if (!image || !area) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await window.api.images.save(await cropCover(image.bitmap, area)));
    } catch (reason) {
      setError(ipcErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={!!file} onOpenChange={(open) => !open && !saving && onCancel()}>
      <AlertDialogContent className="w-[760px]">
        <AlertDialogTitle>Crop the cover</AlertDialogTitle>
        <AlertDialogDescription className="mb-4">
          Drag the frame to choose the part shown on the card. Drag its corner, scroll, or press + and − to resize.
        </AlertDialogDescription>

        <div className="flex min-h-[200px] items-center justify-center bg-black/80">
          {image && size && area ? (
            <div
              className="relative touch-none overflow-hidden select-none"
              style={{ width: size.width * scale, height: size.height * scale }}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onWheel={(event) => resizeBy(event.deltaY < 0 ? 1.06 : 1 / 1.06)}
            >
              <img src={image.url} alt="" draggable={false} className="pointer-events-none size-full" />
              <div
                role="slider"
                tabIndex={0}
                aria-label="Cover area"
                aria-valuetext={`${Math.round(area.width)} by ${Math.round(area.height)} pixels`}
                onPointerDown={startDrag("move")}
                onKeyDown={onKeyDown}
                className="absolute cursor-move outline-2 outline-white outline-dashed focus-visible:outline-highlight"
                style={{
                  left: area.x * scale,
                  top: area.y * scale,
                  width: area.width * scale,
                  height: area.height * scale,
                  // Dims everything outside the frame (the stage clips the shadow)
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
                }}
              >
                {/* Inside the corner: the frame often touches the picture's edge, where anything outside it is clipped */}
                <span
                  aria-hidden
                  onPointerDown={startDrag("resize")}
                  className="absolute right-0 bottom-0 size-4 cursor-nwse-resize border-2 border-ink bg-white"
                />
              </div>
            </div>
          ) : (
            !error && <span className="text-white/60">Loading…</span>
          )}
        </div>

        {error && <p role="alert" className="mt-3 text-error">{error}</p>}

        <AlertDialogFooter>
          <div className="drop-shadow-[0px_1px_1px_black]">
            <button type="button" className={cn(buttonVariants(), "form-control-clip")} disabled={saving} onClick={onCancel}>
              Cancel
            </button>
          </div>
          <div className="drop-shadow-[0px_1px_1px_black]">
            <button type="button" className={cn(buttonVariants(), "form-control-clip")} disabled={!area || saving} onClick={save}>
              {saving ? "Saving…" : "Use image"}
            </button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
