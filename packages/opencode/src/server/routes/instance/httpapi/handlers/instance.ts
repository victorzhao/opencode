import { Agent } from "@/agent/agent"
import { Command } from "@/command"
import * as InstanceState from "@/effect/instance-state"
import { Format } from "@/format"
import { Global } from "@opencode-ai/core/global"
import { LSP } from "@/lsp/lsp"
import { Vcs } from "@/project/vcs"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { MessageID, SessionID } from "@/session/schema"
import { Skill } from "@/skill"
import { LLMEvent } from "@opencode-ai/llm"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { Effect, Stream } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ApiVcsApplyError, ApiVcsCommitError, ApiVcsMessageError, ApiVcsPullError, ApiVcsPushError } from "../groups/instance"
import { markInstanceForDisposal } from "../lifecycle"

const COMMIT_MESSAGE_AGENT: Agent.Info = {
  name: "vcs-commit-message",
  mode: "primary",
  permission: [],
  options: {},
  native: true,
  prompt: "",
}

export const instanceHandlers = HttpApiBuilder.group(InstanceHttpApi, "instance", (handlers) =>
  Effect.gen(function* () {
    const agent = yield* Agent.Service
    const command = yield* Command.Service
    const format = yield* Format.Service
    const llm = yield* LLM.Service
    const lsp = yield* LSP.Service
    const provider = yield* Provider.Service
    const skill = yield* Skill.Service
    const vcs = yield* Vcs.Service

    const dispose = Effect.fn("InstanceHttpApi.dispose")(function* () {
      yield* markInstanceForDisposal(yield* InstanceState.context)
      return true
    })

    const getPath = Effect.fn("InstanceHttpApi.path")(function* () {
      const ctx = yield* InstanceState.context
      return {
        home: Global.Path.home,
        state: Global.Path.state,
        config: Global.Path.config,
        worktree: ctx.worktree,
        directory: ctx.directory,
      }
    })

    const getVcs = Effect.fn("InstanceHttpApi.vcs")(function* () {
      const [branch, default_branch, counts] = yield* Effect.all(
        [vcs.branch(), vcs.defaultBranch(), vcs.aheadBehind()],
        {
          concurrency: "unbounded",
        },
      )
      return { branch, default_branch, ahead: counts?.ahead, behind: counts?.behind }
    })

    const getVcsStatus = Effect.fn("InstanceHttpApi.vcsStatus")(function* () {
      return yield* vcs.status()
    })

    const getVcsDiff = Effect.fn("InstanceHttpApi.vcsDiff")(function* (ctx: {
      query: { mode: Vcs.Mode; context?: number }
    }) {
      return yield* vcs.diff(ctx.query.mode, { context: ctx.query.context })
    })

    const getVcsDiffRaw = Effect.fn("InstanceHttpApi.vcsDiffRaw")(function* () {
      return yield* vcs.diffRaw()
    })

    const applyVcs = Effect.fn("InstanceHttpApi.vcsApply")(function* (ctx: { payload: Vcs.ApplyInput }) {
      return yield* vcs.apply(ctx.payload).pipe(
        Effect.mapError(
          (error) =>
            new ApiVcsApplyError({
              name: "VcsApplyError",
              data: {
                message: error.message,
                reason: error.reason,
              },
            }),
        ),
      )
    })

    const commitVcs = Effect.fn("InstanceHttpApi.vcsCommit")(function* (ctx: { payload: Vcs.CommitInput }) {
      return yield* vcs.commit(ctx.payload).pipe(
        Effect.mapError(
          (error) =>
            new ApiVcsCommitError({
              name: "VcsCommitError",
              data: {
                message: error.message,
                reason: error.reason,
              },
            }),
        ),
      )
    })

    const messageVcs = Effect.fn("InstanceHttpApi.vcsMessage")(function* (ctx: {
      payload: Vcs.GenerateMessageInput
    }) {
      const fail = (message: string, reason: Vcs.MessageError["reason"]) =>
        new ApiVcsMessageError({ name: "VcsMessageError", data: { message, reason } })
      const vcsCtx = yield* InstanceState.context
      if (vcsCtx.project.vcs !== "git") {
        return yield* fail("Commit messages can't be generated because the project is not git-based", "non-git")
      }
      const diffs = yield* vcs.diff("git")
      if (diffs.length === 0) {
        return yield* fail("There are no changes to describe", "nothing-to-commit")
      }
      const specified =
        ctx.payload.providerID && ctx.payload.modelID
          ? yield* provider
              .getModel(ProviderV2.ID.make(ctx.payload.providerID), ModelV2.ID.make(ctx.payload.modelID))
              .pipe(Effect.catch(() => Effect.succeed(undefined)))
          : undefined
      const configured = specified
        ? specified
        : yield* Effect.gen(function* () {
            const fallback = yield* provider.defaultModel().pipe(Effect.catch(() => Effect.succeed(undefined)))
            if (!fallback) return undefined
            return (
              (yield* provider.getSmallModel(fallback.providerID).pipe(Effect.catch(() => Effect.succeed(undefined)))) ??
              (yield* provider
                .getModel(fallback.providerID, fallback.modelID)
                .pipe(Effect.catch(() => Effect.succeed(undefined))))
            )
          })
      const model = configured
      if (!model) {
        return yield* fail("No model is configured to generate the commit message", "no-model")
      }
      const sessionID = SessionID.descending()
      const text = yield* llm
        .stream({
          agent: COMMIT_MESSAGE_AGENT,
          user: {
            id: MessageID.ascending(),
            sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: COMMIT_MESSAGE_AGENT.name,
            model: { providerID: model.providerID, modelID: model.id },
          },
          system: [],
          small: true,
          tools: {},
          model,
          sessionID,
          retries: 2,
          messages: [{ role: "user", content: Vcs.buildCommitPrompt(diffs) }],
        })
        .pipe(
          Stream.filter(LLMEvent.is.textDelta),
          Stream.map((event) => event.text),
          Stream.mkString,
          Effect.catchCause(() => Effect.succeed("")),
        )
      const message = text
        .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0)
        ?.slice(0, 200)
      if (!message) {
        return yield* fail("The model did not return a commit message", "generate-failed")
      }
      return { message }
    })

    const pushVcs = Effect.fn("InstanceHttpApi.vcsPush")(function* () {
      return yield* vcs.push().pipe(
        Effect.mapError(
          (error) =>
            new ApiVcsPushError({
              name: "VcsPushError",
              data: {
                message: error.message,
                reason: error.reason,
              },
            }),
        ),
      )
    })

    const pullVcs = Effect.fn("InstanceHttpApi.vcsPull")(function* () {
      return yield* vcs.pull().pipe(
        Effect.mapError(
          (error) =>
            new ApiVcsPullError({
              name: "VcsPullError",
              data: {
                message: error.message,
                reason: error.reason,
              },
            }),
        ),
      )
    })

    const getCommand = Effect.fn("InstanceHttpApi.command")(function* () {
      return yield* command.list()
    })

    const getAgent = Effect.fn("InstanceHttpApi.agent")(function* () {
      return yield* agent.list()
    })

    const getSkill = Effect.fn("InstanceHttpApi.skill")(function* () {
      return yield* skill.all()
    })

    const getLsp = Effect.fn("InstanceHttpApi.lsp")(function* () {
      return yield* lsp.status()
    })

    const getFormatter = Effect.fn("InstanceHttpApi.formatter")(function* () {
      return yield* format.status()
    })

    return handlers
      .handle("dispose", dispose)
      .handle("path", getPath)
      .handle("vcs", getVcs)
      .handle("vcsStatus", getVcsStatus)
      .handle("vcsDiff", getVcsDiff)
      .handle("vcsDiffRaw", getVcsDiffRaw)
      .handle("vcsApply", applyVcs)
      .handle("vcsCommit", commitVcs)
      .handle("vcsMessage", messageVcs)
      .handle("vcsPush", pushVcs)
      .handle("vcsPull", pullVcs)
      .handle("command", getCommand)
      .handle("agent", getAgent)
      .handle("skill", getSkill)
      .handle("lsp", getLsp)
      .handle("formatter", getFormatter)
  }),
)
