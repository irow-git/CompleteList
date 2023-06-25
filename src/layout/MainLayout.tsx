import { List, Space } from "antd";
import { Layout, theme } from "antd";
import { Link } from "react-router-dom";

const { Header, Content, Sider } = Layout;

type MainProps = {
  children?: React.ReactNode;
};

const Main: React.FC<MainProps> = ({ children }) => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh", backgroundColor: "#dedbd3" }}>
      <Sider
        style={{
          background: "linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(114,108,120,0.9948354341736695) 100%)",
          color: "white",
          height: 920,
          marginLeft: 24,
        }}
        trigger={null}
        width={240}
        collapsible
      >
        <List>
          <Space style={{ marginBottom: 50, marginTop: 40 }}>
            <img style={{ filter: "drop-shadow(2px 2px 12px white)" }} src="images/logo.png" alt="logo" width={208} draggable={false} />
          </Space>

          <div
            style={{
              display: "block",
              textAlign: "left",
              lineHeight: "40px",
              paddingLeft: 5,
            }}
          >
            <div
              style={{
                color: "white",
              }}
            >
              <div className="nav-item">
                <Link to="create" style={{}}>
                  Add Game
                </Link>
              </div>
            </div>
            <img
              src="images/line-7.png"
              alt="line"
              width={105}
              draggable={false}
              style={{
                marginLeft: -3,
                marginBottom: 5,
                marginTop: 20,
              }}
            />
            <div
              style={{
                color: "white",
              }}
            >
              <div className="nav-item">
                <Link to="/" style={{}}>
                  Table View
                </Link>
              </div>
              <div className="nav-item">
                <Link to="card" style={{}}>
                  Card View
                </Link>
              </div>
              <div className="nav-item">
                <Link to="letter" style={{}}>
                  By Letter View
                </Link>
              </div>
            </div>
            <img src="images/line-7.png" alt="line" width={105} draggable={false} style={{ marginLeft: -3, marginTop: 20 }} />
          </div>
        </List>

        <img src="images/tear.png" alt="tear" draggable={false} style={{ position: "relative", marginTop: 82 }} />
      </Sider>
      <Layout style={{ backgroundColor: "#dedbd3" }}>
        <Header
          style={{
            padding: 0,
            background: "transparent",
            color: "transparent",
            textShadow: "0px 4px 4px #dedbd3, 0 0 0 black, 0px 4px 4px #dedbd3",
            fontSize: "2.5em",
            marginBottom: -16,
          }}
        >
          Complete List - Video Games
        </Header>
        <Content style={{ marginTop: 16, marginInline: 32, filter: "drop-shadow(1px 2px 3px black)" }}>
          <div
            className="clip"
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Main;
