import { Space } from "antd";

export const DynamicColorBorder: React.FC<{
  styling: any;
  children: React.ReactElement;
}> = ({ children, styling }) => {
  return (
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
            className="DLC-bottom-border"
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
            {children}
          </Space>
        </Space>
      </Space>
    </Space>
  );
};
