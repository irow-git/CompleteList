import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "pixelarticons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RemoveButton } from "@/components/ui/remove-button";
import { cn } from "@/lib/utils";

export type SelectItem = { key: number; value: string };

// Items with these keys are the built-in defaults and can't be removed
const LAST_DEFAULT_KEY = 2;

const tagClass =
  "my-0.5 mr-1 flex h-8 shrink-0 cursor-default items-center px-2.5 leading-[30px] not-first:border-l-[3px] not-first:border-sand-dark";

// Shows as many tags as fit on one line and collapses the rest into a "+ N ..." tag
const useVisibleTagCount = (values: string[]) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(values.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const widths = [...measure.children].map((child) => (child as HTMLElement).getBoundingClientRect().width + 4);
      const restWidth = widths.pop() ?? 0;
      let used = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const reserve = i === widths.length - 1 ? 0 : restWidth;
        if (used + widths[i] + reserve > container.clientWidth) break;
        used += widths[i];
        count++;
      }
      setVisibleCount(count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [values]);

  return { containerRef, measureRef, visibleCount };
};

const AppendableSelectDropdown: React.FC<{
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  invalid?: boolean;
  localStorageKey: string;
  selectItems: SelectItem[];
  setSelectItems: React.Dispatch<React.SetStateAction<SelectItem[]>>;
  placeholder?: string;
  nullable?: boolean;
}> = ({ id, value = [], onChange, onBlur, invalid, localStorageKey, selectItems, setSelectItems, placeholder, nullable = false }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newSelectItem, setNewSelectItem] = useState("");
  const newSelectItemInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const { containerRef, measureRef, visibleCount } = useVisibleTagCount(value);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  const toggleValue = (itemValue: string) => {
    onChange(value.includes(itemValue) ? value.filter((v) => v !== itemValue) : [...value, itemValue]);
  };

  const saveSelectItems = (items: SelectItem[]) => {
    setSelectItems(items);
    localStorage.setItem(localStorageKey, JSON.stringify(items));
  };

  const addSelectItem = () => {
    if (!newSelectItem) return;
    const lastKey = selectItems[selectItems.length - 1]?.key ?? 0;
    saveSelectItems([...selectItems, { key: lastKey + 1, value: newSelectItem }]);
    setNewSelectItem("");
    newSelectItemInputRef.current?.focus();
  };

  const removeSelectItem = (event: React.MouseEvent, item: SelectItem) => {
    event.stopPropagation();
    if (value.includes(item.value)) onChange(value.filter((v) => v !== item.value));
    saveSelectItems(selectItems.filter((selectItem) => selectItem.key !== item.key));
    newSelectItemInputRef.current?.focus();
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, selectItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = selectItems[activeIndex];
      item && toggleValue(item.value);
    }
  };

  const renderTag = (tagValue: string, removable: boolean, key: React.Key) => (
    <span key={key} className={tagClass}>
      <span className="mr-1 truncate">{tagValue}</span>
      {removable && (
        <RemoveButton
          aria-label={`Remove ${tagValue}`}
          onClick={(event) => {
            event.stopPropagation();
            onChange(value.filter((v) => v !== tagValue));
          }}
          size="sm"
        />
      )}
    </span>
  );

  const hiddenCount = value.length - visibleCount;
  const clearable = nullable && value.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          id={id}
          role="combobox"
          tabIndex={0}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-labelledby={id && `${id}-label`}
          aria-invalid={invalid}
          onKeyDown={onTriggerKeyDown}
          onBlur={onBlur}
          className="form-control-clip-large group relative flex h-[38px] w-full cursor-pointer items-center bg-sand px-2.5 py-px text-lg leading-[28.2857px] text-black/88 outline-none aria-invalid:bg-error-bg"
        >
          <div ref={containerRef} className="relative flex min-w-0 flex-auto overflow-hidden">
            {value.slice(0, visibleCount).map((tagValue, index) => renderTag(tagValue, true, index))}
            {hiddenCount > 0 && renderTag(`+ ${hiddenCount} ...`, false, "rest")}
            <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex w-max">
              {value.map((tagValue, index) => renderTag(tagValue, true, index))}
              {renderTag(`+ ${value.length} ...`, false, "rest")}
            </div>
          </div>

          {value.length === 0 && (
            <span className="pointer-events-none absolute top-1/2 right-[21px] left-[18px] -translate-y-1/2 truncate px-2.5 text-black/25">
              {placeholder}
            </span>
          )}

          <span className={cn("pointer-events-none absolute top-1/2 right-[11px] -mt-1.5 flex size-3 items-center justify-center text-black/25", clearable && "group-hover:hidden")}>
            <ChevronDown className="size-6 shrink-0" />
          </span>
          {clearable && (
            <RemoveButton
              aria-label="Clear selection"
              className="absolute top-1/2 right-[12px] hidden -translate-y-1/2 group-hover:flex"
              onClick={(event) => {
                event.stopPropagation();
                onChange([]);
              }}
              size="lg"
            />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          listRef.current?.focus();
        }}
        className="form-control-clip-large w-(--radix-popover-trigger-width) rounded-none border-0 bg-popover px-1 pt-[22px] pb-1.5 font-pixel text-sm leading-[22px] text-popover-foreground"
      >
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-multiselectable
          tabIndex={0}
          aria-activedescendant={selectItems.length ? `${listId}-${activeIndex}` : undefined}
          onKeyDown={onListKeyDown}
          className="max-h-64 overflow-y-auto outline-none"
        >
          {selectItems.map((item, index) => {
            const selected = value.includes(item.value);
            return (
              <div
                key={item.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggleValue(item.value)}
                className={cn(
                  "option-clip relative flex h-8 cursor-pointer items-center px-[18px] py-[5px]",
                  index === activeIndex && "bg-sand",
                  selected && "bg-ink font-semibold text-white"
                )}
              >
                <span className="flex-auto truncate">{item.value}</span>
                {selected && <Check className="size-6" />}
                {item.key > LAST_DEFAULT_KEY && (
                  <Button
                    size="sm"
                    className={cn(
                      "form-control-clip-small absolute right-3 bottom-1.5 h-5 bg-[darkred] text-xs",
                      selected && "bg-white text-[darkred] enabled:hover:text-[red]"
                    )}
                    onClick={(event) => removeSelectItem(event, item)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="my-2 h-px bg-[rgba(5,5,5,0.06)]" />

        <div className="inline-flex items-center gap-2 px-2 pb-1">
          <Input
            ref={newSelectItemInputRef}
            className="form-control-clip"
            placeholder="Enter new item"
            maxLength={50}
            value={newSelectItem}
            onChange={(event) => setNewSelectItem(event.target.value.toLocaleUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSelectItem();
              }
            }}
          />
          <Button className="form-control-clip w-[140px]" onClick={addSelectItem} disabled={!newSelectItem}>
            Add item
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AppendableSelectDropdown;
