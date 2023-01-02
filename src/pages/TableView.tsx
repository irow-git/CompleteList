import React from "react";
import { useSelector } from "react-redux";
import { IGame } from "../interfaces";
import { State } from "../store/reducers/rootReducer";
import { Badge, Dropdown, Space, Table, TableColumnsType } from 'antd';
import Button from "@mui/material/Button";

const TableView: React.FC = () => {

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
      width: 100
    },
    {
      dataIndex: "original_copy",
      title: "Original Copy",
      width: 115
    },
    {
      dataIndex: "free",
      title: "Free to play",
      width: 115
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


  console.log("GAMES: ", gamesStore);

  return (
    <div>
      <Table
        columns={dataColumns}
        pagination={{ pageSize: 11 }}
        expandable={{ expandedRowRender }}
        dataSource={gamesStore}
      />
    </div>
  );
};

export default TableView;
