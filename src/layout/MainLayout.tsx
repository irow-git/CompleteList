import { List, Space } from "antd";
import { Layout, theme } from "antd";
import { Box, ListItem } from "@mui/material";
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
          background:
            "linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(114,108,120,0.9948354341736695) 100%)",
          color: "white",
          height: "920px",
          marginLeft: "16px",
        }}
        trigger={null}
        width="240px"
        collapsible
      >
        <List>
          <Space style={{ marginBottom: "50px", marginTop: "50px" }}>
            <img src="/logo.png" alt="logo" width="208px" draggable={false} />
          </Space>
          <Box>
            <Box
              style={{
                color: "white",
                fontFamily: "joystix-monospace",

              }}
            >
              <ListItem className="navItem"><Link to="create" style={{}}>Add Game</Link></ListItem>
              <ListItem className="navItem"><Link to="create_many" style={{}}>Add Many Games</Link></ListItem>
            </Box>
            <img
              src="/line-7.png"
              alt="line"
              width="105px"
              draggable={false}
              style={{
                float: "left",
                marginLeft: "2px",
                marginBottom: "20px",
                marginTop: "20px",
              }}
            />
            <Box
              style={{
                color: "white",
                fontFamily: "joystix-monospace",
              }}
            >
              <ListItem className="navItem"><Link to="/" style={{}}>Table View</Link></ListItem>
              <ListItem className="navItem"><Link to="card" style={{}}>Card View</Link></ListItem>
              <ListItem className="navItem"><Link to="letter" style={{}}>By Letter View</Link></ListItem>
            </Box>
            <img
              src="/line-7.png"
              alt="line"
              width="105px"
              draggable={false}
              style={{ float: "left", marginLeft: "2px", marginTop: "20px" }}
            />
          </Box>
        </List>
        <img
          src="/tear.png"
          alt="tear"
          draggable={false}
          style={{ position: "relative", marginTop: "40px" }}
        />
      </Sider>
      <Layout className="site-layout" style={{ backgroundColor: "#dedbd3" }}>
        <Header
          style={{
            padding: 0,
            background: "transparent",
            fontSize: "2em",
            marginBottom: "-16px",
          }}
        >
          Complete List - Video Games
        </Header>
        <Content style={{ margin: "16px" }}>
          <Box
            className="clip"
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
            }}
          >
            {children}
          </Box>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Main;
