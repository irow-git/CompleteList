import React from "react";
import { useSelector } from "react-redux";
import { IGame } from "../interfaces";
import { State } from "../store/reducers/rootReducer";
import { Badge, Dropdown, Space, Table, TableColumnsType } from 'antd';
import Button from "@mui/material/Button";

const Home: React.FC = () => {

  const gamesStore: IGame[] = useSelector(
    (state: State) => state.gameReducer.games
  );

  const items = [
    { key: '1', label: 'Action 1' },
    { key: '2', label: 'Action 2' },
  ];

  const expandedRowRender = () => {
    const columns: TableColumnsType<any> = [
      { title: 'Date', dataIndex: 'date', key: 'date' },
      { title: 'Name', dataIndex: 'name', key: 'name' },
      {
        title: 'Status',
        key: 'state',
        render: () => <Badge status="success" text="Finished" />,
      },
      { title: 'Upgrade Status', dataIndex: 'upgradeNum', key: 'upgradeNum' },
      {
        title: 'Action',
        dataIndex: 'operation',
        key: 'operation',
        render: () => (
          <Space size="middle">
            <a>Pause</a>
            <a>Stop</a>
            <Dropdown menu={{ items }}>
              <a>
                More 
              </a>
            </Dropdown>
          </Space>
        ),
      },
    ];

    const data = [];
    for (let i = 0; i < 3; ++i) {
      data.push({
        key: i.toString(),
        date: '2014-12-24 23:12:00',
        name: 'This is production name',
        upgradeNum: 'Upgraded: 56',
      });
    }
    return <Table columns={columns} dataSource={data} pagination={false} />;
  };

  const dataColumns = [
    {
      dataIndex: "platform",
      title: "Platform",
    },
    {
      dataIndex: "original_copy",
      title: "Original Copy",
    },
    {
      dataIndex: "free",
      title: "Free to play",
    },
    {
      dataIndex: "title",
      title: "Title",
    },
    {
      dataIndex: "completion",
      title: "Completion Type",
    },
  ];

  const dummyRows = [
    {
      key: 1,
      platform: 'PC',
      original_copy: true,
      free: false,
      title: "Doom Eternal",
      completion: "Campaign",
    }

  ]

  console.log("GAMES: ", gamesStore);

  return (
    <div>
      <Table
        columns={dataColumns}
        pagination={{ pageSize: 25 }}
        scroll={{ y: '71vh' }}
        expandable={{ expandedRowRender }}
        dataSource={dummyRows}
      />
    </div>
  );
};

export default Home;
