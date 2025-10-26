import React, { useState, useRef, useEffect } from 'react';
import { PluginPage, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { Button, Input, Combobox, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

const pluginId = 'cloudorg-difychatflow-app'; // from plugin.json


function PageTwo() {
  const s = useStyles2(getStyles);
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Welcome! Ask me anything.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<any>(null);
  // State for current conversation id
  const [currentConversationId, setCurrentConversationId] = useState<string>("");
  // State for message history (overrides messages when a conversation is selected)
  const [historyMessages, setHistoryMessages] = useState<any[] | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  // Fetch conversations and data sources on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Fetch conversations
    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const url = `/api/plugins/${pluginId}/resources/difyGetConversations`;
        const res = await getBackendSrv().fetch({
          url,
          method: 'GET',
        }).toPromise();
        const data = res && typeof res === 'object' && 'data' in res ? (res as any).data : undefined;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
          setConversations((data as any).data);
        } else {
          setConversations([]);
        }
      } catch (e) {
        setConversations([]);
      } finally {
        setLoadingConversations(false);
      }
    };
    fetchConversations();

    // Fetch data sources
    const info = getDataSourceSrv().getList();
    setDataSources(info);
    if (info.length > 0) {
      setSelectedDataSource(info[0]);
    }
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

  // Fetch message history for a conversation
  const fetchMessageHistory = async (conversationId: string) => {
    setIsLoading(true);
    setStreamedResponse("");
    try {
      const url = `/api/plugins/${pluginId}/resources/difyMessageHistoryProxy?conversation_id=${conversationId}`;
      const observable = getBackendSrv().fetch({
        url,
        method: 'GET',
      });
      const res = await (await import('rxjs')).lastValueFrom(observable);
      if (!res || !res.data || !Array.isArray((res as any).data.data)) {
        setHistoryMessages([]);
        setIsLoading(false);
        return;
      }
      // Transform API response to chat message format
      const chatMsgs = (res as any).data.data.flatMap((msg: any) => [
        { role: 'user', content: msg.query },
        { role: 'system', content: msg.answer }
      ]);
      setHistoryMessages(chatMsgs);
    } catch (err) {
      setHistoryMessages([{ role: 'system', content: 'Failed to load message history.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (userInput: string, conversationId: string) => {
    setIsLoading(true);
    setStreamedResponse('');
    // If history is showing, start a new message list from history
    setMessages(prev => {
      if (historyMessages && historyMessages.length > 0) {
        return [...historyMessages, { role: 'user', content: userInput }];
      }
      return [...prev, { role: 'user', content: userInput }];
    });
    setHistoryMessages(null); // Switch to live messages after sending
    const url = `/api/plugins/${pluginId}/resources/difyChatProxy`;
    try {
      // Use getBackendSrv().fetch() to make the request (returns Observable<FetchResponse>)
      const observable = getBackendSrv().fetch({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        data: { query: userInput, conversation_id: conversationId},
        responseType: 'text', // fallback to text, since 'stream' is not supported
      });
      // Use lastValueFrom to get the FetchResponse
      const res = await (await import('rxjs')).lastValueFrom(observable);
      if (!res || typeof res.data !== 'string') {
        setStreamedResponse('No response body');
        setIsLoading(false);
        return;
      }
      // Simulate streaming by parsing the full text as a single chunk
      let resultText = '';
      let buffer = res.data;
      parseEventStreamChunk(buffer, (answer) => {
        resultText += answer;
        setStreamedResponse(resultText);
      });
      setMessages(prev => [...prev, { role: 'assistant', content: resultText }]);
    } catch (err) {
      let errorMsg = 'Unknown error';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'object' && err !== null) {
        try {
          errorMsg = JSON.stringify(err);
        } catch {
          errorMsg = String(err);
        }
      } else {
        errorMsg = String(err);
      }
      setStreamedResponse('Error: ' + errorMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) {
      return;
    }
    await sendMessage(input.trim(), currentConversationId);
    setInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, historyMessages, streamedResponse]);

  return (
    <PluginPage>
      <div className={s.page} style={{ height: '80vh' }}>
        <div className={s.sidebar}>
          <h3 style={{ color: 'var(--text-color, #f5f6fa)', fontWeight: 600, fontSize: 18, marginBottom: 16 }}>Conversations</h3>
          <div style={{
            border: '1px solid var(--panel-border-color, #23262e)',
            borderRadius: 8,
            background: 'var(--panel-bg, #1a1c23)',
            overflowY: 'auto',
            padding: 0,
            height: "100%"
          }}>
            {loadingConversations ? (
              <div style={{ color: '#888', padding: 16 }}>Loading...</div>
            ) : conversations.length === 0 ? (
              <div style={{ color: '#888', padding: 16 }}>No conversations</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {conversations.map((conv) => (
                  <li
                    key={conv.id}
                    style={{
                      borderBottom: '1px solid var(--panel-border-color, #23262e)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      color: currentConversationId === conv.id ? '#fff' : 'var(--text-color, #f5f6fa)',
                      fontWeight: currentConversationId === conv.id ? 700 : 500,
                      fontSize: 15,
                      background: currentConversationId === conv.id ? 'var(--blue-3, #204080)' : undefined,
                      transition: 'background 0.2s',
                    }}
                    onClick={() => {
                      setCurrentConversationId(conv.id);
                      fetchMessageHistory(conv.id);
                    }}
                  >
                    {conv.name || conv.id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={s.content}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ width: 320 }}>
                <Combobox
                  options={dataSources.map(ds => ({ label: ds.name, value: ds.uid }))}
                  value={selectedDataSource ? { label: selectedDataSource.name, value: selectedDataSource.uid } : undefined}
                  onChange={option => {
                    const found = dataSources.find(ds => ds.uid === option?.value);
                    setSelectedDataSource(found || null);
                  }}
                  placeholder="Select data source..."
                />
              </div>
              <div style={{ flex: 1 }} />
            </div>
        </div>
        <div
          className={s.sidebar}
          style={{
            minWidth: 400
          }}
        >
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
              boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            <div ref={messageListRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {(historyMessages || messages).map((msg, idx) => (
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

  </div>
  </PluginPage>
  );
}

export default PageTwo;

const getStyles = (theme: GrafanaTheme2) => ({
  page: css`
    display: flex;
    gap: ${theme.spacing(4)};
    min-height: 400px;
    align-items: stretch;
    height: 100%;
  `,
  sidebar: css`
    width: 220px;
    min-width: 200px;
    background: ${theme.colors.background.primary};
    border-radius: 4px;
    padding: ${theme.spacing(1)};
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  content: css`
    flex: 1;
    background: transparent;
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  link: css`
    color: ${theme.colors.text.link};
    text-decoration: underline;
  `,
});
