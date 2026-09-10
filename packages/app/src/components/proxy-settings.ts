import { createMemo } from "solid-js"
import type { Config } from "@opencode-ai/sdk/v2/client"
import { useLanguage } from "@/context/language"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServerProtocol } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { useProviders } from "@/hooks/use-providers"
import { showToast } from "@/utils/toast"
import { proxyModeValue, type ProxyMode } from "./proxy-settings-behavior"

export function createProxySettingsController() {
  const language = useLanguage()
  const platform = usePlatform()
  const serverSync = useServerSync()
  const protocol = useServerProtocol()
  const providers = useProviders(() => undefined)
  const models = useModels()

  // Proxy lives in the v1 global config file; other server flavors cannot edit it.
  const supported = createMemo(() => protocol() === "v1")
  const desktop = createMemo(() => platform.platform === "desktop")
  const globalProxy = createMemo(() => serverSync().data.config.proxy ?? "")
  const providerProxy = (id: string) => serverSync().data.config.provider?.[id]?.options?.proxy
  const modelProxy = (providerID: string, modelID: string) =>
    serverSync().data.config.provider?.[providerID]?.models?.[modelID]?.options?.proxy

  const reportError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    showToast({ title: language.t("common.requestFailed"), description: message })
  }

  const save = (patch: Config, done?: () => void) => {
    void serverSync()
      .updateConfig(patch)
      .then(() => done?.())
      .catch(reportError)
  }

  const saveGlobal = (url: string) => {
    return serverSync()
      .updateConfig({ proxy: url })
      .then(() => {
        showToast({
          variant: "success",
          icon: "circle-check",
          title: language.t("settings.proxy.global.saved"),
          ...(desktop()
            ? {
                actions: [
                  {
                    label: language.t("settings.proxy.global.restart"),
                    onClick: () => void platform.restart(),
                  },
                ],
              }
            : {}),
        })
      })
      .catch(reportError)
  }

  const saveProvider = (id: string, mode: ProxyMode) => {
    save({ provider: { [id]: { options: { proxy: proxyModeValue(mode) } } } })
  }

  const saveModel = (providerID: string, modelID: string, mode: ProxyMode) => {
    save({ provider: { [providerID]: { models: { [modelID]: { options: { proxy: proxyModeValue(mode) } } } } } })
  }

  return {
    supported,
    desktop,
    globalProxy,
    providerProxy,
    modelProxy,
    providers,
    models,
    saveGlobal,
    saveProvider,
    saveModel,
  }
}

export type ProxySettingsController = ReturnType<typeof createProxySettingsController>
