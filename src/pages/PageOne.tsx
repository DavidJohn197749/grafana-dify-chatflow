import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { prefixRoute } from '../utils/utils.routing';
import { ROUTES } from '../constants';
import pluginJson from '../plugin.json';
import { testIds } from '../components/testIds';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

interface MyCustomEndpointResponse {
  message: string;
}

async function getMyCustomEndpoint(): Promise<string> {
  const observableResponse = await getBackendSrv()
    .fetch<MyCustomEndpointResponse>({
      url: `/api/plugins/${pluginJson.id}/resources/ping`,
    });
  const response = await lastValueFrom(observableResponse);
  return response.data.message;
}

function PageOne() {
  const s = useStyles2(getStyles);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    getMyCustomEndpoint()
      .then((msg) => {
        if (isMounted) {
          setMessage(msg);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMessage('');
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PluginPage>
      <div data-testid={testIds.pageOne.container}>
        This is page one 2. {message}
        <div className={s.marginTop}>
          <LinkButton data-testid={testIds.pageOne.navigateToFour} href={prefixRoute(ROUTES.Four)}>
            Full-width page example
          </LinkButton>
        </div>
      </div>
    </PluginPage>
  );
}

export default PageOne;

const getStyles = (theme: GrafanaTheme2) => ({
  marginTop: css`
    margin-top: ${theme.spacing(2)};
  `,
});
