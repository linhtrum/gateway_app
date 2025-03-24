"use strict";

import { h, render, html, useState, Router, useEffect } from "./bundle.js";
import { Sidebar, Header } from "./components/Components.js";
import Login from "./components/pages/Login.js";
import Home from "./components/pages/Home.js";
import Network from "./components/pages/Network.js";
import Devices from "./components/pages/Devices.js";
import System from "./components/pages/System.js";
import Logs from "./components/pages/Logs.js";

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
    <div class="flex h-screen">
      <${Sidebar} currentRoute=${url} />
      <div class="flex-1 flex flex-col">
        <${Header} user=${user} onLogout=${logout} />
        <main class="flex-1 ml-64 pt-16 p-5 bg-gray-50">
          <${Router} onChange=${(ev) =>
    setUrl(ev.url)} history=${History.createHashHistory()}>
            <${Home} default=${true} />
            <${Network} path="/network" />
            <${Devices} path="/devices" />
            <${System} path="/system" />
            <${Logs} path="/logs" />
          </${Router}>
        </main>
      </div>
    </div>
  `;
}

window.onload = () => render(h(App), document.body);
