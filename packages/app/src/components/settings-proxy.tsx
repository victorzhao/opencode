import { useFilteredList } from "@opencode-ai/ui/hooks"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { Button } from "@opencode-ai/ui/button"
import { Select } from "@opencode-ai/ui/select"
import { Switch } from "@opencode-ai/ui/switch"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { TextField } from "@opencode-ai/ui/text-field"
import { createMemo, createSignal, For, Show, type Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { popularProviders } from "@/hooks/use-providers"
import { SettingsList } from "./settings-list"
import { SettingsServerPicker, SettingsServerScope } from "./settings-server-picker"
import { createProxySettingsController } from "./proxy-settings"
import { isValidProxyUrl, proxyModeOf, type ProxyMode } from "./proxy-settings-behavior"

type ModelItem = ReturnType<ReturnType<typeof createProxySettingsController>["models"]["list"]>[number]
type ModeOption = { id: ProxyMode; label: string }

export const SettingsProxy: Component = () => {
  return (
    <SettingsServerScope>
      <SettingsProxyContent />
    </SettingsServerScope>
  )
}

const SettingsProxyContent: Component = () => {
  const language = useLanguage()
  const controller = createProxySettingsController()

  const modeOptions = createMemo<ModeOption[]>(() => [
    { id: "follow", label: language.t("settings.proxy.mode.follow") },
    { id: "direct", label: language.t("settings.proxy.mode.direct") },
  ])

  const [draft, setDraft] = createSignal<string | undefined>(undefined)
  const current = createMemo(() => controller.globalProxy())
  const value = createMemo(() => draft() ?? current())
  const trimmed = createMemo(() => value().trim())
  const valid = createMemo(() => trimmed() === "" || isValidProxyUrl(trimmed()))
  const dirty = createMemo(() => draft() !== undefined && trimmed() !== current().trim())

  const save = () => {
    if (!valid() || !dirty()) return
    void controller.saveGlobal(trimmed()).then(() => setDraft(undefined))
  }

  const clear = () => {
    setDraft(undefined)
    if (current() === "") return
    void controller.saveGlobal("")
  }

  const connected = createMemo(() => controller.providers.connected())

  const list = useFilteredList<ModelItem>({
    items: (_filter) => controller.models.list(),
    key: (x) => `${x.provider.id}:${x.id}`,
    filterKeys: ["provider.name", "name", "id"],
    sortBy: (a, b) => a.name.localeCompare(b.name),
    groupBy: (x) => x.provider.id,
    sortGroupsBy: (a, b) => {
      const aIndex = popularProviders.indexOf(a.category)
      const bIndex = popularProviders.indexOf(b.category)
      const aPopular = aIndex >= 0
      const bPopular = bIndex >= 0

      if (aPopular && !bPopular) return -1
      if (!aPopular && bPopular) return 1
      if (aPopular && bPopular) return aIndex - bIndex

      const aName = a.items[0].provider.name
      const bName = b.items[0].provider.name
      return aName.localeCompare(bName)
    },
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex items-center justify-between gap-4 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">{language.t("settings.proxy.title")}</h2>
          <SettingsServerPicker />
        </div>
      </div>

      <Show when={controller.supported()} fallback={<div class="py-4 text-14-regular text-text-weak max-w-[720px]">{language.t("settings.proxy.unavailable")}</div>}>
        <div class="flex flex-col gap-8 max-w-[720px]">
          <div class="flex flex-col gap-1" data-component="proxy-global-section">
            <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.proxy.section.global")}</h3>
            <SettingsList>
              <div class="flex flex-col gap-3 py-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-14-medium text-text-strong">{language.t("settings.proxy.global.title")}</span>
                  <span class="text-12-regular text-text-weak">{language.t("settings.proxy.global.description")}</span>
                  <Show when={controller.desktop()}>
                    <span class="text-12-regular text-text-weak">{language.t("settings.proxy.global.restartHint")}</span>
                  </Show>
                </div>
                <div class="flex w-full sm:w-[320px]">
                  <TextField
                    data-action="settings-proxy-url"
                    label={language.t("settings.proxy.global.title")}
                    hideLabel
                    type="text"
                    value={value()}
                    onChange={setDraft}
                    placeholder={language.t("settings.proxy.global.placeholder")}
                    error={!valid() ? language.t("settings.proxy.global.invalid") : undefined}
                    spellcheck={false}
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    class="text-12-regular"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <Button size="small" variant="secondary" disabled={!valid() || !dirty()} onClick={save}>
                    {language.t("settings.proxy.global.save")}
                  </Button>
                  <Button size="small" variant="ghost" disabled={current() === "" && !dirty()} onClick={clear}>
                    {language.t("settings.proxy.global.clear")}
                  </Button>
                </div>
              </div>
            </SettingsList>
          </div>

          <div class="flex flex-col gap-1" data-component="proxy-providers-section">
            <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.proxy.section.providers")}</h3>
            <SettingsList>
              <Show
                when={connected().length > 0}
                fallback={
                  <div class="py-4 text-14-regular text-text-weak">
                    {language.t("settings.proxy.providers.empty")}
                  </div>
                }
              >
                <For each={connected()}>
                  {(item) => {
                    const mode = createMemo(() => proxyModeOf(controller.providerProxy(item.id)))
                    return (
                      <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                        <div class="flex items-center gap-3 min-w-0">
                          <ProviderIcon id={item.id} class="size-5 shrink-0 icon-strong-base" />
                          <span class="text-14-medium text-text-strong truncate">{item.name}</span>
                        </div>
                        <div class="flex-shrink-0">
                          <Select
                            data-action="settings-proxy-provider"
                            options={modeOptions()}
                            current={modeOptions().find((o) => o.id === mode())}
                            value={(o) => o.id}
                            label={(o) => o.label}
                            onSelect={(option) => {
                              if (!option || option.id === mode()) return
                              controller.saveProvider(item.id, option.id)
                            }}
                            variant="secondary"
                            size="small"
                            triggerVariant="settings"
                          />
                        </div>
                      </div>
                    )
                  }}
                </For>
              </Show>
            </SettingsList>
            <span class="text-12-regular text-text-weak pt-1">{language.t("settings.proxy.providers.description")}</span>
          </div>

          <div class="flex flex-col gap-1" data-component="proxy-models-section">
            <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.proxy.section.models")}</h3>
            <div class="flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-base max-w-[720px]">
              <Icon name="magnifying-glass" class="text-icon-weak-base flex-shrink-0" />
              <TextField
                variant="ghost"
                type="text"
                value={list.filter()}
                onChange={list.onInput}
                placeholder={language.t("dialog.model.search.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                class="flex-1"
              />
              <Show when={list.filter()}>
                <IconButton icon="circle-x" variant="ghost" onClick={list.clear} />
              </Show>
            </div>
            <Show
              when={!list.grouped.loading}
              fallback={
                <div class="flex flex-col items-center justify-center py-12 text-center">
                  <span class="text-14-regular text-text-weak">
                    {language.t("common.loading")}
                    {language.t("common.loading.ellipsis")}
                  </span>
                </div>
              }
            >
              <Show
                when={list.flat().length > 0}
                fallback={
                  <div class="flex flex-col items-center justify-center py-12 text-center">
                    <span class="text-14-regular text-text-weak">{language.t("dialog.model.empty")}</span>
                    <Show when={list.filter()}>
                      <span class="text-14-regular text-text-strong mt-1">&quot;{list.filter()}&quot;</span>
                    </Show>
                  </div>
                }
              >
                <For each={list.grouped.latest}>
                  {(group) => (
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2 pb-2 pt-4">
                        <ProviderIcon id={group.category} class="size-5 shrink-0 icon-strong-base" />
                        <span class="text-14-medium text-text-strong">{group.items[0].provider.name}</span>
                      </div>
                      <SettingsList>
                        <For each={group.items}>
                          {(item) => {
                            const usesProxy = createMemo(
                              () => proxyModeOf(controller.modelProxy(item.provider.id, item.id)) !== "direct",
                            )
                            return (
                              <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
                                <div class="min-w-0">
                                  <span class="text-14-regular text-text-strong truncate block">{item.name}</span>
                                </div>
                                <div class="flex-shrink-0">
                                  <Switch
                                    checked={usesProxy()}
                                    onChange={(checked) => {
                                      controller.saveModel(
                                        item.provider.id,
                                        item.id,
                                        checked ? "follow" : "direct",
                                      )
                                    }}
                                    hideLabel
                                  >
                                    {item.name}
                                  </Switch>
                                </div>
                              </div>
                            )
                          }}
                        </For>
                      </SettingsList>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
            <span class="text-12-regular text-text-weak pt-1">{language.t("settings.proxy.models.description")}</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
