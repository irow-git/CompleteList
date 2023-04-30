import {
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Space,
  Typography,
} from "antd";
import { Content } from "antd/es/layout/layout";
import * as Icons from "@ant-design/icons";
import { useState } from "react";

const AddGame: React.FC = () => {
  const onFinish = (values: any) => {
    console.log(form.getFieldsError());
    console.log("Received values of form:", values);
  };

  const [form] = Form.useForm();
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
  const [key, setKey] = useState<number>(0);

  const addField = (add: () => void) => {
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

        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex],
          array[currentIndex],
        ];
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

    const colorsVerticalArrRight = [
      colorArrHorizontal[0],
      colorArrHorizontal[2],
    ];
    const colorsVerticalArrLeft = [
      colorArrHorizontal[1],
      colorArrHorizontal[3],
    ];

    setBorderColorObj((prevState) => {
      prevState.push({
        key,
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

    setKey((prevState) => {
      return (prevState += 1);
    });

    add();
  };

  const removeField = (
    remove: (name: number) => void,
    name: number,
    key: number
  ) => {
    remove(name);

    setBorderColorObj((prevState) => {
      const indexToRemove = prevState.findIndex((item) => item.key === key);
      prevState.splice(indexToRemove, 1);
      return prevState;
    });
  };

  return (
    <Content style={{ padding: "20px", textAlign: "start" }}>
      <Form
        form={form}
        layout="vertical"
        name="dynamic_form_nest_item"
        onFinish={onFinish}
        autoComplete="off"
      >
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
              <Input
                className="form-control-clip"
                size="large"
                placeholder="Enter Title"
              />
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
              <Input
                className="form-control-clip"
                size="large"
                placeholder="Enter Completion"
              />
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
                className="form-control-clip"
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
                className="form-control-clip"
                style={{ width: "100%" }}
                size="large"
                placeholder="Enter Date of Last Completion"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Row>
              <Col span={24} style={{ marginBottom: "-24px" }}>
                <Form.Item name="original_copy" valuePropName="checked">
                  <Checkbox>Original Copy</Checkbox>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="free_to_play" valuePropName="checked">
                  <Checkbox>Free to Play</Checkbox>
                </Form.Item>
              </Col>
            </Row>
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
                                  <Input
                                    className="form-control-clip"
                                    size="large"
                                    placeholder="Title"
                                  />
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
                                  <Input
                                    className="form-control-clip"
                                    size="large"
                                    placeholder="Completion"
                                  />
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
                                    className="form-control-clip"
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
                                    className="form-control-clip"
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
                      style={{ marginTop: 20, marginLeft: 10, cursor: "pointer" }}
                      onClick={() => removeField(remove, name, key)}
                      width={40}
                      src="images/close.png"
                      alt="close"
                    ></img>
                  </Space>
                );
              })}
              <Form.Item style={{ marginTop: 12 }}>
                <Button
                  className="form-control-clip"
                  size="large"
                  style={{ width: 200, fontFamily: "inherit" }}
                  onClick={() => addField(add)}
                  icon={<Icons.PlusOutlined />}
                >
                  Add field
                </Button>
              </Form.Item>
            </Space>
          )}
        </Form.List>

        <Form.Item style={{ marginTop: -20 }}>
          <Button
            className="form-control-clip"
            size="large"
            style={{ width: 200, fontFamily: "inherit" }}
            htmlType="submit"
          >
            Submit
          </Button>
        </Form.Item>
      </Form>
    </Content>
  );
};

export default AddGame;
