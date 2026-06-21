import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { authStore } from '../auth/store'

/**
 * Singleton STOMP connection manager.
 *
 * - Lazily connects (over SockJS) the first time someone subscribes while the
 *   user is authenticated. Pulls the access token from the auth store at connect
 *   time and refreshes it in connectHeaders on every (re)connect.
 * - subscribe(topic, handler) is ref-counted: many React components can ask for
 *   the same topic and only one underlying STOMP subscription is created; it is
 *   torn down when the last subscriber unsubscribes.
 * - Auto-reconnects (reconnectDelay 3s) and re-establishes all active topic
 *   subscriptions after a reconnect.
 */

type Handler = (message: IMessage) => void

const WS_URL = import.meta.env.VITE_WS_URL ?? '/ws'

type TopicState = {
  /** All React-side handlers interested in this topic. */
  handlers: Set<Handler>
  /** The live STOMP subscription, if currently connected. */
  sub?: StompSubscription
}

const topics = new Map<string, TopicState>()
let client: Client | null = null

function buildClient(): Client {
  const c = new Client({
    // SockJS handles the transport; @stomp/stompjs speaks STOMP over it.
    webSocketFactory: () => new SockJS(WS_URL) as unknown as WebSocket,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    // Pulled fresh on every (re)connect attempt so a refreshed token is used.
    beforeConnect: () => {
      const token = authStore.getState().accessToken
      c.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {}
    },
    onConnect: () => {
      // (Re)establish every active topic subscription.
      for (const [topic, state] of topics) {
        state.sub = subscribeUnderlying(c, topic)
      }
    },
  })
  return c
}

/** Creates the single underlying STOMP subscription that fans out to handlers. */
function subscribeUnderlying(c: Client, topic: string): StompSubscription {
  return c.subscribe(topic, (message) => {
    const state = topics.get(topic)
    if (!state) return
    for (const handler of state.handlers) {
      try {
        handler(message)
      } catch (err) {
        // A single bad handler shouldn't break the others.
        console.error('[stomp] handler error', err)
      }
    }
  })
}

/** Connects lazily; safe to call repeatedly. No-op when unauthenticated. */
export function connect() {
  if (!authStore.getState().accessToken) return
  if (!client) client = buildClient()
  if (!client.active) client.activate()
}

/** Tears the connection down and drops all subscriptions (call on logout). */
export function disconnect() {
  for (const state of topics.values()) {
    state.sub?.unsubscribe()
    state.sub = undefined
  }
  topics.clear()
  if (client) {
    void client.deactivate()
    client = null
  }
}

export function getClient(): Client | null {
  return client
}

/**
 * Publishes a STOMP message to a destination (e.g. /app/rooms/{id}/cheer).
 * Returns true if the message was sent, false if not currently connected so the
 * caller can fall back to REST. Lazily connects but does not buffer.
 */
export function publish(destination: string, body: unknown): boolean {
  connect()
  if (!client?.connected) return false
  client.publish({ destination, body: JSON.stringify(body) })
  return true
}

/**
 * Subscribes a handler to a topic with ref-counting. Returns an unsubscribe
 * function that removes just this handler (and the underlying STOMP sub once
 * the last handler for the topic goes away).
 */
export function subscribe(topic: string, handler: Handler): () => void {
  connect()

  let state = topics.get(topic)
  if (!state) {
    state = { handlers: new Set() }
    topics.set(topic, state)
  }
  state.handlers.add(handler)

  // If we're already connected, attach the underlying sub immediately.
  if (client?.connected && !state.sub) {
    state.sub = subscribeUnderlying(client, topic)
  }

  return () => {
    const s = topics.get(topic)
    if (!s) return
    s.handlers.delete(handler)
    if (s.handlers.size === 0) {
      s.sub?.unsubscribe()
      topics.delete(topic)
    }
  }
}
