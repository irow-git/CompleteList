import { Button, Form, Space, Typography } from "antd";
import { Content } from "antd/es/layout/layout";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { IGame } from "../interfaces";
import { GameForm } from "../components/GameForm";
import { DynamicColorBorder } from "../components/DynamicColorBorder";

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
    <Content style={{ padding: 20, textAlign: "start" }}>
      <Form form={form} layout="vertical" name="dynamic_form_nest_item" onFinish={onFinish} autoComplete="off">
        <GameForm form={form} />

        <Form.List name="DLCs">
          {(fields, { add, remove }) => (
            <Space direction="vertical">
              <Space style={{ marginLeft: 10, marginBottom: -12 }}>
                <Typography.Title level={4}>DLC List</Typography.Title>
              </Space>
              {fields.map(({ key, name }) => {
                const styling = borderColorObj[name];
                return (
                  <Space key={key} className="DLC-outer">
                    <DynamicColorBorder styling={styling}>
                      <div style={{padding: 10, display: 'flex'}}>
                        <GameForm form={form} innerForm={{ name }} />
                        <div style={{position: 'relative', width: 0, height: 0, top: -10, right: 72}}>
                          <Button
                            className="form-control-clip-small"
                            size="small"
                            style={{
                              fontFamily: "inherit",
                              backgroundColor: borderColorObj[name].colorsHorizontal[3],
                              position: 'absolute'
                            }}
                            onClick={() => removeDLCField(remove, name, key)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </DynamicColorBorder>
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
