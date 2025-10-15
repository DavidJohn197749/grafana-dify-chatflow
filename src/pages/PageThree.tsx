import React from 'react';
import { css } from '@emotion/css';
import { useParams, Link } from 'react-router-dom';
import { GrafanaTheme2 } from '@grafana/data';
import {  useStyles2 } from '@grafana/ui';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';
import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';

function PageThree() {
  const s = useStyles2(getStyles);
  const { id } = useParams<{ id: string }>();

  return (
    <PluginPage>
      <div className={s.page}>
        <div className={s.sidebar}>
          <p>123</p>
        </div>
        <div className={s.content} data-testid={testIds.pageThree.container}>
          <h2>Page Three</h2>
          <div>
            This is page three.
            <br />
            <br />
            {id && (
              <>
                <strong>ID:</strong> {id}
              </>
            )}
            {!id && (
              <>
                <strong>No id parameter is set in the URL.</strong> <br />
                Try the following link: <br />
                <Link className={s.link} to={prefixRoute(`${ROUTES.Three}/123456789`)}>
                  {prefixRoute(`${ROUTES.Three}/123456789`)}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </PluginPage>
  );
}

export default PageThree;

const getStyles = (theme: GrafanaTheme2) => ({
  page: css`
    display: flex;
    gap: ${theme.spacing(4)};
    padding: ${theme.spacing(3)};
    background-color: ${theme.colors.background.secondary};
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
