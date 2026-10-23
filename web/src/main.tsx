import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'katex/dist/katex.min.css';
import App from './App';
import { themeToken } from './theme';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: themeToken }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
