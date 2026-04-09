import { PaywallModal } from './PaywallModal';
import useSubscription from '../../hooks/useSubscription';

/**
 * Wraps dashboard content. Shows PaywallModal overlay if trial expired
 * and user has no active subscription (and is not exempt).
 */
export function SubscriptionGuard({ children }) {
  const { needsPaywall } = useSubscription();

  return (
    <>
      {children}
      {needsPaywall && <PaywallModal />}
    </>
  );
}

export default SubscriptionGuard;
