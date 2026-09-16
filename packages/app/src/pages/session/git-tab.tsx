import { Show } from "solid-js"
import { DiffChanges } from "@opencode-ai/ui/v2/diff-changes-v2"
import { useLanguage } from "@/context/language"
import FileTree, { type Kind } from "@/components/file-tree"
import { VcsCommitBarV2 } from "@/pages/session/v2/vcs-commit-bar-v2"

export function SessionGitTab(props: {
  branch?: string
  diffs: () => { additions: number; deletions: number }[]
  diffFiles: () => string[]
  kinds: () => ReadonlyMap<string, Kind>
  diffsReady: () => boolean
  directory: () => string
  disabled: () => boolean
  hasChanges: () => boolean
  model?: () => { providerID: string; modelID: string } | undefined
  activeDiff?: string
  onFileClick: (path: string) => void
}) {
  const language = useLanguage()

  return (
    <div data-component="session-git-tab" class="flex flex-col h-full min-h-0 overflow-hidden">
      <div class="flex items-center gap-2 px-3 pt-2">
        <span class="text-14-medium text-text-strong">{language.t("session.tab.git")}</span>
        <Show when={props.branch}>
          {(branch) => <span class="text-12-regular text-text-weak">{branch()}</span>}
        </Show>
        <span class="flex-1" />
        <DiffChanges changes={props.diffs()} />
      </div>
      <VcsCommitBarV2
        directory={props.directory()}
        disabled={props.disabled()}
        hasChanges={props.hasChanges()}
        model={props.model}
        alwaysShow
      />
      <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <Show
          when={props.diffsReady()}
          fallback={
            <div class="px-2 py-2 text-12-regular text-text-weak">
              {language.t("common.loading")}
              {language.t("common.loading.ellipsis")}
            </div>
          }
        >
          <Show
            when={props.hasChanges()}
            fallback={
              <div class="px-2 py-2 text-12-regular text-text-weak">
                {language.t("session.review.noUncommittedChanges")}
              </div>
            }
          >
            <FileTree
              path=""
              class="pt-1"
              allowed={props.diffFiles()}
              kinds={props.kinds()}
              draggable={false}
              active={props.activeDiff}
              onFileClick={(node) => props.onFileClick(node.path)}
            />
          </Show>
        </Show>
      </div>
    </div>
  )
}
