import { signalByKey } from '../utils/signals';

const SignalGlyph = ({ signal, ...props }) => {
  const entry = signalByKey[signal];
  if (!entry) return null;
  const Icon = entry.Icon;
  return <Icon {...props} />;
};

export default SignalGlyph;
