import React, { useState, useRef } from 'react';
import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';
import { Button } from '@grafana/ui';

const pluginId = 'cloudorg-difychatflow-app'; // from plugin.json



function PageTwo() {
  const [streamText, setStreamText] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleButtonClick = async () => {
    setStreamText('');
    // Close previous EventSource if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Prepare the fetch for SSE with POST and payload
    const url = `/api/plugins/${pluginId}/resources/difyChatProxy`;
    // Use fetch to get the stream, since EventSource does not support POST
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ query: "what's k8s" }),
      });
      if (!response.body) {
        setStreamText('No response body');
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let resultText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        resultText += chunk;
        setStreamText(resultText);
      }
    } catch (err) {
      setStreamText('Error: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <PluginPage>
      <div data-testid={testIds.pageTwo.container}>
        <p>This is page two.</p>

        <Button variant="primary" onClick={handleButtonClick}>Primary Button</Button>
        <p style={{whiteSpace: 'pre-wrap', marginTop: 16}}>{streamText}</p>
      </div>
    </PluginPage>
  );
}

export default PageTwo;
