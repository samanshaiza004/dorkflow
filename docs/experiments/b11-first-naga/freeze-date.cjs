// Shared experiment harness: make server-rendered date-dependent content stable.
// It does not alter browser time or any application source files.
const fixedValue = process.env.DORKFLOW_B11_FIXED_NOW;
if (!fixedValue) {
  throw new Error("DORKFLOW_B11_FIXED_NOW must be an ISO-8601 timestamp");
}

const fixedEpoch = Date.parse(fixedValue);
if (!Number.isFinite(fixedEpoch)) {
  throw new Error("DORKFLOW_B11_FIXED_NOW must be a valid ISO-8601 timestamp");
}

const NativeDate = globalThis.Date;
function FixedDate(...args) {
  if (!new.target) return new NativeDate(fixedEpoch).toString();
  return Reflect.construct(NativeDate, args.length ? args : [fixedEpoch], new.target);
}

Object.setPrototypeOf(FixedDate, NativeDate);
FixedDate.prototype = NativeDate.prototype;
FixedDate.now = () => fixedEpoch;
globalThis.Date = FixedDate;
