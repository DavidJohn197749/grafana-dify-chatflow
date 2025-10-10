import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { useStyles2, VerticalTab } from '@grafana/ui';
import React, { useState } from 'react';


interface TabItem {
    key: string;
    label: string;
}


const tabItems: TabItem[] = [
    { key: 'tab1', label: 'Tab 1' },
    { key: 'tab2', label: 'Tab 2' },
];

// 將每個 tab 的內容抽成獨立元件
function TabOneContent() {
    return (
        <>
            <h3>Tab 1 標題</h3>
            <p>這是 Tab 1 的內容。你可以在這裡放任何 React 元件。</p>
        </>
    );
}

function TabTwoContent() {
    return (
        <>
            <h3>Tab 2 標題</h3>
            <p>這是 Tab 2 的內容。你可以在這裡放表格、表單或其他複雜內容。</p>
        </>
    );
}

// 用物件 map 管理 tab 內容，方便擴充
const tabContentMap: Record<string, React.ReactNode> = {
    tab1: <TabOneContent />,
    tab2: <TabTwoContent />,
};

function TabSidebar({ tabs, active, onChange }: {
    tabs: TabItem[];
    active: string;
    onChange: (key: string) => void;
}) {
    const s = useStyles2((theme: GrafanaTheme2) => ({
        sidebar: css`
            min-width: 160px;
            border-right: 1px solid ${theme.colors.border.weak};
            padding-right: ${theme.spacing(2)};
        `,
    }));
    return (
        <div className={s.sidebar}>
            {tabs.map(tab => (
                <VerticalTab
                    key={tab.key}
                    label={tab.label}
                    active={active === tab.key}
                    onChangeTab={() => onChange(tab.key)}
                />
            ))}
        </div>
    );
}

function PageFive() {
    const s = useStyles2((theme: GrafanaTheme2) => ({
        root: css`
            display: flex;
            margin-top: ${theme.spacing(2)};
        `,
        content: css`
            flex: 1;
            padding-left: ${theme.spacing(2)};
        `,
    }));
    const [activeTab, setActiveTab] = useState('tab1');

    return (
        <PluginPage>
            <div className={s.root}>
                <TabSidebar tabs={tabItems} active={activeTab} onChange={setActiveTab} />
                <div className={s.content}>
                    {tabContentMap[activeTab] ?? <p>找不到內容</p>}
                </div>
            </div>
        </PluginPage>
    );
}

export default PageFive;
