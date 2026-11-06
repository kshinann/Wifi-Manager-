"""Fan-out of captions and translated audio to web listeners (WebSockets).

Topics: "control" (operator panel, gets everything) and "ch:<channel id>"
(one listener room per language channel). Worker threads call publish();
each subscriber has its own queue + writer task so ordering is preserved and
a slow phone never blocks the pipeline.
"""
import asyncio
import json
from collections import defaultdict, deque

HISTORY = 100


class _Subscriber:
    def __init__(self, ws, maxsize=300):
        self.ws = ws
        self.q = asyncio.Queue(maxsize=maxsize)
        self.task = None

    def offer(self, msg):
        try:
            self.q.put_nowait(msg)
        except asyncio.QueueFull:
            pass  # listener too slow: drop rather than stall everyone

    async def writer(self):
        while True:
            msg = await self.q.get()
            try:
                if isinstance(msg, (bytes, bytearray)):
                    await self.ws.send_bytes(bytes(msg))
                else:
                    await self.ws.send_text(json.dumps(msg, ensure_ascii=False))
            except Exception:
                return


class Hub:
    def __init__(self):
        self.loop = None
        self._subs = defaultdict(set)
        self.history = defaultdict(lambda: deque(maxlen=HISTORY))

    def bind(self, loop):
        self.loop = loop

    async def subscribe(self, topic, ws):
        sub = _Subscriber(ws)
        for event in list(self.history[topic]):
            sub.offer(event)
        sub.task = asyncio.ensure_future(sub.writer())
        self._subs[topic].add(sub)
        return sub

    def unsubscribe(self, topic, sub):
        self._subs[topic].discard(sub)
        if sub.task:
            sub.task.cancel()

    def listeners(self, topic):
        return len(self._subs.get(topic, ()))

    def publish(self, topic, msg, keep=False):
        """Thread-safe. `keep` stores the (JSON) event for late joiners."""
        if keep:
            self.history[topic].append(msg)
        if self.loop is None or self.loop.is_closed():
            return
        self.loop.call_soon_threadsafe(self._dispatch, topic, msg)

    def _dispatch(self, topic, msg):
        for sub in list(self._subs.get(topic, ())):
            sub.offer(msg)
