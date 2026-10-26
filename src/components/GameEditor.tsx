import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { Plus } from "pixelarticons/react";
import { useState } from "react";
import { AddGameFormValues, GameForm, emptyGameFormValues } from "./GameForm";
import { BorderStyling, DynamicColorBorder, createBorderStyling } from "./DynamicColorBorder";
import { FormItem } from "./FormItem";
import { Button } from "@/components/ui/button";

// The game form with its DLC list, shared by the Add and Edit pages
export const GameEditor: React.FC<{
  defaultValues: AddGameFormValues;
  onSubmit: (values: AddGameFormValues) => unknown;
}> = ({ defaultValues, onSubmit }) => {
  const form = useForm<AddGameFormValues>({ mode: "onChange", defaultValues });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "DLCs" });
  const [borderStylings, setBorderStylings] = useState<BorderStyling[]>(() =>
    defaultValues.DLCs.map(() => createBorderStyling())
  );

  const addDLCField = () => {
    setBorderStylings((prevState) => [...prevState, createBorderStyling()]);
    append({ ...emptyGameFormValues, id: crypto.randomUUID() });
  };

  const removeDLCField = (index: number) => {
    setBorderStylings((prevState) => prevState.filter((_, i) => i !== index));
    remove(index);
  };

  return (
    <div className="p-5 text-start">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" noValidate className="leading-[1.5714]">
          <GameForm />

          <div className="w-full">
            <div className="-mb-3 ml-2.5 inline-flex items-center gap-2">
              <h4 className="mt-[1.33em] mb-[0.5em] text-xl leading-[1.4] font-semibold">DLC List</h4>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="DLC-outer drop-shadow-[0px_1px_1px_black]">
                <DynamicColorBorder styling={borderStylings[index]}>
                  <div className="flex px-[30px] py-5">
                    <GameForm prefix={`DLCs.${index}`} />
                    <div className="relative -top-5 right-16 size-0 drop-shadow-[0px_1px_1px_black]">
                      <Button
                        size="sm"
                        className="form-control-clip-small absolute text-black"
                        style={{ backgroundColor: borderStylings[index].colorsHorizontal[3] }}
                        onClick={() => removeDLCField(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </DynamicColorBorder>
              </div>
            ))}
            <FormItem className="mt-[22px]">
              <Button className="form-control-clip-large w-[200px]" size="lg" onClick={addDLCField}>
                <Plus className="size-6" />
                Add field
              </Button>
            </FormItem>
          </div>

          <FormItem>
            <Button className="form-control-clip-large w-[200px]" size="lg" type="submit">
              Submit
            </Button>
          </FormItem>
        </form>
      </FormProvider>
    </div>
  );
};
