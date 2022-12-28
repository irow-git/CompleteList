import React, { useState } from "react";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DesktopOutlined,
  FileOutlined,
  PieChartOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { List, Menu, MenuProps, Space } from "antd";
import { Layout, theme } from "antd";
import { Box, ListItem } from "@mui/material";

const { Header, Content, Footer, Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem;
}

type MainProps = {
  children?: React.ReactNode;
};

const Main: React.FC<MainProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        style={{
          background:
            "linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(114,108,120,0.9948354341736695) 100%)",
          color: "white",
          minHeight: "100vh",
        }}
        trigger={null}
        width="250px"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        {React.createElement(
          collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
          {
            style: {
              fontSize: "2em",
              marginLeft: `${!collapsed ? "200px" : "30px"}`,
              marginTop: "10px",
            },
            className: "trigger",
            onClick: () => setCollapsed(!collapsed),
          }
        )}
        <List>
          <Space style={{ marginBottom: "75px", marginTop: "75px" }}>
            <img src={`${!collapsed? "/logo-2.png": "/logo.png"}`} width={!collapsed ? "208px" : "50px"} />
          </Space>
          <Box>
            <img
              src={`${!collapsed ? "/line-7.png" : "line-4.png"}`}
              width={`${!collapsed ? "105px" : "60px"}`}
              style={{ float: "left", marginLeft: "2px", marginBottom: "20px" }}
            />
            <Box style={{ color: "white", fontFamily: "joystix-monospace" }}>
              <ListItem>Table View</ListItem>
              <ListItem>Card View</ListItem>
              <ListItem>Letter View</ListItem>
            </Box>
            <img
              src={`${!collapsed ? "/line-7.png" : "line-4.png"}`}
              width={`${!collapsed ? "105px" : "60px"}`}
              style={{ float: "left", marginLeft: "2px", marginTop: "20px" }}
            />
          </Box>
        </List>
      </Sider>
      <Layout className="site-layout">
        <Header
          style={{ padding: 0, background: colorBgContainer, fontSize: "2em" }}
        >
          Complete List - Video Games
        </Header>
        <Content style={{ margin: "16px" }}>
          <Box
            style={{
              borderRadius: "24px",
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
            }}
          >
            {children}
          </Box>
        </Content>
        <Footer style={{ textAlign: "center" }}>©2023 Created by II</Footer>
      </Layout>
    </Layout>
  );
};

export default Main;
