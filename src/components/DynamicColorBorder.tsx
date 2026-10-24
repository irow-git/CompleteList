export type BorderStyling = {
  value: {
    firstColorPercent: Array<number>;
    secondColorPercent: Array<number>;
    thirdColorPercent: Array<number>;
    horizontalColorPercent: Array<number>;
  };
  colorsHorizontal: Array<string>;
  colorsVertical: { right: Array<string>; left: Array<string> };
};

export const createBorderStyling = (): BorderStyling => {
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

  return {
    value: {
      firstColorPercent,
      secondColorPercent,
      thirdColorPercent,
      horizontalColorPercent,
    },
    colorsHorizontal: colorArrHorizontal,
    colorsVertical: {
      right: [colorArrHorizontal[0], colorArrHorizontal[2]],
      left: [colorArrHorizontal[1], colorArrHorizontal[3]],
    },
  };
};

export const DynamicColorBorder: React.FC<{
  styling: BorderStyling;
  children: React.ReactElement;
}> = ({ children, styling }) => {
  return (
    <div
      className="DLC-top-border"
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
      <div
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
        <div
          className="DLC-right-border"
          style={{
            borderImage: `linear-gradient(180deg, 
            ${styling.colorsVertical.right[0]} ${styling.value.horizontalColorPercent[0]}%,
            ${styling.colorsVertical.right[1]} ${styling.value.horizontalColorPercent[0]}%,
            ${styling.colorsVertical.right[1]} 100%) 2 stretch repeat`,
          }}
        >
          <div
            className="DLC-left-border"
            style={{
              borderImage: `linear-gradient(0deg,
              ${styling.colorsVertical.left[0]} ${styling.value.horizontalColorPercent[1]}%,
              ${styling.colorsVertical.left[1]} ${styling.value.horizontalColorPercent[1]}%,
              ${styling.colorsVertical.left[1]} 100%) 2 stretch repeat`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
