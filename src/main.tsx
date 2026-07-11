import React from "react"
import ReactDOM from "react-dom/client"
import { App } from "./ui/app/App"
import { MessageProvider } from "./ui/providers/MessageProvider"
import { PluginGate } from "./ui/providers/PluginGate"
import { PluginThemeProvider } from "./ui/providers/PluginThemeProvider"
import { RoleProvider } from "./ui/providers/RoleProvider"
import "./firebase"
import { cleanLibrary } from "./library"
import { setSkew } from "./time"

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
