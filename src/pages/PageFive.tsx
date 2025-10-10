
import { PluginPage } from '@grafana/runtime';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import React, { useState } from 'react';

function PageFive() {
    const [activeTab, setActiveTab] = useState('tab1');

    return (
        <PluginPage>
            <TabsBar>
                <Tab
                    label="Page One"
                    active={activeTab === 'tab1'}
                    onChangeTab={() => setActiveTab('tab1')}
                />
                <Tab
                    label="Page Two"
                    active={activeTab === 'tab2'}
                    onChangeTab={() => setActiveTab('tab2')}
                />
            </TabsBar>
            <TabContent>
                <div>
                    {activeTab === 'tab1' && <p>tab 1</p>}
                    {activeTab === 'tab2' && <p>tab 2</p>}
                </div>
            </TabContent>
        </PluginPage>
    );
}

export default PageFive;
