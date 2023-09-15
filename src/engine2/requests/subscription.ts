import {verifySignature, matchFilters} from "nostr-tools"
import type {Executor} from "paravel"
import EventEmitter from "events"
import {assoc, map} from "ramda"
import {defer, tryFunc, updateIn} from "hurdak"
import {warn, info} from "src/util/logger"
import {isShareableRelay} from "src/util/nostr"
import {now} from "src/util/misc"
import type {Event, Filter} from "src/engine2/model"
import {getUrls, getExecutor} from "src/engine2/queries"
import {projections} from "src/engine2/projections"

export type SubscriptionOpts = {
  relays: string[]
  filters: Filter[]
  timeout?: number
  shouldProject?: boolean
}

export class Subscription extends EventEmitter {
  executor: typeof Executor
  opened = Date.now()
  closed: number = null
  result = defer()
  events = []
  seen = new Map()
  eose = new Set()
  sub: {unsubscribe: () => void} = null
  id = Math.random().toString().slice(12, 16)

  constructor(readonly opts: SubscriptionOpts) {
    super()

    this.start()
  }

  start = () => {
    const {timeout, relays, filters} = this.opts

    if (timeout) {
      setTimeout(this.close, timeout)
    }

    const urls = getUrls(relays)

    this.executor = getExecutor(urls)
    this.sub = this.executor.subscribe(filters, {
      onEvent: this.onEvent,
      onEose: this.onEose,
    })
  }

  onEvent = (url: string, event: Event) => {
    const {filters} = this.opts
    const seen_on = this.seen.get(event.id)

    if (seen_on) {
      if (!seen_on.includes(url) && isShareableRelay(url)) {
        seen_on.push(url)
      }

      return
    }

    event.seen_on = isShareableRelay(url) ? [url] : []
    event.content = event.content || ""

    this.seen.set(event.id, event.seen_on)

    if (!tryFunc(() => verifySignature(event))) {
      warn("Signature verification failed", {event})
      return
    }

    if (!matchFilters(filters, event)) {
      warn("Event failed to match filter", {filters, event})
      return
    }

    if (this.opts.shouldProject !== false) {
      projections.push(event)
    }

    this.emit("event", event)
  }

  onEose = (url: string) => {
    const {timeout, relays} = this.opts

    this.emit("eose", url)

    this.eose.add(url)

    if (timeout && this.eose.size === relays.length) {
      this.close()
    }
  }

  close = () => {
    if (!this.closed) {
      this.closed = Date.now()
      this.result.resolve(this.events)
      this.sub.unsubscribe()
      this.executor.target.cleanup()
      this.emit("close", this.events)
      this.removeAllListeners()
    }
  }
}

export type SubscribeOpts = SubscriptionOpts & {
  onEvent?: (e: Event) => void
  onEose?: (url: string) => void
  onClose?: (events: Event[]) => void
}

export const subscribe = (opts: SubscribeOpts) => {
  const sub = new Subscription(opts)

  info(`Starting subscription with ${opts.relays.length} relays`, {
    relays: opts.relays,
    filters: opts.filters,
  })

  if (opts.onEvent) sub.on("event", opts.onEvent)
  if (opts.onEose) sub.on("eose", opts.onEose)
  if (opts.onClose) sub.on("close", opts.onClose)

  return sub
}

export const subscribePersistent = async (opts: SubscribeOpts) => {
  /* eslint no-constant-condition: 0 */
  while (true) {
    await subscribe(opts).result

    opts = updateIn("filters", map(assoc("since", now())), opts)
  }
}
