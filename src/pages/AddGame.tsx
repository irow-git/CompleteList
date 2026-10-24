import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AddGameFormValues, GameForm, emptyGameFormValues } from "../components/GameForm";
import { BorderStyling, DynamicColorBorder, createBorderStyling } from "../components/DynamicColorBorder";
import { FormItem } from "../components/FormItem";
import { Button } from "@/components/ui/button";
import { useGamesStore } from "@/store/gamesStore";
import { useNavigate } from "react-router-dom";

const AddGame: React.FC = () => {
  const navigate = useNavigate();

  const addGame = useGamesStore((state) => state.add);

  const onFinish = (values: AddGameFormValues) => {
    addGame(values).then(() => {
      navigate('/');
    })
  };

  const form = useForm<AddGameFormValues>({
    mode: "onChange",
    defaultValues: { ...emptyGameFormValues, DLCs: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "DLCs" });
  const [borderStylings, setBorderStylings] = useState<BorderStyling[]>([]);

  const addDLCField = () => {
    setBorderStylings((prevState) => [...prevState, createBorderStyling()]);
    append(emptyGameFormValues);
  };

  const removeDLCField = (index: number) => {
    setBorderStylings((prevState) => prevState.filter((_, i) => i !== index));
    remove(index);
  };

  return (
    <div className="p-5 text-start">
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onFinish)} autoComplete="off" noValidate className="leading-[1.5714]">
          <GameForm />

          <div className="w-full">
            <div className="-mb-3 ml-2.5 inline-flex items-center gap-2">
              <h4 className="mt-[1.33em] mb-[0.5em] text-xl leading-[1.4] font-semibold">DLC List</h4>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="DLC-outer">
                <DynamicColorBorder styling={borderStylings[index]}>
                  <div className="flex px-[30px] py-5">
                    <GameForm prefix={`DLCs.${index}`} />
                    {/* Zero-size anchor that pins the Remove button to the box's top-right corner */}
                    <div className="relative -top-5 right-16 size-0">
                      <Button
                        size="sm"
                        className="form-control-clip-small absolute"
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
                <Plus className="size-4" />
                Add field
              </Button>
            </FormItem>
          </div>

          <FormItem className="-mt-5">
            <Button className="form-control-clip-large w-[200px]" size="lg" type="submit">
              Submit
            </Button>
          </FormItem>
        </form>
      </FormProvider>
    </div>
  );
};

export default AddGame;
