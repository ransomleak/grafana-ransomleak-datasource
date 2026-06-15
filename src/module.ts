import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { RansomLeakQuery, RansomLeakDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, RansomLeakQuery, RansomLeakDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
