import { Checkbox, Col, DatePicker, Form, FormInstance, Input, Row, Typography } from "antd";
import AppendableSelectDropdown from "./AppendableSelectDropdown";
import { IGame } from "../interfaces";
import { useEffect, useState } from "react";

export const GameForm: React.FC<{ form: FormInstance<IGame>, innerForm?: { name: number } }> = ({ form, innerForm = null }) => {

  const [platformItems, setPlatformItems] = useState<Array<{ key: number; value: string }>>([
    { key: 1, value: "PC" },
    { key: 2, value: "Mobile" },
  ]);

  const [tagItems, setTagItems] = useState<Array<{ key: number; value: string }>>([
    { key: 1, value: "Tough to beat" },
    { key: 2, value: "Hardest Difficulty" },
  ]);

  useEffect(() => {
    const localStoragePlatformItems = localStorage.getItem("platform-items");
    const localStorageTagItems = localStorage.getItem("tag-items");

    localStoragePlatformItems && setPlatformItems(JSON.parse(localStoragePlatformItems));
    localStorageTagItems && setTagItems(JSON.parse(localStorageTagItems));
  }, []);

  return (
    <Row gutter={[24, 12]}>
      <Col xl={12} sm={24}>
        <Form.Item
          name={innerForm ? [innerForm.name, "title"] : "title"}
          label="Title"
          rules={[
            {
              required: true,
              message: "Title required",
            },
          ]}
        >
          <Input className="form-control-clip-large" maxLength={200} size="large" placeholder="Enter Title" />
        </Form.Item>
      </Col>
      <Col xl={12} sm={24}>
        <Form.Item
          name={innerForm ? [innerForm.name, "completion"] : "completion"}
          label="Completion"
          rules={[
            {
              required: true,
              message: "Completion required",
            },
          ]}
        >
          <Input className="form-control-clip-large" maxLength={200} size="large" placeholder="Enter Completion" />
        </Form.Item>
      </Col>
      <Col xl={12} sm={24}>
        <Form.Item
          name={innerForm ? [innerForm.name, "release_date"] : "release_date"}
          label="Release Date"
          rules={[
            {
              required: true,
              message: "Realise date required",
            },
          ]}
        >
          <DatePicker
            suffixIcon={false}
            className="form-control-clip-large"
            style={{ width: "100%", fontFamily: "joystix-monospace" }}
            size="large"
            placeholder="Enter Release Date"
          />
        </Form.Item>
      </Col>
      <Col xl={12} sm={24}>
        <Form.Item
          name={innerForm ? [innerForm.name, "last_completion"] : "last_completion"}
          label="Date of Last Completion"
          rules={[
            {
              required: true,
              message: "Date of last completion required",
            },
          ]}
        >
          <DatePicker
            suffixIcon={false}
            className="form-control-clip-large"
            style={{ width: "100%" }}
            size="large"
            placeholder="Enter Date of Last Completion"
          />
        </Form.Item>
      </Col>
      <Col xl={12} sm={24}>
          <AppendableSelectDropdown
            form={form}
            formItemProps={{
              name: innerForm ? [innerForm.name, "platform"] : "platform",
              label: "Platform",
              valuePropName: "value",
              rules: [{required: true, message: "Platform required"}]
            }}
            localStorageKey="platform-items"
            selectItems={platformItems}
            setSelectItems={setPlatformItems}
            placeholder="Choose a Platform"
            
          />
      </Col>
      <Col xl={12} sm={24} style={{ marginBottom: "-24px" }}>
        <AppendableSelectDropdown
            form={form}
            formItemProps={{
              name: innerForm ? [innerForm.name, "tags"] : "tags",
              label: "Tags"
            }}
            localStorageKey="tag-items"
            selectItems={tagItems}
            setSelectItems={setTagItems}
            placeholder="Select Tags"
            multiple={true}
            nullable={true}
          />
      </Col>
      <Col xl={12} sm={24}>
        <Row>
          <Col span={24} style={{ marginBottom: "-24px" }}>
            <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Original Copy</Typography.Text>
            <Form.Item name={innerForm ? [innerForm.name, "original_copy"] : "original_copy"} valuePropName="checked">
              <Checkbox />
            </Form.Item>
          </Col>
          <Col span={24} style={{ marginBottom: "-24px" }}>
            <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Free to Play</Typography.Text>
            <Form.Item name={innerForm ? [innerForm.name, "free_to_play"] : "free_to_play"} valuePropName="checked">
              <Checkbox />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Service</Typography.Text>
            <Form.Item name={innerForm ? [innerForm.name, "service"] : "service"} valuePropName="checked">
              <Checkbox
                onClick={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.checked) {
                    if(innerForm) {
                      form.setFieldValue([innerForm.name, "orginal_copy"], true)
                      return;
                    }
                    form.setFieldValue("original_copy", true);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Col>
      <Col xl={12} sm={24}>
        <Form.Item name={innerForm ? [innerForm.name, "comment"] : "comment"} label="Comment">
          <Input.TextArea rows={3} maxLength={300} style={{ resize: "none" }} className="form-control-clip-large" />
        </Form.Item>
      </Col>
    </Row>
  );
};
