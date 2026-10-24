import { cn } from "@/lib/utils";

type FormItemProps = {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

// Label + control + a 24px strip below it that doubles as the error line, so errors don't shift the layout
export const FormItem: React.FC<FormItemProps> = ({ label, htmlFor, required, error, className, children }) => {
  return (
    <div className={cn("mb-6", className)}>
      {label && (
        <div className="pb-2 leading-[22px]">
          <label
            id={htmlFor && `${htmlFor}-label`}
            htmlFor={htmlFor}
            className={cn(
              "relative inline-flex h-[22px] items-center",
              required && "before:mr-1 before:inline-block before:font-pixel before:text-lg before:leading-none before:text-error before:content-['*']"
            )}
          >
            {label}
          </label>
        </div>
      )}
      <div className="relative flex min-h-8 items-center">
        <div className="min-w-0 flex-auto drop-shadow-[0px_1px_1px_black]">{children}</div>
        {error && (
          <div role="alert" className="absolute inset-x-0 top-full text-center leading-[22px] text-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
