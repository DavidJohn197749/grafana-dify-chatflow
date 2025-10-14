import React, { useState, useRef, useEffect } from 'react';
import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';
import { Button, Input } from '@grafana/ui';

const pluginId = 'cloudorg-difychatflow-app'; // from plugin.json



function PageTwo() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Welcome! Ask me anything.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const url = `/api/plugins/${pluginId}/resources/difyGetConversations`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch conversations');
        const data = await res.json();
        setConversations(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        setConversations([]);
      } finally {
        setLoadingConversations(false);
      }
    };
    fetchConversations();
  }, []);

  // Parse text/event-stream chunks and stream only the 'answer' field from 'message' events
  const parseEventStreamChunk = (chunk: string, onAnswer: (answer: string) => void) => {
    // Split by double newlines (\n\n)
    const events = chunk.split(/\n\n+/);
    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const jsonStr = trimmed.replace(/^data:/, '').trim();
      try {
        const obj = JSON.parse(jsonStr);
        if (obj.event === 'message' && typeof obj.answer === 'string') {
          onAnswer(obj.answer);
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  };

  const sendMessage = async (userInput: string) => {
    setIsLoading(true);
    setStreamedResponse('');
    setMessages(prev => [...prev, { role: 'user', content: userInput }]);
    const url = `/api/plugins/${pluginId}/resources/difyChatProxy`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ query: userInput }),
      });
      if (!response.body) {
        setStreamedResponse('No response body');
        setIsLoading(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let resultText = '';
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        // Try to parse complete events in buffer
        parseEventStreamChunk(buffer, (answer) => {
          resultText += answer;
          setStreamedResponse(resultText);
        });
        // Remove processed events from buffer (keep only last incomplete event if any)
        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline !== -1) {
          buffer = buffer.slice(lastDoubleNewline + 2);
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: resultText }]);
    } catch (err) {
      setStreamedResponse('Error: ' + (err instanceof Error ? err.message : String(err)));
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (err instanceof Error ? err.message : String(err)) }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) {
      return;
    }
    await sendMessage(input.trim());
    setInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <PluginPage>
      <div
        data-testid={testIds.pageTwo.container}
        style={{
          display: 'flex',
          flexDirection: 'row',
          maxWidth: 1000,
          margin: '0 auto',
          padding: '32px 0',
          gap: 32,
        }}
      >
        {/* Conversation List */}
        <div style={{ width: 260, minWidth: 200 }}>
          <h3 style={{ color: 'var(--text-color, #f5f6fa)', fontWeight: 600, fontSize: 18, marginBottom: 16 }}>Conversations</h3>
          <div style={{
            border: '1px solid var(--panel-border-color, #23262e)',
            borderRadius: 8,
            background: 'var(--panel-bg, #1a1c23)',
            minHeight: 320,
            maxHeight: 420,
            overflowY: 'auto',
            padding: 0,
          }}>
            {loadingConversations ? (
              <div style={{ color: '#888', padding: 16 }}>Loading...</div>
            ) : conversations.length === 0 ? (
              <div style={{ color: '#888', padding: 16 }}>No conversations</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {conversations.map((conv) => (
                  <li key={conv.id} style={{
                    borderBottom: '1px solid var(--panel-border-color, #23262e)',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    color: 'var(--text-color, #f5f6fa)',
                    fontWeight: 500,
                    fontSize: 15,
                  }}
                  >
                    {conv.name || conv.id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Chat Area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            color: 'var(--text-color, #f5f6fa)',
            fontWeight: 600,
            fontSize: 24,
            marginBottom: 24,
            textAlign: 'center',
          }}>Chat with LLM</h2>
          <div
            style={{
              border: '1px solid var(--panel-border-color, #23262e)',
              borderRadius: 8,
              padding: 20,
              minHeight: 320,
              background: 'var(--panel-bg, #1a1c23)',
              marginBottom: 20,
              overflowY: 'auto',
              maxHeight: 420,
              boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)',
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    background:
                      msg.role === 'user'
                        ? 'var(--input-bg, #23262e)'
                        : 'var(--panel-bg, #23262e)',
                    color: 'var(--text-color, #f5f6fa)',
                    border: msg.role === 'system' ? 'none' : '1px solid var(--panel-border-color, #343741)',
                    borderRadius: 6,
                    padding: '10px 16px',
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    fontSize: 15,
                    opacity: msg.role === 'system' ? 0.85 : 1,
                    fontStyle: msg.role === 'system' ? 'italic' : 'normal',
                    boxShadow: msg.role === 'user' ? '0 1px 2px 0 rgba(0,0,0,0.10)' : undefined,
                  }}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: 'var(--panel-bg, #23262e)',
                    color: 'var(--text-color, #f5f6fa)',
                    border: '1px solid var(--panel-border-color, #343741)',
                    borderRadius: 6,
                    padding: '10px 16px',
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    fontSize: 15,
                  }}
                >
                  {streamedResponse || '...'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.currentTarget.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type your message..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'var(--input-bg, #23262e)',
                color: 'var(--text-color, #f5f6fa)',
                border: '1px solid var(--panel-border-color, #343741)',
                fontSize: 15,
              }}
              autoFocus
            />
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{ minWidth: 80 }}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </PluginPage>
  );
}

export default PageTwo;
