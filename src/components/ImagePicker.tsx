import { useCallback, useEffect, useRef, useState } from "react";
import { CoverEntry } from "@/interfaces";
import { ACCEPTED_IMAGE_TYPES, checkImageFile, imageUrl } from "@/lib/images";
import { CoverCropDialog } from "./CoverCropDialog";
import { ipcErrorMessage } from "@/lib/ipcError";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// A cover picker: click to choose a file, drop one on it, or paste an image while it's focused. The picture then
// opens in the cropper, and the cropped cover is stored (in the folder of `owner`, the game or DLC) as soon as it's
// confirmed; the form only holds its reference until it's submitted. Covers the game has been saved with before are
// listed next to it, to pick again or delete
export const ImagePicker: React.FC<{ id?: string; owner: string; value: string | null; onChange: (ref: string | null) => void }> = ({
  id,
  owner,
  value,
  onChange,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CoverEntry[]>([]);
  const [deleting, setDeleting] = useState<CoverEntry | null>(null);

  const loadHistory = useCallback(() => {
    if (!owner) return setHistory([]);
    window.api.covers.list(owner).then(setHistory, () => setHistory([]));
  }, [owner]);

  useEffect(loadHistory, [loadHistory]);

  // Wrong type or too big is reported straight away, before the cropper opens
  const store = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    try {
      checkImageFile(file);
      setCropping(file);
    } catch (error) {
      setError(ipcErrorMessage(error));
    }
  };

  const deleteCover = async (cover: CoverEntry) => {
    try {
      await window.api.covers.remove(cover.id);
      if (cover.image === value) onChange(null);
    } catch (error) {
      setError(ipcErrorMessage(error));
    } finally {
      setDeleting(null);
      loadHistory();
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="drop-shadow-[0px_1px_1px_black]">
        <button
          id={id}
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            store(event.dataTransfer.files[0]);
          }}
          onPaste={(event) => store(event.clipboardData.files[0])}
          className={cn(
            "option-clip relative flex aspect-[2/3] w-[120px] cursor-pointer items-center justify-center overflow-hidden bg-sand p-2 text-center text-xs text-black/45",
            dragOver && "bg-sand-dark text-ink"
          )}
        >
          {value ? (
            <img src={imageUrl(owner, value, "thumb")} alt="Cover" className="absolute inset-0 size-full object-cover" />
          ) : (
            "Choose, drop or paste an image"
          )}
        </button>
      </div>
      <div className="flex flex-col items-start gap-2 pt-1">
        {value && (
          <button type="button" className="cursor-pointer text-ink underline" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
        {error && <p className="max-w-[220px] text-error">{error}</p>}
        {history.length > 0 && (
          <div>
            <span className="mb-1 block text-xs text-black/55">Covers it's had</span>
            <ul className="flex max-w-[260px] flex-wrap gap-2">
              {history.map((cover) => (
                <li key={cover.id} className="group relative">
                  <button
                    type="button"
                    title={cover.image === value ? "The current cover" : "Use this cover"}
                    aria-pressed={cover.image === value}
                    onClick={() => onChange(cover.image)}
                    className={cn(
                      "block aspect-[2/3] w-[44px] cursor-pointer overflow-hidden bg-sand outline-offset-2",
                      cover.image === value ? "outline-2 outline-ink" : "opacity-75 hover:opacity-100"
                    )}
                  >
                    <img src={imageUrl(owner, cover.image, "thumb")} alt="" className="size-full object-cover" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete this cover"
                    title="Delete this cover"
                    onClick={() => setDeleting(cover)}
                    className="absolute -top-1.5 -right-1.5 hidden size-4 cursor-pointer items-center justify-center bg-ink text-[10px] leading-none text-white group-focus-within:flex group-hover:flex"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <CoverCropDialog
        file={cropping}
        owner={owner}
        onCancel={() => setCropping(null)}
        onDone={(ref) => {
          setCropping(null);
          onChange(ref);
        }}
      />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this cover?</AlertDialogTitle>
          <AlertDialogDescription>
            It's removed from this computer now, and from the cloud and your other computers at the next sync.
            {deleting?.image === value && " It's the current cover, so the game goes back to having none."}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => deleting && deleteCover(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(event) => {
          store(event.target.files?.[0]);
          // Choosing the same file again should still trigger a change
          event.target.value = "";
        }}
      />
    </div>
  );
};
