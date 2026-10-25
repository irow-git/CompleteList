import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FirebaseConfig, FirebaseSettings } from "../interfaces";
import { Panel } from "@/layout/Panel";
import { FormItem } from "@/components/FormItem";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSyncStore } from "@/store/syncStore";
import { ipcErrorMessage } from "@/lib/ipcError";

type SettingsFormValues = FirebaseConfig & { email: string; password: string; createAccount: boolean };

const CONFIG_FIELDS: { field: keyof FirebaseConfig; label: string; required: boolean }[] = [
  { field: "apiKey", label: "API key", required: true },
  { field: "authDomain", label: "Auth domain", required: true },
  { field: "projectId", label: "Project ID", required: true },
  { field: "appId", label: "App ID", required: true },
  { field: "storageBucket", label: "Storage bucket", required: false },
  { field: "messagingSenderId", label: "Messaging sender ID", required: false },
];

const emptyValues: SettingsFormValues = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
  storageBucket: "",
  messagingSenderId: "",
  email: "",
  password: "",
  createAccount: false,
};

// The Firebase console shows the config as a JS object (`apiKey: "..."`), not JSON, so pick out the key/value pairs
const parseConfigSnippet = (snippet: string) =>
  Object.fromEntries([...snippet.matchAll(/(\w+)\s*:\s*["'`]([^"'`]*)["'`]/g)].map(([, key, value]) => [key, value]));

// The pixel fonts only have capitals, but keys, ids and emails are case-sensitive, so these fields show them as typed
const credentialClass = "form-control-clip-large font-mono text-base";

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`;

const Settings: React.FC = () => {
  const refreshSync = useSyncStore((state) => state.refresh);
  // undefined while loading
  const [saved, setSaved] = useState<FirebaseSettings | null | undefined>(undefined);
  const [secureStorage, setSecureStorage] = useState(true);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const form = useForm<SettingsFormValues>({ mode: "onChange", defaultValues: emptyValues });
  const { register, control, handleSubmit, setValue, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    window.api.settings.getFirebase().then(({ settings, secureStorage }) => {
      setSaved(settings);
      setSecureStorage(secureStorage);
      if (settings) reset({ ...emptyValues, ...settings.config, email: settings.email });
    });
  }, [reset]);

  const fillFromSnippet = (snippet: string) => {
    const parsed = parseConfigSnippet(snippet);
    for (const { field } of CONFIG_FIELDS) {
      if (parsed[field]) setValue(field, parsed[field], { shouldValidate: true, shouldDirty: true });
    }
  };

  const onSubmit = async ({ email, password, createAccount, ...config }: SettingsFormValues) => {
    setMessage(null);
    try {
      await window.api.settings.saveFirebase({
        config: { ...config, storageBucket: config.storageBucket || undefined, messagingSenderId: config.messagingSenderId || undefined },
        email,
        // Empty means "keep the saved password"
        password: password || undefined,
        createAccount,
      });
      setSaved({ config, email });
      reset({ ...config, email, password: "", createAccount: false });
      setMessage({ kind: "success", text: createAccount ? "Account created and sync set up." : "Signed in. Sync is set up." });
    } catch (error) {
      setMessage({ kind: "error", text: ipcErrorMessage(error) });
    } finally {
      refreshSync();
    }
  };

  const disconnect = async () => {
    await window.api.settings.clearFirebase();
    setSaved(null);
    reset(emptyValues);
    setMessage({ kind: "success", text: "Sync turned off. Your games stay on this computer." });
    refreshSync();
  };

  if (saved === undefined) return <Panel />;

  return (
    <Panel className="font-chava text-base">
      <div className="p-5 text-start">
        <h2 className="mb-2 font-pixel text-xl">Cloud sync</h2>
        <p className="mb-6 max-w-[720px] text-black/65">
          Everything works offline. To sync between computers, connect your own Firebase project: create a web app
          in the Firebase console, enable Email/Password sign-in under Authentication, create a Firestore database
          and give it the rules below. Syncing only happens when you press Sync.
        </p>

        {!secureStorage && (
          <p role="alert" className="mb-6 max-w-[720px] bg-error-bg p-3">
            This system has no keyring available, so the saved password is only weakly protected. Installing and
            unlocking a keyring (e.g. GNOME Keyring or KWallet) fixes that.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" noValidate className="leading-[1.5714]">
          <h3 className="mb-4 font-pixel text-base">Firebase project</h3>
          <FormItem label="Paste config" htmlFor="config-snippet">
            <Textarea
              id="config-snippet"
              rows={3}
              className={credentialClass}
              placeholder="Paste the firebaseConfig snippet from the Firebase console to fill in the fields below"
              onChange={(event) => fillFromSnippet(event.target.value)}
            />
          </FormItem>
          <div className="grid grid-cols-1 gap-x-6 min-[1200px]:grid-cols-2">
            {CONFIG_FIELDS.map(({ field, label, required }) => (
              <FormItem key={field} label={label} htmlFor={field} required={required} error={errors[field]?.message}>
                <Input
                  id={field}
                  size="lg"
                  className={credentialClass}
                  aria-invalid={!!errors[field]}
                  {...register(field, required ? { required: `${label} required` } : {})}
                />
              </FormItem>
            ))}
          </div>

          <h3 className="mt-2 mb-4 font-pixel text-base">Account</h3>
          <div className="grid grid-cols-1 gap-x-6 min-[1200px]:grid-cols-2">
            <FormItem label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                size="lg"
                className={credentialClass}
                aria-invalid={!!errors.email}
                {...register("email", { required: "Email required" })}
              />
            </FormItem>
            <FormItem label="Password" htmlFor="password" required={!saved} error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                size="lg"
                className="form-control-clip-large"
                placeholder={saved ? "Saved; leave empty to keep it" : undefined}
                aria-invalid={!!errors.password}
                {...register("password", saved ? {} : { required: "Password required" })}
              />
            </FormItem>
          </div>
          <label className="mb-6 flex cursor-pointer items-center gap-3">
            <Controller
              control={control}
              name="createAccount"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            Create this account (first time only; otherwise sign in to an existing one)
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <div className="drop-shadow-[0px_1px_1px_black]">
              <Button className="form-control-clip-large w-[200px]" size="lg" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Save"}
              </Button>
            </div>
            {saved && (
              <AlertDialog>
                <AlertDialogTrigger className="cursor-pointer text-ink underline">Turn off sync</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>Turn off sync?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The saved Firebase settings and password are removed from this computer. Your games stay here,
                    and nothing is deleted from Firebase.
                  </AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive" onClick={disconnect}>
                      Turn off
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {message && (
              <span role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-error" : "text-green-700"}>
                {message.text}
              </span>
            )}
          </div>
        </form>

        <h3 className="mt-10 mb-2 font-pixel text-base">Firestore rules</h3>
        <p className="mb-3 text-black/65">Each account can only read and write its own games:</p>
        <pre className="overflow-x-auto bg-dirty-white p-4 font-mono text-sm leading-normal select-all">{RULES}</pre>
      </div>
    </Panel>
  );
};

export default Settings;
