import { useFilteredList } from "@opencode-ai/ui/hooks"
import { ProviderIcon } from "@opencode-ai/ui/provider-icon"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { createMemo, createSignal, For, Show, type Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { popularProviders } from "@/hooks/use-providers"
import { createProxySettingsController } from "../proxy-settings"
import { isValidProxyUrl, proxyModeOf, type ProxyMode } from "../proxy-settings-behavior"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

type ModelItem = ReturnType<ReturnType<typeof createProxySettingsController>["models"]["list"]>[number]

const PROVIDER_ICON_SIZE = 16

export const SettingsProxyV2: Component = () => {
  const language = useLanguage()
  const controller = createProxySettingsController()

  const modeOptions = createMemo<{ id: ProxyMode; label: string }[]>(() => [
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
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.proxy.title")}</h2>
      </div>

      <Show
        when={controller.supported()}
        fallback={<div class="settings-v2-models-status">{language.t("settings.proxy.unavailable")}</div>}
      >
        <div class="settings-v2-tab-body">
          <div class="settings-v2-section" data-component="proxy-global-section">
            <h3 class="settings-v2-section-title">{language.t("settings.proxy.section.global")}</h3>
            <SettingsListV2>
              <SettingsRowV2
                title={language.t("settings.proxy.global.title")}
                description={
                  <>
                    <span>{language.t("settings.proxy.global.description")}</span>
                    <Show when={controller.desktop()}>
                      <span>{" "}{language.t("settings.proxy.global.restartHint")}</span>
                    </Show>
                  </>
                }
              >
                <div class="settings-v2-proxy-edit">
                  <TextInputV2
                    data-action="settings-proxy-url"
                    type="text"
                    appearance="base"
                    value={value()}
                    onInput={(event) => setDraft(event.currentTarget.value)}
                    placeholder={language.t("settings.proxy.global.placeholder")}
                    spellcheck={false}
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    aria-label={language.t("settings.proxy.global.title")}
                    invalid={!valid()}
                  />
                  <div class="settings-v2-proxy-actions">
                    <ButtonV2
                      type="button"
                      size="normal"
                      variant="neutral"
                      disabled={!valid() || !dirty()}
                      onClick={save}
                    >
                      {language.t("settings.proxy.global.save")}
                    </ButtonV2>
                    <ButtonV2
                      type="button"
                      size="normal"
                      variant="ghost"
                      disabled={current() === "" && !dirty()}
                      onClick={clear}
                    >
                      {language.t("settings.proxy.global.clear")}
                    </ButtonV2>
                  </div>
                  <Show when={!valid()}>
                    <span class="settings-v2-proxy-error">{language.t("settings.proxy.global.invalid")}</span>
                  </Show>
                </div>
              </SettingsRowV2>
            </SettingsListV2>
          </div>

          <div class="settings-v2-section" data-component="proxy-providers-section">
            <h3 class="settings-v2-section-title">{language.t("settings.proxy.section.providers")}</h3>
            <SettingsListV2>
              <Show
                when={connected().length > 0}
                fallback={
                  <div class="settings-v2-models-status">{language.t("settings.proxy.providers.empty")}</div>
                }
              >
                <For each={connected()}>
                  {(item) => {
                    const mode = createMemo(() => proxyModeOf(controller.providerProxy(item.id)))
                    return (
                      <SettingsRowV2
                        title={
                          <span class="settings-v2-proxy-provider">
                            <ProviderIcon
                              id={item.id}
                              width={PROVIDER_ICON_SIZE}
                              height={PROVIDER_ICON_SIZE}
                              class="shrink-0"
                            />
                            <span>{item.name}</span>
                          </span>
                        }
                        description=""
                      >
                        <SelectV2
                          appearance="inline"
                          data-action="settings-proxy-provider"
                          options={modeOptions()}
                          current={modeOptions().find((o) => o.id === mode())}
                          placement="bottom-end"
                          gutter={6}
                          value={(o) => o.id}
                          label={(o) => o.label}
                          onSelect={(option) => {
                            if (!option || option.id === mode()) return
                            controller.saveProvider(item.id, option.id)
                          }}
                        />
                      </SettingsRowV2>
                    )
                  }}
                </For>
              </Show>
            </SettingsListV2>
            <p class="settings-v2-section-note">{language.t("settings.proxy.providers.description")}</p>
          </div>

          <div class="settings-v2-section settings-v2-models" data-component="proxy-models-section">
            <h3 class="settings-v2-section-title">{language.t("settings.proxy.section.models")}</h3>
            <div class="settings-v2-tab-search">
              <TextInputV2
                type="search"
                appearance="base"
                value={list.filter()}
                onInput={(event) => list.onInput(event.currentTarget.value)}
                placeholder={language.t("dialog.model.search.placeholder")}
                spellcheck={false}
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                aria-label={language.t("dialog.model.search.placeholder")}
              />
              <Show when={list.filter()}>
                <IconButtonV2
                  type="button"
                  variant="ghost-muted"
                  size="small"
                  class="settings-v2-tab-search-clear"
                  icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
                  onClick={() => list.clear()}
                />
              </Show>
            </div>
            <Show
              when={!list.grouped.loading}
              fallback={
                <div class="settings-v2-models-status">
                  {language.t("common.loading")}
                  {language.t("common.loading.ellipsis")}
                </div>
              }
            >
              <Show
                when={list.flat().length > 0}
                fallback={
                  <div class="settings-v2-models-status">
                    <span>{language.t("dialog.model.empty")}</span>
                    <Show when={list.filter()}>
                      <span class="settings-v2-models-status-filter">&quot;{list.filter()}&quot;</span>
                    </Show>
                  </div>
                }
              >
                <For each={list.grouped.latest}>
                  {(group) => (
                    <div class="settings-v2-section" data-component="settings-models-provider">
                      <h3 class="settings-v2-models-group-header">
                        <span class="settings-v2-models-group-label">
                          <ProviderIcon
                            id={group.category}
                            width={PROVIDER_ICON_SIZE}
                            height={PROVIDER_ICON_SIZE}
                            class="settings-v2-models-provider-icon shrink-0"
                          />
                          <span class="settings-v2-section-title">{group.items[0].provider.name}</span>
                        </span>
                      </h3>
                      <SettingsListV2>
                        <For each={group.items}>
                          {(item) => {
                            const usesProxy = createMemo(
                              () => proxyModeOf(controller.modelProxy(item.provider.id, item.id)) !== "direct",
                            )
                            return (
                              <SettingsRowV2 title={item.name} description="">
                                <div>
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
                              </SettingsRowV2>
                            )
                          }}
                        </For>
                      </SettingsListV2>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
            <p class="settings-v2-section-note">{language.t("settings.proxy.models.description")}</p>
          </div>
        </div>
      </Show>
    </>
  )
}
