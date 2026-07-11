import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./ui/app"
import {
  MessageProvider,
  PluginGate,
  PluginThemeProvider,
  RoleProvider,
} from "./ui/providers"
import "./infra/firebase"
import { cleanLibrary } from "./room/library"
import { setSkew } from "./infra/time"

// clean the library before starting the app
cleanLibrary()

setSkew(() =>
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <PluginGate>
        <PluginThemeProvider>
          <MessageProvider>
            <RoleProvider>
              <App />
            </RoleProvider>
          </MessageProvider>
        </PluginThemeProvider>
      </PluginGate>
    </React.StrictMode>,
  ),
)
