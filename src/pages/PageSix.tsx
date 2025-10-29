// helloWorldScene.tsx
import React, { useEffect, useMemo } from 'react';
import {
  EmbeddedScene,
  SceneGridLayout,
  SceneGridItem,
  PanelBuilders,
  SceneQueryRunner,
  SceneTimeRange,
  DataSourceVariable,
  QueryVariable,
  TextBoxVariable,
  SceneVariableSet,
  SceneTimePicker,
  VariableValueSelectors,
  SceneControlsSpacer,
} from '@grafana/scenes';
import {
  atom,
  useRecoilState,
  useSetRecoilState
} from 'recoil';

// Define a Recoil atom for logs
export const logMessageState = atom({
  key: 'logMessageState',
  default: [] as {
    timestamp: string;
    message: string;
    labels: Record<string, any>;
  }[],
});

function getScene() {
  const timeRange = new SceneTimeRange({
    from: 'now-1h',
    to: 'now',
  });

  const dsHandler = new DataSourceVariable({
    label: 'Data source',
    name: 'ds',
    pluginId: 'loki'
  });

  const streamHandler = new QueryVariable({
    label: 'Source stream',
    name: 'stream_name',
    datasource: {
      type: 'loki',
      uid: '$ds'
    },
    query: 'label_names()',
  });

  const streamValueHandler = new TextBoxVariable({
    label: 'Stream value',
    name: 'stream_value',
  });


  // Create Loki query runner
  const logsQueryRunner = new SceneQueryRunner({
    datasource: {
      type: 'loki',
      uid: 'P8E80F9AEF21F6940', // Replace with your actual Loki data source UID
    },
    queries: [
      {
        refId: 'A',
        expr: '{job="varlogs"} |= ``',
        maxLines: 20,
      },
    ],
  });

  const logsPanel = PanelBuilders.logs()
    .setTitle('Logs')
    .setData(logsQueryRunner);

  const scene = new EmbeddedScene({
    $timeRange: timeRange,
    $variables: new SceneVariableSet({
      variables: [dsHandler, streamHandler, streamValueHandler],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          x: 0,
          y: 0,
          width: 24,
          height: 16,
          body: logsPanel.build(),
        }),
      ],
    }),
    controls: [
			new VariableValueSelectors({}),
			new SceneControlsSpacer(),
			new SceneTimePicker({ isOnCanvas: true }),
		],
  });

  // Attach query runner to scene for easy access outside
  //(scene as any).logsQueryRunner = logsQueryRunner;

  return scene;
}

const HelloWorldPluginPage = () => {
  const scene = useMemo(() => getScene(), []);
  const setLogs = useSetRecoilState(logMessageState);

  // useEffect(() => {
  //   const logsQueryRunner = (scene as any).logsQueryRunner as SceneQueryRunner;
  
  //   const sub = logsQueryRunner.subscribeToState((state) => {
  //     const data = state?.data;
  //     if (!data || !data.series) return;
  
  //     const allLogs = data.series.flatMap((series) => {
  //       // Find fields by name
  //       const timeField = series.fields.find((f) => f.name === 'Time');
  //       const lineField = series.fields.find((f) => f.name === 'Line');
  //       const labelsField = series.fields.find((f) => f.name === 'labels');
  
  //       if (!timeField || !lineField) {
  //         console.warn('⚠️ Missing expected Time or Line fields in series:', series);
  //         return [];
  //       }
  
  //       const times = timeField.values.toArray();
  //       const messages = lineField.values.toArray();
  //       const labels = labelsField?.values?.toArray?.() ?? [];
  
  //       const logs = times.map((t, i) => ({
  //         timestamp: new Date(t).toISOString(),
  //         message: messages[i],
  //         labels: labels[i] ?? {},
  //       }));
  //       console.log('✅ Final structured Loki logs:', messages);
  //       return logs;
  //     });
  //     setLogs(allLogs);
  //     //console.log('✅ Final structured Loki logs:', allLogs);
  //   });
  
  //   return () => sub.unsubscribe();
  // }, [scene, setLogs]);
  
  
  

  return <scene.Component model={scene} />;
};

export default HelloWorldPluginPage;
