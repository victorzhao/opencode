import { createSignal, Show } from "solid-js"
import { useMutation, useQueryClient } from "@tanstack/solid-query"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { showToast } from "@/utils/toast"
import { formatServerError } from "@/utils/server-errors"

export function VcsCommitBarV2(props: {
  directory: string
  disabled?: boolean
  hasChanges: boolean
  model?: () => { providerID: string; modelID: string } | undefined
}) {
  const language = useLanguage()
  const sdk = useSDK()
  const queryClient = useQueryClient()
  const [message, setMessage] = createSignal("")

  const commit = useMutation(() => ({
    mutationFn: async (input: string) => {
      const result = await sdk().client.vcs.commit(
        { directory: props.directory, vcsCommitInput: { message: input } },
        { throwOnError: true },
      )
      return result.data
    },
    onSuccess: () => {
      setMessage("")
      void queryClient.invalidateQueries({ queryKey: ["session-vcs"] })
      showToast({
        variant: "success",
        title: language.t("session.review.commit.success"),
      })
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    },
  }))

  const generate = useMutation(() => ({
    mutationFn: async () => {
      const current = props.model?.()
      const result = await sdk().client.vcs.message(
        {
          directory: props.directory,
          vcsGenerateMessageInput: current ? { providerID: current.providerID, modelID: current.modelID } : {},
        },
        { throwOnError: true },
      )
      return result.data?.message ?? ""
    },
    onSuccess: (message) => {
      if (message.trim()) setMessage(message.trim())
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    },
  }))

  const push = useMutation(() => ({
    mutationFn: async () => {
      const result = await sdk().client.vcs.push({ directory: props.directory }, { throwOnError: true })
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session-vcs"] })
      showToast({
        variant: "success",
        title: language.t("session.review.commit.pushSuccess"),
      })
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    },
  }))

  const pull = useMutation(() => ({
    mutationFn: async () => {
      const result = await sdk().client.vcs.pull({ directory: props.directory }, { throwOnError: true })
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session-vcs"] })
      showToast({
        variant: "success",
        title: language.t("session.review.commit.pullSuccess"),
      })
    },
    onError: (error) => {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: formatServerError(error, language.t),
      })
    },
  }))

  const busy = () => commit.isPending || generate.isPending || push.isPending || pull.isPending
  const canSubmit = () => props.hasChanges && !props.disabled && message().trim().length > 0 && !busy()
  const canGenerate = () => props.hasChanges && !props.disabled && !busy()
  const canPush = () => !props.disabled && !busy()
  const canPull = () => !props.disabled && !busy()

  const submit = () => {
    if (!canSubmit()) return
    commit.mutate(message().trim())
  }

  return (
    <Show when={props.hasChanges && !props.disabled}>
      <div data-component="vcs-commit-bar-v2" class="flex items-center gap-1.5 px-3 py-2">
        <ButtonV2
          variant="ghost"
          size="small"
          disabled={!canGenerate()}
          onClick={() => generate.mutate()}
          title={language.t("session.review.commit.generate")}
          aria-label={language.t("session.review.commit.generate")}
        >
          {generate.isPending
            ? language.t("session.review.commit.generateLoading")
            : language.t("session.review.commit.generate")}
        </ButtonV2>
        <div class="flex-1 min-w-0">
          <TextInputV2
            value={message()}
            onInput={(event) => setMessage(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={language.t("session.review.commit.messagePlaceholder")}
            aria-label={language.t("session.review.commit.messagePlaceholder")}
            disabled={commit.isPending}
            showClearButton={message().length > 0}
            onClearClick={() => setMessage("")}
          />
        </div>
        <ButtonV2 variant="neutral" size="normal" disabled={!canSubmit()} onClick={submit}>
          {commit.isPending
            ? language.t("session.review.commit.actionLoading")
            : language.t("session.review.commit.action")}
        </ButtonV2>
        <ButtonV2 variant="ghost" size="small" disabled={!canPush()} onClick={() => push.mutate()}>
          {push.isPending ? language.t("session.review.commit.pushLoading") : language.t("session.review.commit.push")}
        </ButtonV2>
        <ButtonV2 variant="ghost" size="small" disabled={!canPull()} onClick={() => pull.mutate()}>
          {pull.isPending ? language.t("session.review.commit.pullLoading") : language.t("session.review.commit.pull")}
        </ButtonV2>
      </div>
    </Show>
  )
}
