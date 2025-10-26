// helloWorldScene.tsx
import React, { useEffect, useMemo } from 'react';
import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  PanelBuilders,
  SceneQueryRunner,
} from '@grafana/scenes';



function getScene() {
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
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          width: '50%',
          height: 300,
          body: logsPanel.build(),
        }),
      ],
    }),
  });

  // Attach query runner to scene for easy access outside
  (scene as any).logsQueryRunner = logsQueryRunner;

  return scene;
}

const HelloWorldPluginPage = () => {
  const scene = useMemo(() => getScene(), []);

  useEffect(() => {
    const logsQueryRunner = (scene as any).logsQueryRunner as SceneQueryRunner;
  
    const sub = logsQueryRunner.subscribeToState((state) => {
      const data = state?.data;
      if (!data || !data.series) return;
  
      const allLogs = data.series.flatMap((series) => {
        // Find fields by name
        const timeField = series.fields.find((f) => f.name === 'Time');
        const lineField = series.fields.find((f) => f.name === 'Line');
        const labelsField = series.fields.find((f) => f.name === 'labels');
  
        if (!timeField || !lineField) {
          console.warn('⚠️ Missing expected Time or Line fields in series:', series);
          return [];
        }
  
        const times = timeField.values.toArray();
        const messages = lineField.values.toArray();
        const labels = labelsField?.values?.toArray?.() ?? [];
  
        const logs = times.map((t, i) => ({
          timestamp: new Date(t).toISOString(),
          message: messages[i],
          labels: labels[i] ?? {},
        }));
        console.log('✅ Final structured Loki logs:', messages);
        return logs;
      });
  
      //console.log('✅ Final structured Loki logs:', allLogs);
    });
  
    return () => sub.unsubscribe();
  }, [scene]);
  
  
  

  return <scene.Component model={scene} />;
};

export default HelloWorldPluginPage;
