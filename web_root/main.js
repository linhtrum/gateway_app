"use strict";

import { h, render, html, useState, Router, useEffect } from "./bundle.js";
import { Sidebar, Header } from "./components/Components.js";
import Login from "./components/pages/Login.js";
import Home from "./components/pages/Home.js";
import Network from "./components/pages/Network.js";
import Serial from "./components/pages/Serial.js";
import Serial2 from "./components/pages/Serial2.js";
import MQTT from "./components/pages/MQTT.js";
import Devices from "./components/pages/Devices.js";
import System from "./components/pages/System.js";
import Logs from "./components/pages/Logs.js";
import IOFunction from "./components/pages/IOFunction.js";
import Status from "./components/pages/Status.js";
import Management from "./components/pages/Management.js";
import { LanguageProvider } from "./components/LanguageContext.js";

function App() {
  const [user, setUser] = useState(null);
  const [url, setUrl] = useState("/");

  const logout = () => fetch("/api/logout").then((r) => setUser(null));
  const login = (r) =>
    !r.ok ? setUser(null) : r.json().then((data) => setUser(data.user));

  useEffect(() => fetch("/api/login").then(login), []);

  if (!user) {
    return html` <${Login} onLogin=${login} /> `;
  }

  // If user is logged in, show main application
  return html`
    <${LanguageProvider}>
      <div class="flex h-screen">
        <${Sidebar} currentRoute=${url} />
        <div class="flex-1 flex flex-col">
          <${Header} user=${user} onLogout=${logout} />
          <main class="flex-1 ml-64 pt-16 p-5 bg-gray-50">
            <${Router} onChange=${(ev) =>
    setUrl(ev.url)} history=${History.createHashHistory()}>
              <${Home} default=${true} />
              <${Status} path="/status" />
              <${Network} path="/network" />
              <${Serial} path="/serial1" />
              <${Serial2} path="/serial2" />
              <${MQTT} path="/mqtt" />
              <${Devices} path="/devices" />
              <${System} path="/system" />
              <${Management} path="/management" />
              <${Logs} path="/logs" />
              <${IOFunction} path="/io-function" />
            </${Router}>
          </main>
        </div>
      </div>
    </${LanguageProvider}>
  `;
}

window.onload = () => render(h(App), document.body);
