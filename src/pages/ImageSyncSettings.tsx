import { useCallback, useEffect, useState } from "react";
import { ImageSyncProviderId, ImageSyncStatus } from "../interfaces";
import { IMAGE_SYNC_PROVIDERS } from "@/lib/imageSyncProviders";
import { ipcErrorMessage } from "@/lib/ipcError";
import { useSyncStore } from "@/store/syncStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Commands are shown in a monospace font: the pixel fonts only have capitals, and these have to be typed exactly
const commandClass = "overflow-x-auto bg-dirty-white px-3 py-2 font-mono text-sm leading-normal normal-case select-all";

const INSTALL_STEPS = [
  { os: "Linux", command: "sudo -v ; curl https://rclone.org/install.sh | sudo bash", note: "Distribution packages are often too old; the app needs rclone 1.55 or newer." },
  { os: "macOS", command: "brew install rclone", note: "Or download it from rclone.org." },
  { os: "Windows", command: "winget install Rclone.Rclone", note: "Restart this app afterwards, so it sees the new PATH." },
];

const Step: React.FC<{ number: number; title: string; done?: boolean; children: React.ReactNode }> = ({ number, title, done, children }) => (
  <section className="mb-8 max-w-[760px]">
    <h3 className="mb-3 flex items-center gap-3 font-pixel text-base">
      <span className={cn("inline-flex size-7 items-center justify-center text-sm text-white", done ? "bg-green-700" : "bg-ink")}>{number}</span>
      {title}
    </h3>
    <div className="pl-10">{children}</div>
  </section>
);

