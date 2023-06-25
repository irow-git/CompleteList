import { Button, Divider, Input, InputRef, Select, Space } from "antd";
import { useRef, useState } from "react";

const AppendableSelectDropdown: React.FC<{
  localStorageKey: string;
  selectItems: Array<{ key: number; value: string }>;
  setSelectItems: React.Dispatch<React.SetStateAction<Array<{ key: number; value: string }>>>;
  placeholder?: string;
  multiple?: boolean;
  nullable?: boolean;
}> = ({ localStorageKey, selectItems, setSelectItems, placeholder, multiple = false, nullable = false }) => {

  const [newSelectItem, setNewSelectItem] = useState("");
  const newSelectItemInputRef = useRef<InputRef>(null);

  const { Option } = Select;

  const selectNewItemOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewSelectItem(event.target.value.toLocaleUpperCase());
  };

  const addSelectItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    setSelectItems((prevState) => {
      return [
        ...prevState,
        {
          key: prevState[prevState.length - 1].key + 1,
          value: newSelectItem,
        },
      ];
    });
    setNewSelectItem("");
    setTimeout(() => {
      newSelectItemInputRef.current?.focus();
    }, 0);

    const storageArr = selectItems;
    storageArr.push({
      key: storageArr[storageArr.length - 1].key + 1,
      value: newSelectItem,
    });

    localStorage.setItem(localStorageKey, JSON.stringify(storageArr));
  };

  const removeSelectItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, key: number) => {
    setSelectItems((prevState) => {
      const indexToRemove = prevState.findIndex((item) => item.key === key);
      prevState.splice(indexToRemove, 1);
      localStorage.setItem(localStorageKey, JSON.stringify(prevState));
      return [...prevState];
    });

    setTimeout(() => {
      newSelectItemInputRef.current?.focus();
    }, 0);

    e.stopPropagation();
  };

  const selectOptions = selectItems.map((item) => (
    <Option key={item.key} value={item.value} label={item.value}>
      {item.key > 2 && (
        <Button
          className="form-control-clip-small"
          size="small"
          style={{
            fontFamily: "inherit",
            backgroundColor: "darkRed",
            position: "absolute",
            right: 12,
            bottom: 6,
            height: 20,
            fontSize: 12,
          }}
          onClick={(e) => removeSelectItem(e, item.key)}
        >
          Remove
        </Button>
      )}
      {item.value}
    </Option>
  ));

  const DropdownMenu: React.FC<{ menu: React.ReactElement<any, string | React.JSXElementConstructor<any>>; ref: any }> = ({ menu, ref }) => {
    return (
      <>
        {menu}
        <Divider style={{ margin: "8px 0" }} />
        <Space
          style={{
            padding: "0 8px 4px",
          }}
        >
          <Input
            className="form-control-clip"
            style={{ paddingInline: 18 }}
            placeholder="Enter new item"
            maxLength={50}
            ref={ref}
            value={newSelectItem}
            onChange={selectNewItemOnChange}
          />
          <Button className="form-control-clip" style={{ fontFamily: "inherit", width: 140 }} onClick={addSelectItem} disabled={!newSelectItem}>
            Add item
          </Button>
        </Space>
      </>
    );
  };

  return multiple ? (
    <Select
      className="form-control-clip-large"
      size="large"
      placeholder={placeholder}
      optionLabelProp="label"
      mode="multiple"
      allowClear={nullable}
      dropdownRender={(menu) => <DropdownMenu menu={menu} ref={newSelectItemInputRef} />}
    >
      {selectOptions}
    </Select>
  ) : (
    <Select
      className="form-control-clip-large"
      size="large"
      placeholder={placeholder}
      optionLabelProp="label"
      allowClear={nullable}
      dropdownRender={(menu) => <DropdownMenu menu={menu} ref={newSelectItemInputRef} />}
    >
      {selectOptions}
    </Select>
  );
};

export default AppendableSelectDropdown;
