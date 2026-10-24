import { Controller, FieldError, FieldPath, get, useFormContext } from "react-hook-form";
import AppendableSelectDropdown, { SelectItem } from "./AppendableSelectDropdown";
import { FormItem } from "./FormItem";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { GameDetails, NewGame } from "../interfaces";

// The form edits exactly what gets stored, so submitted values can go straight to the database (AddGameFormValues = NewGame)
export type GameFormValues = GameDetails;

export type AddGameFormValues = NewGame;

export const emptyGameFormValues: GameFormValues = {
  title: "",
  completion: "",
  release_date: null,
  last_completion: null,
  platform: [],
  tags: [],
  original_copy: false,
  free_to_play: false,
  service: false,
  comment: "",
};

const checkboxFields = [
  { field: "original_copy", label: "Original Copy" },
  { field: "free_to_play", label: "Free to Play" },
  { field: "service", label: "Service" },
] as const;

// prefix is set when the form is rendered for a DLC, e.g. "DLCs.0"
export const GameForm: React.FC<{ prefix?: `DLCs.${number}` }> = ({ prefix }) => {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<AddGameFormValues>();

  const [platformItems, setPlatformItems] = useState<Array<SelectItem>>([
    { key: 1, value: "PC" },
    { key: 2, value: "Mobile" },
  ]);

  const [tagItems, setTagItems] = useState<Array<SelectItem>>([
    { key: 1, value: "Tough to beat" },
    { key: 2, value: "Hardest Difficulty" },
  ]);

  useEffect(() => {
    const localStoragePlatformItems = localStorage.getItem("platform-items");
    const localStorageTagItems = localStorage.getItem("tag-items");

    localStoragePlatformItems && setPlatformItems(JSON.parse(localStoragePlatformItems));
    localStorageTagItems && setTagItems(JSON.parse(localStorageTagItems));
  }, []);

  const name = <F extends keyof GameFormValues>(field: F) => (prefix ? `${prefix}.${field}` : field) as FieldPath<AddGameFormValues> & F;
  const id = (field: keyof GameFormValues) => (prefix ? `${prefix.replace(".", "_")}_${field}` : field);
  const error = (field: keyof GameFormValues): string | undefined => (get(errors, name(field)) as FieldError | undefined)?.message;

  return (
    <div className="grid w-full grid-cols-1 gap-6 pr-6 min-[1200px]:grid-cols-2">
      <FormItem label="Title" htmlFor={id("title")} required error={error("title")}>
        <Input
          id={id("title")}
          className="form-control-clip-large"
          size="lg"
          maxLength={200}
          placeholder="Enter Title"
          aria-invalid={!!error("title")}
          {...register(name("title"), { required: "Title required" })}
        />
      </FormItem>

      <FormItem label="Completion" htmlFor={id("completion")} required error={error("completion")}>
        <Input
          id={id("completion")}
          className="form-control-clip-large"
          size="lg"
          maxLength={200}
          placeholder="Enter Completion"
          aria-invalid={!!error("completion")}
          {...register(name("completion"), { required: "Completion required" })}
        />
      </FormItem>

      <FormItem label="Release Date" htmlFor={id("release_date")} required error={error("release_date")}>
        <Controller
          control={control}
          name={name("release_date")}
          rules={{ required: "Release date required" }}
          render={({ field }) => (
            <DatePicker
              id={id("release_date")}
              className="form-control-clip-large"
              placeholder="Choose Release Date"
              value={field.value ?? undefined}
              onChange={(date) => field.onChange(date ?? null)}
              onBlur={field.onBlur}
              aria-invalid={!!error("release_date")}
            />
          )}
        />
      </FormItem>

      <FormItem label="Date of Last Completion" htmlFor={id("last_completion")} required error={error("last_completion")}>
        <Controller
          control={control}
          name={name("last_completion")}
          rules={{ required: "Date of last completion required" }}
          render={({ field }) => (
            <DatePicker
              id={id("last_completion")}
              className="form-control-clip-large"
              placeholder="Choose Date of Last Completion"
              value={field.value ?? undefined}
              onChange={(date) => field.onChange(date ?? null)}
              onBlur={field.onBlur}
              aria-invalid={!!error("last_completion")}
            />
          )}
        />
      </FormItem>

      <FormItem label="Platform" htmlFor={id("platform")} required error={error("platform")}>
        <Controller
          control={control}
          name={name("platform")}
          rules={{ validate: (platforms) => platforms.length > 0 || "Platform required" }}
          render={({ field }) => (
            <AppendableSelectDropdown
              id={id("platform")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={!!error("platform")}
              localStorageKey="platform-items"
              selectItems={platformItems}
              setSelectItems={setPlatformItems}
              placeholder="Choose a Platform"
            />
          )}
        />
      </FormItem>

      <FormItem label="Tags" htmlFor={id("tags")}>
        <Controller
          control={control}
          name={name("tags")}
          render={({ field }) => (
            <AppendableSelectDropdown
              id={id("tags")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              localStorageKey="tag-items"
              selectItems={tagItems}
              setSelectItems={setTagItems}
              placeholder="Select Tags"
              nullable={true}
            />
          )}
        />
      </FormItem>

      <div>
        {checkboxFields.map(({ field, label }) => (
          <div key={field} className="relative h-8">
            <label htmlFor={id(field)} className="absolute top-[5px] left-[25px] leading-[22px]">
              {label}
            </label>
            <div className="flex h-8 items-center drop-shadow-[0px_1px_1px_black]">
              <Controller
                control={control}
                name={name(field)}
                render={({ field: { value, onChange, onBlur } }) => (
                  <Checkbox
                    id={id(field)}
                    checked={value}
                    onBlur={onBlur}
                    onCheckedChange={(checked) => {
                      onChange(checked === true);
                      // A service game always counts as an original copy
                      if (field === "service" && checked === true) setValue(name("original_copy"), true);
                    }}
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>

      <FormItem label="Comment" htmlFor={id("comment")}>
        <Textarea id={id("comment")} rows={3} maxLength={300} className="form-control-clip-large" {...register(name("comment"))} />
      </FormItem>
    </div>
  );
};
