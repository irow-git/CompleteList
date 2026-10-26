import { useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, imageUrl, prepareImage } from "@/lib/images";
import { ipcErrorMessage } from "@/lib/ipcError";
import { cn } from "@/lib/utils";

// A cover picker: click to choose a file, drop one on it, or paste an image while it's focused.
// The picture is stored as soon as it's picked; the form only holds its reference until it's submitted
export const ImagePicker: React.FC<{ id?: string; value: string | null; onChange: (ref: string | null) => void }> = ({ id, value, onChange }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await window.api.images.save(await prepareImage(file)));
    } catch (error) {
      setError(ipcErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      <div className="drop-shadow-[0px_1px_1px_black]">
        <button
          id={id}
          type="button"
          disabled={busy}
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
            "option-clip relative flex aspect-[3/4] w-[120px] cursor-pointer items-center justify-center overflow-hidden bg-sand p-2 text-center text-xs text-black/45 disabled:cursor-wait",
            dragOver && "bg-sand-dark text-ink"
          )}
        >
          {value ? (
            <img src={imageUrl(value, "thumb")} alt="Cover" className="absolute inset-0 size-full object-cover" />
          ) : busy ? (
            "Saving…"
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
      </div>
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