const ImageSyncSettings: React.FC = () => {
  const refreshSync = useSyncStore((state) => state.refresh);
  const [status, setStatus] = useState<ImageSyncStatus | null>(null);
  const [customPath, setCustomPath] = useState("");
  const [provider, setProvider] = useState<ImageSyncProviderId>("drive");
  const [folder, setFolder] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [imagesFolder, setImagesFolder] = useState("");

  const apply = useCallback((next: ImageSyncStatus) => {
    setStatus(next);
    setCustomPath(next.customRclonePath ?? "");
    setFolder(next.folder);
    if (next.provider) setProvider(next.provider);
  }, []);

  useEffect(() => {
    window.api.imageSync.status().then(apply);
    window.api.images.folder().then(setImagesFolder);
    return window.api.imageSync.onLoginUrl(setLoginUrl);
  }, [apply]);

  const run = async (action: () => Promise<ImageSyncStatus>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      apply(await action());
      if (success) setMessage({ kind: "success", text: success });
    } catch (error) {
      setMessage({ kind: "error", text: ipcErrorMessage(error) });
    } finally {
      setBusy(false);
      refreshSync();
    }
  };

  const connect = async () => {
    setConnecting(true);
    setLoginUrl(null);
    const label = IMAGE_SYNC_PROVIDERS.find((p) => p.id === provider)?.label;
    await run(() => window.api.imageSync.connect(provider, folder), `Connected to ${label}. Images sync when you press Sync.`);
    setConnecting(false);
    setLoginUrl(null);
  };

  if (!status) return null;

  const connectedTo = IMAGE_SYNC_PROVIDERS.find((p) => p.id === status.provider);
  const selected = IMAGE_SYNC_PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div>
      <h2 className="mb-2 font-pixel text-xl">Image sync</h2>
      <p className="mb-8 max-w-[760px] text-black/65">
        Covers are stored on this computer. To have them on your other computers too, the app copies them to your cloud
        storage using rclone, a free tool for syncing files with cloud services. It runs when you press Sync, after the
        games: new covers are uploaded, and covers your games use but this computer doesn't have are downloaded. Nothing
        is ever deleted from the cloud.
      </p>

      <div className="mb-8 flex max-w-[760px] flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-black/65">Covers on this computer:</span>
        <code className="font-mono text-sm break-all normal-case">{imagesFolder}</code>
        <div className="drop-shadow-[0px_1px_1px_black]">
          <Button
            className="form-control-clip"
            onClick={() => window.api.images.openFolder().catch((error) => setMessage({ kind: "error", text: ipcErrorMessage(error) }))}
          >
            Open folder
          </Button>
        </div>
      </div>

      <Step number={1} title="Install rclone" done={!!status.rclone}>
        {status.rclone ? (
          <p className="mb-3">
            Found rclone {status.rclone.version} at <code className="font-mono text-sm normal-case">{status.rclone.path}</code>
          </p>
        ) : (
          <>
            <p className="mb-3 text-error">rclone wasn't found on this computer.</p>
            <p className="mb-3">Install it with the command for your system, then press Check again:</p>
            <ul className="mb-4 flex flex-col gap-3">
              {INSTALL_STEPS.map(({ os, command, note }) => (
                <li key={os}>
                  <span className="font-pixel text-sm">{os}</span>
                  <pre className={commandClass}>{command}</pre>
                  <span className="text-sm text-black/55">{note}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[420px] drop-shadow-[0px_1px_1px_black]">
            <Input
              aria-label="Path to rclone"
              size="lg"
              placeholder="Path to rclone (optional; found automatically)"
              value={customPath}
              onChange={(event) => setCustomPath(event.target.value)}
              className="form-control-clip-large font-mono text-base"
            />
          </div>
          <Button
            size="lg"
            className="form-control-clip-large"
            disabled={busy}
            onClick={() => run(() => window.api.imageSync.setRclonePath(customPath || null))}
          >
            {customPath.trim() !== (status.customRclonePath ?? "") ? "Save path" : "Check again"}
          </Button>
        </div>
      </Step>

      <Step number={2} title="Connect your storage" done={!!connectedTo}>
        {connectedTo && (
          <p className="mb-4">
            Connected to <strong>{connectedTo.label}</strong>, folder <code className="font-mono text-sm normal-case">{status.folder}</code>.
            Connecting again (e.g. to switch storage) replaces this.
          </p>
        )}
        <fieldset disabled={!status.rclone || connecting} className="disabled:opacity-50">
          <legend className="sr-only">Storage</legend>
          <div className="mb-4 grid gap-3 min-[1200px]:grid-cols-2">
            {IMAGE_SYNC_PROVIDERS.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer gap-3 border-2 p-3",
                  provider === option.id ? "border-ink bg-sand-light" : "border-sand hover:border-ink/40"
                )}
              >
                <input type="radio" name="provider" value={option.id} checked={provider === option.id} onChange={() => setProvider(option.id)} className="mt-1 accent-ink" />
                <span>
                  <span className="block font-pixel text-sm">{option.label}</span>
                  <span className="text-sm text-black/65">{option.note}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="mb-4 block">
            <span className="mb-2 block">Folder in the storage</span>
            <div className="w-[420px] drop-shadow-[0px_1px_1px_black]">
              <Input size="lg" value={folder} onChange={(event) => setFolder(event.target.value)} className="form-control-clip-large font-mono text-base" />
            </div>
          </label>
        </fieldset>

        {connecting ? (
          <div className="flex flex-col items-start gap-3 bg-dirty-white p-4">
            <p>Waiting for you to sign in to {selected.label} in your browser…</p>
            {loginUrl && (
              <p className="text-sm text-black/65">
                No browser window?{" "}
                <button type="button" className="cursor-pointer text-ink underline" onClick={() => window.api.imageSync.openLoginPage(loginUrl)}>
                  Open the sign-in page
                </button>
              </p>
            )}
            <button type="button" className="cursor-pointer text-ink underline" onClick={() => window.api.imageSync.cancelConnect()}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="drop-shadow-[0px_1px_1px_black]">
              <Button size="lg" className="form-control-clip-large w-[200px]" disabled={!status.rclone || busy} onClick={connect}>
                Connect
              </Button>
            </div>
            {connectedTo && (
              <button
                type="button"
                disabled={busy}
                className="cursor-pointer text-ink underline"
                onClick={() => run(() => window.api.imageSync.disconnect(), "Image sync turned off. Images already in the cloud stay there.")}
              >
                Disconnect
              </button>
            )}
          </div>
        )}
      </Step>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={cn("max-w-[760px] pl-10", message.kind === "error" ? "text-error" : "text-green-700")}>
          {message.text}
        </p>
      )}
    </div>
  );
};

export default ImageSyncSettings;
