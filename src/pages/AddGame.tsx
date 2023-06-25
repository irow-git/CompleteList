import { Button, Checkbox, Col, DatePicker, Form, Input, Row, Space, Typography } from "antd";
import { Content } from "antd/es/layout/layout";
import { PlusOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import AppendableSelectDropdown from "../components/AppendableSelectDropdown";
import { IGame } from "../interfaces";

const AddGame: React.FC = () => {
  const onFinish = (values: any) => {
    console.log(form.getFieldsError());
    console.log("Received values of form:", values);
  };

  const [form] = Form.useForm<IGame>();
  const [borderColorObj, setBorderColorObj] = useState<
    Array<{
      key: number;
      value: {
        firstColorPercent: Array<number>;
        secondColorPercent: Array<number>;
        thirdColorPercent: Array<number>;
        horizontalColorPercent: Array<number>;
      };
      colorsHorizontal: Array<string>;
      colorsVertical: { right: Array<string>; left: Array<string> };
    }>
  >([]);
  const [borderDLCKey, setBorderDLCKey] = useState<number>(0);

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

  const addDLCField = (add: () => void) => {
    const getRandomInt = (min: number, max: number) => {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min) + min);
    };

    const shuffleArr = (array: Array<string>) => {
      let currentIndex = array.length,
        randomIndex;

      while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
      }

      return array;
    };

    let firstColorPercent: number[] = [];
    let secondColorPercent: number[] = [];
    let thirdColorPercent: number[] = [];
    let horizontalColorPercent: number[] = [];

    const colorArrHorizontal = ["#47434d", "#1f1f29", "#555559", "#7e768a"];

    firstColorPercent[0] = getRandomInt(10, 40);
    secondColorPercent[0] = getRandomInt(firstColorPercent[0], 60);
    thirdColorPercent[0] = getRandomInt(secondColorPercent[0], 80);

    firstColorPercent[1] = getRandomInt(10, 40);
    secondColorPercent[1] = getRandomInt(firstColorPercent[1], 60);
    thirdColorPercent[1] = getRandomInt(secondColorPercent[1], 80);

    horizontalColorPercent[0] = getRandomInt(40, 60);
    horizontalColorPercent[1] = getRandomInt(40, 60);

    shuffleArr(colorArrHorizontal);

    const colorsVerticalArrRight = [colorArrHorizontal[0], colorArrHorizontal[2]];
    const colorsVerticalArrLeft = [colorArrHorizontal[1], colorArrHorizontal[3]];

    setBorderColorObj((prevState) => {
      prevState.push({
        key: borderDLCKey,
        value: {
          firstColorPercent,
          secondColorPercent,
          thirdColorPercent,
          horizontalColorPercent,
        },
        colorsHorizontal: colorArrHorizontal,
        colorsVertical: {
          right: colorsVerticalArrRight,
          left: colorsVerticalArrLeft,
        },
      });
      return prevState;
    });

    setBorderDLCKey((prevState) => {
      return (prevState += 1);
    });

    add();
  };

  const removeDLCField = (remove: (name: number) => void, name: number, key: number) => {
    remove(name);

    setBorderColorObj((prevState) => {
      const indexToRemove = prevState.findIndex((item) => item.key === key);
      prevState.splice(indexToRemove, 1);
      return prevState;
    });
  };

  return (
    <Content style={{ padding: "20px", textAlign: "start" }}>
      <Form form={form} layout="vertical" name="dynamic_form_nest_item" onFinish={onFinish} autoComplete="off">
        <Row gutter={[24, 12]}>
          <Col xl={12} sm={24}>
            <Form.Item
              name="title"
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
              name="completion"
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
              name="release_date"
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
              name="last_completion"
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
            <Form.Item
              name="platform"
              label="Platform"
              rules={[
                {
                  required: true,
                  message: "Platform required",
                },
              ]}
            >
              <AppendableSelectDropdown
                localStorageKey="platform-items"
                selectItems={platformItems}
                setSelectItems={setPlatformItems}
                placeholder="Choose a Platform"
              />
            </Form.Item>
          </Col>
          <Col xl={12} sm={24} style={{ marginBottom: "-24px" }}>
            <Form.Item name="tags" label="Tags">
              <AppendableSelectDropdown
                localStorageKey="tag-items"
                selectItems={tagItems}
                setSelectItems={setTagItems}
                placeholder="Select Tags"
                multiple={true}
                nullable={true}
              />
            </Form.Item>
          </Col>
          <Col xl={12} sm={24}>
            <Row>
              <Col span={24} style={{ marginBottom: "-24px" }}>
                <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Original Copy</Typography.Text>
                <Form.Item name="original_copy" valuePropName="checked">
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={24} style={{ marginBottom: "-24px" }}>
                <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Free to Play</Typography.Text>
                <Form.Item name="free_to_play" valuePropName="checked">
                  <Checkbox />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Typography.Text style={{ position: "absolute", transform: "translate(25px, 5px)" }}>Service</Typography.Text>
                <Form.Item name="service" valuePropName="checked">
                  <Checkbox
                    onClick={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.checked) {
                        form.setFieldValue("original_copy", true);
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Col>
          <Col xl={12} sm={24}>
            <Form.Item label="Comment" name="comment">
              <Input.TextArea rows={3} maxLength={300} style={{ resize: "none" }} className="form-control-clip-large" />
            </Form.Item>
          </Col>
        </Row>

        <Form.List name="DLCs">
          {(fields, { add, remove }) => (
            <Space direction="vertical">
              <Space style={{ marginLeft: 10, marginBottom: -12 }}>
                <Typography.Title level={4}>DLC List</Typography.Title>
              </Space>
              {fields.map(({ key, name, ...restField }) => {
                const styling = borderColorObj[name];
                return (
                  <Space key={key} className="DLC-outer">
                    <Space
                      className="DLC-top-border"
                      align="center"
                      style={{
                        marginTop: 12,
                        borderImage: `linear-gradient(to right,
                        ${styling.colorsHorizontal[0]} ${styling.value.firstColorPercent[0]}%,
                        ${styling.colorsHorizontal[1]} ${styling.value.firstColorPercent[0]}%, 
                        ${styling.colorsHorizontal[1]} ${styling.value.secondColorPercent[0]}%, 
                        ${styling.colorsHorizontal[2]} ${styling.value.secondColorPercent[0]}%,
                        ${styling.colorsHorizontal[2]} ${styling.value.thirdColorPercent[0]}%,
                        ${styling.colorsHorizontal[3]} ${styling.value.thirdColorPercent[0]}%, 
                        ${styling.colorsHorizontal[3]} 100%) 2 stretch repeat`,
                      }}
                    >
                      <Space
                        className="DLC-right-border"
                        style={{
                          borderImage: `linear-gradient(180deg, 
                        ${styling.colorsVertical.right[0]} ${styling.value.horizontalColorPercent[0]}%,
                        ${styling.colorsVertical.right[1]} ${styling.value.horizontalColorPercent[0]}%,
                        ${styling.colorsVertical.right[1]} 100%) 2 stretch repeat`,
                        }}
                      >
                        <Space
                          className="DLC-left-border"
                          style={{
                            borderImage: `linear-gradient(0deg,
                            ${styling.colorsVertical.left[0]} ${styling.value.horizontalColorPercent[1]}%,
                            ${styling.colorsVertical.left[1]} ${styling.value.horizontalColorPercent[1]}%,
                            ${styling.colorsVertical.left[1]} 100%) 2 stretch repeat`,
                          }}
                        >
                          <Space
                            className="DLC-bottom-border DLC-inner"
                            style={{
                              borderImage: `linear-gradient(to left, 
                              ${styling.colorsHorizontal[0]} ${styling.value.firstColorPercent[1]}%,
                              ${styling.colorsHorizontal[1]} ${styling.value.firstColorPercent[1]}%, 
                              ${styling.colorsHorizontal[1]} ${styling.value.secondColorPercent[1]}%, 
                              ${styling.colorsHorizontal[2]} ${styling.value.secondColorPercent[1]}%, 
                              ${styling.colorsHorizontal[2]} ${styling.value.thirdColorPercent[1]}%, 
                              ${styling.colorsHorizontal[3]} ${styling.value.thirdColorPercent[1]}%, 
                              ${styling.colorsHorizontal[3]} 100%) 2 stretch repeat`,
                            }}
                          >
                            <Row gutter={[12, 0]}>
                              <Col xl={12} sm={24}>
                                <Form.Item
                                  {...restField}
                                  name={[name, "title"]}
                                  rules={[
                                    {
                                      required: true,
                                      message: "Title required",
                                    },
                                  ]}
                                >
                                  <Input className="form-control-clip-large" maxLength={200} size="large" placeholder="Title" />
                                </Form.Item>
                              </Col>

                              <Col xl={12} sm={24}>
                                <Form.Item
                                  {...restField}
                                  name={[name, "completion"]}
                                  rules={[
                                    {
                                      required: true,
                                      message: "Completion required",
                                    },
                                  ]}
                                >
                                  <Input className="form-control-clip-large" maxLength={200} size="large" placeholder="Completion" />
                                </Form.Item>
                              </Col>

                              <Col xl={12} sm={24}>
                                <Form.Item
                                  name={[name, "release_date"]}
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
                                    style={{
                                      width: "100%",
                                      fontFamily: "joystix-monospace",
                                    }}
                                    size="large"
                                    placeholder="Release Date"
                                  />
                                </Form.Item>
                              </Col>

                              <Col xl={12} sm={24}>
                                <Form.Item
                                  name={[name, "last_completion"]}
                                  rules={[
                                    {
                                      required: true,
                                      message: "Llast completion required",
                                    },
                                  ]}
                                >
                                  <DatePicker
                                    suffixIcon={false}
                                    className="form-control-clip-large"
                                    style={{ width: "100%" }}
                                    size="large"
                                    placeholder="Date of Last Completion"
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                          </Space>
                        </Space>
                      </Space>
                    </Space>
                    <img
                      style={{
                        marginTop: 20,
                        marginLeft: 10,
                        cursor: "pointer",
                      }}
                      onClick={() => removeDLCField(remove, name, key)}
                      width={40}
                      src="images/close.png"
                      alt="close"
                    ></img>
                  </Space>
                );
              })}
              <Form.Item style={{ marginTop: 12 }}>
                <Button
                  className="form-control-clip-large"
                  size="large"
                  style={{ width: 200, fontFamily: "inherit" }}
                  onClick={() => addDLCField(add)}
                  icon={<PlusOutlined />}
                >
                  Add field
                </Button>
              </Form.Item>
            </Space>
          )}
        </Form.List>

        <Form.Item style={{ marginTop: -20 }}>
          <Button className="form-control-clip-large" size="large" style={{ width: 200, fontFamily: "inherit" }} htmlType="submit">
            Submit
          </Button>
        </Form.Item>
      </Form>
    </Content>
  );
};

export default AddGame;
