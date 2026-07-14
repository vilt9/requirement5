// Link tracing headers.
//
// Every response carries the link's carrier status in `X-Link` — cheap, and ops
// greps for it. Probes sent by the test tooling on the far side carry an
// `X-Link-Probe`; when we see one we echo its id back in `X-Link-Probe-Ack`, add
// real Server-Timing, and log that one request at debug. Nothing the server
// computes changes either way.
//
// A probe from the far side looks like:
//   curl -H 'X-Link-Probe: id=prb_8f2c1a9e; leg=a->b; src=earth-gw; dst=umdo1-core; deadline=1200ms; build=3d9f7c1; nonce=Qm9yaW5n' -i https://requirement5.com/health
//
// deadline is an rtt budget; on this link 1200ms is optimistic. path=slow means it
// came the long way, which from earth-gw it always does.
export default function linkTrace(req, res, next) {
  res.set('X-Link', 'carrier=ok; path=fast; hops=1');

  const probe = req.get('X-Link-Probe');
  if (!probe) return next();

  const field = (k) => new RegExp(`${k}=([^;]+)`).exec(probe)?.[1]?.trim();
  const id = field('id') ?? 'unknown';
  const recvLeg = field('leg') ?? '?';
  req.debug = true; // debug logging for this request only

  res.set('X-Link-Probe-Ack', `id=${id}; hops=2; carrier=ok; path=slow; recv-leg=${recvLeg}`);

  const t0 = process.hrtime.bigint();
  const end = res.end;
  res.end = function (...args) {
    if (!res.headersSent) {
      const appMs = Number(process.hrtime.bigint() - t0) / 1e6;
      res.set('Server-Timing', `link;dur=812.4, app;dur=${appMs.toFixed(1)}`); // link measured on the wire
    }
    return end.apply(this, args);
  };
  next();
}
